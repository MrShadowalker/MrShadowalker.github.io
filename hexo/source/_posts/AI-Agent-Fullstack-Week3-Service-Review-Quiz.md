---
layout: post
title: "AI 全栈开发第三周验收：从 API 到 Worker、SSE 的故障演练"
date: 2026-11-16 09:00:00.000
updated: 2026-11-21 09:00:00.000
permalink: /articles/AI-Agent-Fullstack-Week3-Service-Review-Quiz.html
comments: true
description: "复盘 AI 全栈开发第 15–20 天，用一个多租户任务夹具验收 API 幂等、PostgreSQL 持久化、Outbox、Worker 租约、SSE 恢复和前端状态，附八道小测及三道有来源的面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "周复盘"
  - "任务系统"
  - "SSE"
  - "面试"
---

补刊说明：本文补齐原定第 21 天学习内容；资料与题目于 2026-11-21 检索核验。

第三周把“模型调用”推进成“可被用户提交、恢复和观察的任务”。今天不加新框架，用一个本地多租户夹具验证六篇文章能否在失败路径上连起来。下面的练习是验收设计；读完文章不代表已经完成项目，真正的完成证据是代码、逐 Case 结果和失败复盘。
<!--more-->

## 一、本周六个模块，组成一条执行链

| 篇目 | 本周解决的问题 | 最小证据 |
| --- | --- | --- |
| [Day 15：FastAPI 服务入口](/articles/AI-Fullstack-FastAPI-Service-Contract.html) | 受信身份、检索、路由、预算和 trace 怎样进一条请求链 | 两租户同问不同证据，未授权请求被拒绝 |
| [Day 16：任务 API](/articles/AI-Task-API-Idempotency-Cancellation.html) | 202、同键重试、错误码与取消意图怎样约定 | 同键同体只创建一条任务，同键异体返回冲突 |
| [Day 17：PostgreSQL 数据模型](/articles/AI-Task-Postgres-Tenant-Data-Model.html) | 任务、attempt、事件、用量怎样按租户持久化 | 主外键与唯一约束、跨租户读取被拒 |
| [Day 18：可靠 Worker](/articles/AI-Durable-Worker-Outbox-Lease-Retry.html) | Outbox、重复投递、租约过期、旧 Worker 写回 | 重启可恢复，旧租约持有者不能覆盖新结果 |
| [Day 19：SSE 事件流](/articles/AI-Agent-SSE-Event-Stream-Replay-Cancel.html) | 事件序号、重连重放、断线与取消边界 | 重连只补事件，模型调用不重复 |
| [Day 20：TypeScript 任务界面](/articles/AI-Fullstack-TypeScript-Task-Client-UI-State.html) | 提交超时、重复事件、缺口和权限变化如何展示 | UI 状态可回放，失败草稿不显示为成功 |

推荐把因果链写在白板上：

~~~text
认证主体 → POST /v1/tasks → ai_task + outbox_event 同事务
        → Worker 条件领取 + attempt → ai_event + ai_usage
        → GET /v1/tasks/{id}/events 以 SSE 投递
        → 前端按 seq 去重，终态以 GET /v1/tasks/{id} 快照确认
~~~

<code>202 Accepted</code> 代表处理已接受但尚未完成，最后仍可能失败；这是 HTTP 协议语义，不是本文自造的成功码。[RFC 9110 §15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3)（检索日期：2026-11-21）

## 二、120 分钟集成演练：多租户政策分析任务

用 <code>FakeModelClient</code>、固定时钟、测试数据库与可重复投递的假队列。A、B 两个租户问同一句“本月差旅政策有什么变化”，但文档、配额和路由版本不同。API 从认证夹具得到租户；请求体不能覆盖身份。

~~~json
{
  "tenant_id_from_auth": "tenant-a",
  "idempotency_key": "request-17",
  "question": "本月差旅政策有什么变化？",
  "expected": {
    "http_status": 202,
    "task_count": 1,
    "allowed_citations": ["a-policy-v4"],
    "forbidden_citations": ["b-policy-v2"]
  }
}
~~~

这只是测试夹具；真实接口**不接受**客户端传 <code>tenant_id_from_auth</code>。练习分四段：

