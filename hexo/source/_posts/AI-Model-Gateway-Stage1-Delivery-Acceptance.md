---
layout: post
title: "阶段项目一验收：多租户模型网关的最小交付与真实进度"
date: 2026-11-25 09:00:00.000
updated: 2026-11-25 09:00:00.000
permalink: /articles/AI-Model-Gateway-Stage1-Delivery-Acceptance.html
comments: true
description: "AI 全栈开发第 30 天：交付统一 ModelClient 与最小对话服务的模型网关项目说明，给出 API、持久化、流式恢复、预算和评测的最小实现契约，并按可见证据如实判定阶段结果。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "阶段项目"
  - "模型网关"
  - "ModelClient"
  - "对话服务"
  - "验收"
  - "面试"
---

第一个三十天的阶段产物应是**统一 `ModelClient` 与最小对话服务**，模型网关负责在其中完成模型选择、预算准入、事件归一化和用量对账。今天把分散在前 29 天的契约收成一个可以提交、运行和验收的项目，而不是再画一张平台全景图。

先说明本系列当前的证据边界：在共享博客仓库里，我能核查到文章与生成页面，**未见独立网关程序、测试报告或运行证据**。这不排除读者在其他仓库实现了项目；只是不能据此宣称本阶段代码已通过验收。下文明确最小交付物、运行命令的约定与当前判定。
<!--more-->

## 一、交付范围：先做一条能失败、能恢复的垂直链路

业务场景选两租户差旅政策问答。租户 A 和 B 问同一句“本月出差住宿报销上限是多少”，各自只见授权政策。首月**必交 P0** 用 FakeProvider 就能复现，不以真实付费模型、Kubernetes 或复杂 Agent 规划为前置条件：

| 模块 | 必交能力 | 应留下的可复核结果 |
| --- | --- | --- |
| 身份与租户 | `tenant_id` 从已验证身份进入服务端上下文；会话、任务、事件、引用按租户授权 | A/B 同问不同证据；B 读 A 的任务被拒 |
| 任务入口 | 一轮对话创建一个任务；同键同体返回同任务，同键异体冲突 | 并发重试后任务数、预算预留数均为 1 |
| `ModelClient` | 请求、能力要求、流事件、终态、usage 统一；至少一套 FakeProvider 和一套真实供应商适配契约 | 完成/失败/不完整事件能归一化，未知 usage 不记零 |
| 路由与预算 | 候选模型过能力、数据区域和成本门槛；调用前原子预留，结束后对账 | 不合格备用模型被拒，超预算请求无供应商 attempt |
| 持久化 | 任务、attempt、事件、usage 分开保存；发布版本随任务固定 | 重启后可查询任务，旧 Worker 不能覆盖新终态 |
| 流式页面 | SSE 用事件 ID 补播；连接断开不新建任务；页面显示真实终态与有权引用 | 第五事件后断线再连，不重复输出或调用模型 |
| 发布门槛 | Golden Set 分桶、脱敏 Trace、失败 Case、用量和容量报告 | 给出具体版本、分母、失败样本与 `GO / NO_GO` 理由 |

真实供应商接入、容器滚动发布和高并发压测是扩展项。若做了就用报告证明；若没做，就在项目说明中标 `NOT_RUN`，面试时不要说成“已上生产”。

### 推荐的最小接口

~~~text
POST /v1/conversations/{conversation_id}/turns  → 202 {task_id, status}
GET  /v1/tasks/{task_id}                     → 状态、结果摘要、引用、usage 状态
GET  /v1/tasks/{task_id}/events              → text/event-stream，支持 Last-Event-ID
POST /v1/tasks/{task_id}/cancel              → 持久化取消意图与当前状态
~~~

请求体只放用户问题、可选的业务参数和幂等键，**不接受客户端指定租户或供应商密钥**。`202 Accepted` 只表示已接收处理，不表示答案成功。[RFC 9110 §15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3)（检索日期：2026-11-25）

## 二、核心实现契约：让唯一任务与最终状态有数据库事实

一个可提交的工程至少需要 `conversation`、`message`、`task`、`attempt`、`event`、`usage`、`outbox` 七类事实。可以合表，但不能合并语义：消息是会话历史，任务是一次执行，attempt 是一次供应商调用，事件用于重放，usage 用于结算，Outbox 用于可靠唤醒 Worker。

~~~text
CREATE TURN（伪代码，事务内）
  1. 从认证主体解析 tenant_id、actor_id，校验 conversation 的当前权限。
  2. 以 tenant_id + actor_id + conversation_id + idempotency_key 建唯一约束。
  3. 若键已存在且规范化请求哈希相同，重新鉴权后返回原 task_id；
     若哈希不同，返回 409，不创建第二个任务。
  4. 选择满足能力/区域要求的模型，固定 route/registry/prompt/price 版本。
  5. 原子预留预算，写 task 与 outbox 意图，一次提交。

RUN TASK（Worker）
  6. 用租约与递增 fence 领取；每次供应商调用保存 attempt_id。
  7. 适配器把供应商事件写入 task_id 下递增的 event_id，并向 SSE 投递。
  8. 只在收到明确完成事件且业务/引用校验通过后置 SUCCEEDED；
     失败、不完整、取消分别落终态，usage 缺失标 PENDING 并对账。