1. **0–25 分钟：入口与存储。** 跑首次提交、同键同体、同键异体、跨租户读取。核对 <code>ai_task</code>、<code>outbox_event</code> 的唯一约束、事务和 202/409/404 响应。
2. **25–55 分钟：Worker 故障。** 注入“事务提交后 API 崩溃”“Outbox 重发两次”“Worker A 租约过期后 Worker B 领取”。核对 attempt 数、租约 fence、旧 Worker 写回被拒及预算结算。
3. **55–85 分钟：事件与页面。** 在 <code>seq=5</code> 后断开 SSE，按 <code>Last-Event-ID</code> 重连；再注入重复 <code>seq=5</code> 和跳号 <code>seq=7</code>。前端重复事件不追加、跳号读快照，后端不重调模型。
4. **85–120 分钟：取消、权限与复盘。** 在工具调用前、外部副作用结果未知时分别请求取消；撤销租户成员权限后尝试读取旧任务流。写逐 Case 报告，列明无法自动确定的结果。

### 必须保留的故障矩阵

| Case | 注入条件 | 正确结果 |
| --- | --- | --- |
| 首次提交 | 一个有效请求 | 202、一个任务、一个 Outbox 意图 |
| 响应丢失 | 任务已落库，客户端用原键重发 | 返回同一任务，无第二次预算预留 |
| 键冲突 | 原键配不同请求体 | 409，无新任务 |
| 跨租户读取 | B 读 A 的任务或事件 | 403 或统一 404，不泄露 A 的正文 |
| Outbox 丢唤醒 | 数据库已提交，发布器暂时停机 | 恢复发布器后仍能调度任务 |
| 队列重复 | 同一消息投递两次 | 只一个有效持有者；旧消息可安全跳过 |
| 租约竞争 | A 卡顿，B 取得新 fence，A 后写回 | A 写回被拒；保留 attempt 证据 |
| 供应商结果未知 | 请求已发出，回执丢失 | 进入对账，不盲目重放副作用 |
| SSE 断线 | 第五事件后重连 | <code>seq&gt;5</code> 补播；不重新执行任务 |
| UI 乱序或重复 | 先收到 7，再收到 5 | 跳号拉快照，重复帧不拼接 |
| 取消与完成竞态 | 取消请求和终态几乎同时到达 | 以状态版本与真实回执定最终状态 |
| 权限撤销 | 旧页面尚有草稿、SSE 正连接 | 后端拒绝继续读取，前端清除敏感内容 |

交付 <code>fixtures.jsonl</code>、迁移 SQL、<code>report.jsonl</code> 和一页故障复盘。报告每条记录应带 <code>case_id</code>、<code>task_id</code>、<code>trace_id</code>、预期/实际状态、attempt 数和 PASS/FAIL/NOT_RUN。跨租户泄露、重复扣费、旧 Worker 覆盖新状态属于硬失败，不靠其他 Case 的通过率抵消。PostgreSQL 行级安全策略可以作为纵深保护，但仍要设置正确的请求级租户上下文与应用授权；超级用户和表所有者等可能绕过策略，不能把 RLS 当唯一权限层。[PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)（检索日期：2026-11-21）

## 三、第三周小测：先自己作答

下面八题是本系列自测题，**不是企业面试原题**。每题按“结论、机制、边界”各 1 分，共 24 分；建议先限时 20 分钟，再看答案。

1. 客户端请求体给出 <code>tenant_id=tenant-a</code>，认证票据属于 tenant-b，后端该以哪个为准？
2. <code>POST /v1/tasks</code> 返回 202，是否可以在 UI 标注“已成功回答”？
3. 同一租户、同一创建者、同一接口和幂等键，但问题不同的请求同时到达，为什么不能“先查有没有，再插入”？
4. <code>ai_task</code> 已提交，但 API 在发送 MQ 消息前崩溃；什么记录让系统能继续执行？
5. Worker A 的租约到期，B 已拿到任务；A 后续收到模型回包，怎样阻止它写坏任务？
6. 客户端收到 <code>seq=5</code> 后断线，重连时从哪里读？重放是否意味着再次调用模型？
7. 页面按顺序收到 <code>seq=5</code>、<code>seq=7</code>、<code>seq=5</code>；分别该怎样处理？
8. 用户点击取消时，外部工具已发出付款请求但结果未知。可以立即标记 <code>CANCELLED</code> 吗？

### 参考答案

| 题号 | 结论与机制 | 必须说出的边界 |
| --- | --- | --- |
| 1 | 以验签后的认证主体和授权服务为准；请求体租户字段不能提升权限 | 检索、预算、任务查询及事件读取都用同一受信租户上下文 |
| 2 | 不可以。202 只说明受理；查询任务终态后才显示成功 | 用户主动取消或下游失败都可能发生 |
| 3 | 两次查询都可能看到“不存在”；由数据库唯一约束决定唯一创建者，同键异体返回冲突 | 重放旧任务也要重新检查当前主体有权读取 |
| 4 | 与任务同事务提交的 <code>outbox_event</code>；发布器恢复后扫描未发布意图 | 队列仍可能重复投递，Worker 要幂等 |
| 5 | 条件更新校验任务状态、租约 owner 与递增 fence；失效的 A 只能留下诊断记录 | 外部调用可能已经花钱，不能抹掉旧 attempt |
| 6 | 用 <code>Last-Event-ID=5</code> 读取当前任务中 <code>seq&gt;5</code> 的持久化事件 | 重放投递，不重做业务步骤 |
| 7 | 5 正常追加；7 暴露缺口，停止拼接并拉快照；第二个 5 去重 | 不能靠到达顺序猜服务器状态 |
| 8 | 不可以。先持久化取消意图，查询工具回执或进入 <code>RECONCILING</code> | 前端断线也不等于业务取消 |

## 四、本周面试题（检索日期：2026-11-21）

以下题面来自可直接打开正文的牛客用户自述；公司与面试经历未获企业官方核验。答案与追问是本系列的工程归纳。

### 1. 每秒一万条任务提交，怎样设计提交和取消接口，并避免多实例重复执行？

- **方向 / 难度**：高并发任务系统 / 难。
- **参考答案**：入口用幂等键与数据库唯一约束接收，按执行时间建立索引，取消走状态版本条件更新；调度器分批领取到期任务，使用租约/fence 防旧实例写回。队列负责削峰，状态事实持久化；按实际 QPS、峰值、任务体积和时效目标选择数据库扫描、分片队列或专用调度器。
- **追问**：取消与 Worker 领取同时发生，怎样确定哪一个可执行？用条件状态转换与版本判断，再复查取消标志。
- **来源**：[牛客“字节后端/Agent 开发二面”用户自述](https://www.nowcoder.com/feed/main/detail/41d9a80535a0460bb8967a4ff0d1384b?sourceSSR=subject)，正文“高 QPS、可取消的延迟任务”部分；页面显示 11-14。

### 2. Agent 进程重启后从哪里恢复？怎样防止重复执行有副作用工具？

- **方向 / 难度**：Agent Runtime、恢复与安全 / 难。
- **参考答案**：从持久化任务状态、事件和步骤检查点恢复；对未确认的外部动作保留稳定 action key 与请求/回执 ID，先查询下游或对账。Worker 重新领取时校验租约和 fence，工具执行前再校验权限、预算与取消状态。
- **追问**：工具调用已发出但回执丢失，能直接重试吗？只有下游支持同键幂等且结果可核验时才可安全重试，否则待对账或人工接管。
- **来源**：[牛客“科大讯飞后端/Agent 开发一面”用户自述](https://www.nowcoder.com/feed/main/detail/e5abd2dc95934bf58177525b5736f290)，正文“排障 Agent：预算、审批与重启恢复”；页面显示 11-15。

### 3. MySQL 加 MQ 驱动状态机，消息可靠性和跨机器重复消费怎样保证？

- **方向 / 难度**：异步任务、分布式一致性 / 难。
- **参考答案**：任务与 Outbox 意图同事务提交，异步发布并允许重复；消费者以 <code>task_id + step_id</code> 做持久化唯一约束和状态条件更新，成功提交后确认消息。Redis 可做加速视图或短租约，不能代替持久化幂等事实；跨 Redis 的写入要有可重建或补偿策略。
- **追问**：数据库事务回滚了，但 Redis 已经更新，怎么修？让数据库为事实源，Redis 通过事件失效或重建；不能声称单库事务自动回滚 Redis。
- **来源**：[牛客“满帮 AI 全栈一面”用户自述](https://api-cdn.nowcoder.com/feed/main/detail/0dfa45a987bb4c19b6963af6bbeb5815?sourceSSR=enterprise)，正文第 10–15 题；页面显示 10-14 编辑。

## 资料与第四周起点

- [RFC 9110：202 Accepted](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3)：接收与完成要分开。
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)：数据库租户保护的能力与绕过边界。
- [WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)：事件 ID、重连与流格式。
- [React：Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)：前端避免矛盾状态。以上资料检索日期：2026-11-21。

第 22 天把本周的任务系统包进最小对话服务：会话、消息、模型上下文和一次有状态任务各有自己的事实边界。