~~~

PostgreSQL 的 `INSERT ... ON CONFLICT` 可在唯一约束上提供并发插入/更新的原子路径；实际实现还要比较请求哈希、锁定预算行，并避免把同键异体“更新成新请求”。[PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)（检索日期：2026-11-25）。行级安全策略可作为附加防护，但超级用户、带 `BYPASSRLS` 的角色及表所有者默认存在绕过边界，应用授权不能省。[PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)（检索日期：2026-11-25）

流式适配器必须区分终态：OpenAI Responses 有 `response.completed`、`response.failed`、`response.incomplete`；失败或不完整时 usage 可能为空。Anthropic 的 `message_delta.usage` 是累计量，流内可能有错误，工具参数片段不能提前执行。[OpenAI 流事件](https://developers.openai.com/api/reference/resources/responses/streaming-events)、[Anthropic 流消息](https://platform.claude.com/docs/en/build-with-claude/streaming)（检索日期：2026-11-25）。这就是统一 `ModelClient` 要解决的真实差异，而不是把两个 SDK 包装成同名方法。

如果用 Java/Spring MVC，可以用 `SseEmitter` 输出 SSE，但它只负责 HTTP 事件发送。Servlet 异步写可能阻塞，断开连接通常要等下一次写入或心跳才能发现；任务继续执行和按事件 ID 补播仍由持久化任务系统负责。[Spring MVC Asynchronous Requests](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html)、[WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)（检索日期：2026-11-25）

## 三、可以交给面试官复现的项目包

项目仓库建议提供下列文件；它们是**交付要求，不是声称当前博客仓库已有这些文件**：

~~~text
gateway-stage1/
├── README.md                  # 目标、范围、架构、命令和当前限制
├── src/                       # API、ModelClient、适配器、Worker、预算和鉴权
├── migrations/                # 任务、事件、attempt、用量等表与约束
├── fixtures/                  # 两租户政策、FakeProvider 事件、Golden Set
├── tests/                     # 单元、集成与故障注入
├── frontend/                  # 最小对话页与 SSE 恢复
└── acceptance/                # Day 29 约定的发布快照和运行报告
~~~

在 `README.md` 里给出**项目实际存在的**启动、测试和验收命令，以及成功退出码。若选择 Maven 和容器化 PostgreSQL，可用 `mvn verify` 作为 CI 入口，但要让项目自身提供可运行的数据库夹具；仅贴一条命令而没有可重复环境不算交付。下面的报告字段是推荐结构，数值留待真实运行填写：

~~~json
{
  "release_id": "stage1-candidate",
  "commit_sha": null,
  "environment": "local",
  "case_id": "A8-SSE-REPLAY",
  "status": "NOT_RUN",
  "task_id": null,
  "trace_id": null,
  "expected": "event_id > 5 被补播，provider_attempt_count = 1",
  "actual": null,
  "evidence_path": null
}
~~~

至少给七条必跑断言：双租户跨读拒绝、同键并发不双建、预算最后余额并发只放行合法调用、供应商先输出后失败不置成功、SSE 断线只重放事件、权限撤销后旧引用失效、usage 未知进入待对账。失败与未运行都要保留，不能把七条之外的通过率稀释安全问题。Trace 要能从 `task_id → attempt_id → provider_request_id` 找到路由版本、终态和用量来源；Trace ID 是诊断索引，不替代任务数据库的事实。[OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)（检索日期：2026-11-25）

Golden Set 至少覆盖授权正确答案、无权文档诱导、格式正确但判断错误、供应商失败/不完整四类；报告样本分母与逐桶结果。压测针对完整任务而非仅提交接口，记录真实到达率、`dropped_iterations`、任务首字/完成 p95、活跃连接和主动拒绝率；阈值应在运行前冻结，k6 的 `thresholds` 失败会让进程返回非零状态，丢迭代说明目标负载可能没有真正打进系统。[k6 Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)、[Dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/)（检索日期：2026-11-25）

## 四、今天的验收结论与复盘

下表只依据**当前共享博客仓库**中可见的实物填写，不能推断用户在其他仓库的进度：

| 交付项 | 当前可核查状态 | 阶段判定 |
| --- | --- | --- |
| Day 1–29 的技术文章、项目规格与验收模板 | 源文和博客页面可检查 | 文档已形成；不是网关程序 |
| 可启动的 `ModelClient`、任务 API、数据库迁移、前端 | 本仓库未见对应工程 | `NOT_VERIFIED` |
| 固定版本的逐 Case 报告、Golden Set、容量与安全结果 | 本仓库未见运行证据 | `NOT_VERIFIED` |
| 多副本发布或真实供应商联调 | 本仓库未见运行证据 | `NOT_VERIFIED`，且非首月 P0 必交 |

因此，**对“本仓库已经交付并验收通过模型网关”这一主张，本次结论为 `NO_GO（证据不足）`**；这不等于代码一定不存在或设计失败。若项目另有仓库，将源码 commit、运行命令和 Day 29 证据包关联进来，再按同一门槛重判。文档发布成功只能证明文章上线，不能证明 AI 服务上线。

本月最明显的收获是把模型调用逐步拆成可恢复的任务、可替换的适配器、可追责的用量和可回归的发布；最明显的缺口是缺少一个能让第三方从零运行并重放失败的项目仓库。第 31 天进入 Tool Calling 与工具契约，建议并行补齐这个 P0 工程；工具调用会在现有权限、幂等、审批和审计边界上继续扩展，而不是绕开它们。

## 五、今日面试题（检索日期：2026-11-25）

以下题目优先取自可直接阅读的近期公开来源。若公司或场次来自求职者自述，未获企业官方核验；参考答案和追问是本文的工程归纳，并非企业标准答案。

### 1. 某个 Agent 执行出错，怎样处理？

- **方向 / 难度**：Agent 运行时、失败恢复 / 难。
- **参考答案**：先按可重试、不可重试、结果未知分类；持久化任务状态、attempt、步骤检查点和错误类型。只有满足幂等、预算与截止时间要求的步骤才有界重试；外部写操作结果未知时先查询或对账。终态和前端提示都以持久化事实为准，不能靠捕获异常后统一再跑一遍。
- **追问**：工具请求已经发出，但回执丢失，能直接重试吗？仅当下游支持同一幂等键且结果可核验时才可安全重试；否则进入待对账或人工处理。
- **来源**：[牛客“多益 AI 应用开发工程师一面”求职者自述](https://www.nowcoder.com/discuss/954797826817458176?sourceSSR=dynamic&weFlow=true)，页面显示 11-24；企业与场次未获官方核验。

### 2. 意图识别、槽位提取、工具调用串成多阶段链路，To C 延迟怎么处理？

- **方向 / 难度**：Agent 链路性能、模型路由 / 难。
- **参考答案**：先测各阶段排队、首字和完成耗时，找真正的串行关键路径；把能用确定性规则完成的路由前置，对互不依赖步骤并行，给每阶段设置总截止时间内的预算，缓存安全且版本稳定的中间结果。质量、权限与工具审计仍是硬门槛，不能只靠删步骤换低延迟。
- **追问**：缩短链路后工具误调用增加怎么办？以错误调用率和高风险工具 Case 作发布门槛，必要时恢复校验步骤或人工审批，而不是用平均延迟收益覆盖副作用风险。
- **来源**：[牛客“蚂蚁集团 Agent 应用方向一面”求职者自述](https://www.nowcoder.com/feed/main/detail/94b9da3ece204c8396942853fd5b9a33?sourceSSR=%E5%85%B6%E4%BB%96)，页面显示 11-21；企业与场次未获官方核验。

### 3. 已经在全公司上线了吗？Android、iOS 都覆盖了吗？是否强制卡合入？

- **方向 / 难度**：上线范围、项目陈述 / 中高。
- **参考答案**：逐维度回答实际覆盖：哪些租户、团队、端、版本和流量比例；哪些只是本地、灰度或建议性检查。拿出部署记录、客户端版本分布、CI 门禁配置、评测分母和真实使用数据。尚未覆盖的端或团队明确标 `NOT_RUN`；不能把一个演示环境说成全公司上线。
- **追问**：只有本地 FakeProvider 演练，可以说“已上线模型网关”吗？不能；只能说本地端到端演示通过了哪些 Case，真实流量、供应商和运维门槛仍待验证。
- **来源**：[牛客“小红书一面”求职者自述](https://www.nowcoder.com/feed/main/detail/ac7f568525c349e29b308af571744332?sourceSSR=dynamic&weFlow=true)，页面显示 11-16；公司和场次未获官方确认。

### 4. 旧客户端还在用旧接口，新服务改为任务语义，怎样做兼容验证和灰度？

- **方向 / 难度**：API 兼容、阶段项目灰度 / 难。
- **参考答案**：先列客户端 × API × 服务版本矩阵；旧接口通过明确的适配层映射任务状态。契约测试覆盖完成、失败、断线补播、取消、游标过期、未授权读取和同键重试。按客户端版本或租户稳定分桶灰度，观察协议错误、卡住任务与用量，保留回滚路径；有副作用的请求不能通过双跑验证。
- **追问**：入口回滚后旧服务不认识新版本创建的在途任务，怎么办？保留兼容 Worker 或按任务绑定的执行版本路由到原 Worker 至终态，不能只切回入口流量。
- **来源**：[牛客“字节跳动 AI Agent 开发工程师三面”求职者自述](https://www.nowcoder.com/discuss/953075892136259584?sourceSSR=post)，页面显示 11-19；企业与场次未获官方核验。

## 资料

- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)与[Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)：并发唯一约束与权限纵深防护。
- [Spring MVC Asynchronous Requests](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html)与[WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)：SSE 传输与重连协议。
- [OpenAI Responses streaming events](https://developers.openai.com/api/reference/resources/responses/streaming-events)与[Anthropic Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)：模型事件和用量差异。
- [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)与[k6 Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)：诊断链路和容量门槛。以上资料检索日期均为 2026-11-25。
