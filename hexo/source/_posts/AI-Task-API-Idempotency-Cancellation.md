---
layout: post
title: "任务 API 怎么定：幂等键、错误契约与取消语义"
date: 2026-11-11 09:00:00.000
updated: 2026-11-21 09:00:00.000
permalink: /articles/AI-Task-API-Idempotency-Cancellation.html
comments: true
description: "AI 全栈开发第 16 天：为长时 Agent 任务设计提交、查询、事件和取消接口，讲清幂等键、HTTP 状态码、错误契约及外部副作用边界。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "API设计"
  - "幂等"
  - "任务状态机"
  - "面试"
---

补刊说明：本文补齐原定学习日；资料与题目于 2026-11-21 检索核验。

第 15 天的 <code>/v1/answers</code> 适合验证一条短请求链。但 Agent 任务可能检索、调模型、等待工具、等人审批，单个 HTTP 请求不应一直占着连接。第 16 天先把**提交任务、查状态、读事件、请求取消**定成稳定 API，再决定怎样实现队列和数据库。
<!--more-->

## 一、先把“接受请求”和“完成任务”分开

建议的最小契约如下。路径、字段和错误码是本文的工程约定，团队可调整，但客户端与服务端必须共享一份版本化规范。

| 操作 | 请求 | 成功响应 | 核心语义 |
| --- | --- | --- | --- |
| 提交 | <code>POST /v1/tasks</code>，带 <code>Idempotency-Key</code> | 202，<code>Location: /v1/tasks/{task_id}</code> | 已持久化并等待执行，任务尚未成功 |
| 查询 | <code>GET /v1/tasks/{task_id}</code> | 200，状态、版本、结果或错误 | 只允许任务所属租户与授权用户查看 |
| 事件 | <code>GET /v1/tasks/{task_id}/events?after=17</code> | 200 <code>text/event-stream</code>，按序推送事件 | SSE 断线后从确认序号补读 |
| 取消 | <code>POST /v1/tasks/{task_id}/cancel</code> | 202，<code>CANCEL_REQUESTED</code> | 接收取消意图，不承诺外部动作已撤销 |

RFC 9110 定义 202 为已接受处理但尚未完成，处理也可能最终不被执行；因此 202 响应必须给客户端可查询的任务地址和状态。[RFC 9110 §15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3)（检索日期：2026-11-21）

~~~json
{
  "task_id": "task-7f0a",
  "status": "QUEUED",
  "status_version": 1,
  "trace_id": "trace-20261111-17",
  "links": {
    "self": "/v1/tasks/task-7f0a",
    "events": "/v1/tasks/task-7f0a/events"
  }
}
~~~

任务对象保存租户、创建者、规范化请求摘要、知识/Prompt/路由配置版本、截止时间与预算。响应只给必要的状态和链接，不回显原始企业文档。

## 二、幂等键要有范围、指纹和保留期

“客户端超时重发”与“用户真的要新建第二个任务”必须区分。入口生成 <code>request_hash</code>，定义唯一范围为 <code>(tenant_id, principal_id, endpoint, idempotency_key)</code>，其中 <code>principal_id</code> 来自认证上下文而非请求体：

1. 第一次提交：同一数据库事务中插入任务和幂等记录，返回新任务的 202。
2. 同键、同规范化请求：返回原 <code>task_id</code> 的当前状态，不创建第二个任务。
3. 同键、不同请求指纹：返回 409 <code>IDEMPOTENCY_MISMATCH</code>，让客户端换键或纠正请求。
4. 并发首次提交：由数据库唯一约束决定胜者，败者读取已提交任务；不能先 <code>SELECT</code> 再无约束 <code>INSERT</code>。

~~~sql
CREATE UNIQUE INDEX ux_task_idempotency
ON ai_task (tenant_id, created_by, endpoint, idempotency_key);
~~~

指纹应覆盖会改变业务结果的规范化输入，包括目标、授权资源范围和客户端指定的任务选项；服务端选出的模型发布版本则作为创建结果固定在任务中。记录需要明确保留期，并与任务保存期和业务重试窗口一致。IETF 对 <code>Idempotency-Key</code> 的文档截至检索日仍是 **Internet-Draft，不是正式 RFC**；它描述了同键不同载荷、并发请求及过期策略，本文采用其设计思路，具体协议以自己的 API 文档为准。[IETF Idempotency-Key 草案](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)（检索日期：2026-11-21）。PostgreSQL 的 <code>ON CONFLICT</code> 与唯一索引可承担原子冲突处理。[PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)（检索日期：2026-11-21）

幂等键不能替代**外部写操作幂等**：一个任务可重试多次，调用“发邮件、退款、提交审批”时还要给每个业务动作稳定的 <code>action_key</code>，保留执行回执。客户端请求幂等、任务执行幂等和外部业务幂等是三层不同契约。

## 三、错误模型要让前端知道下一步

~~~json
{
  "error": {
    "code": "TASK_CONFLICT",
    "message": "任务状态已变化，请刷新后重试",
    "retryable": false,
    "trace_id": "trace-20261111-17",
    "details": {"current_status": "SUCCEEDED"}
  }
}
~~~

| HTTP 状态 | 稳定业务码示例 | 前端动作 |
| --- | --- | --- |
| 400/422 | <code>INVALID_REQUEST</code> | 修正字段或格式，不自动重试 |
| 401/403 | <code>UNAUTHENTICATED / FORBIDDEN</code> | 登录或提示无权限，不降级绕过 |
| 404 | <code>TASK_NOT_FOUND</code> | 对无权跨租户任务也可统一返回 404，避免枚举 |
| 409 | <code>IDEMPOTENCY_MISMATCH / TASK_CONFLICT</code> | 读取当前任务，再决定是否发新意图 |
| 429 | <code>TENANT_QUOTA_EXCEEDED</code> | 按业务策略等待或提醒，不无限重试 |
| 503 | <code>UPSTREAM_UNAVAILABLE</code> | 仅在任务未接收或明确可安全重试时重发 |

HTTP 状态用于大类，<code>error.code</code> 用于稳定业务处理；<code>message</code> 可以本地化，不能让前端解析文案。409 表示与资源当前状态冲突，适合“终态任务无法再取消”等冲突；具体业务码仍由应用定义。[RFC 9110 §15.5.10](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10)（检索日期：2026-11-21）

## 四、取消是一条状态转换，不是断开 SSE

~~~text
QUEUED → RUNNING → SUCCEEDED
   │        │  ↘ FAILED / RETRY_WAIT
   └────────┴→ CANCEL_REQUESTED → CANCELLED
                       ↘ RECONCILING → SUCCEEDED / FAILED
~~~

入口只在允许取消的状态下用 <code>status_version</code> 条件更新到 <code>CANCEL_REQUESTED</code>；worker 在每个安全点检查，停止后续模型和工具步骤，并在可以确认无未完成副作用时置为 <code>CANCELLED</code>。若外部写操作已发送但回执丢失，状态是 <code>RECONCILING</code>，应查询真实业务结果或执行受控补偿，不能立即向用户声称取消成功。SSE 连接关闭只代表客户端不再订阅，后台任务继续还是取消取决于独立业务策略。

事件流里的 <code>seq</code> 由任务级持久化计数器递增。前端用 <code>after</code> 补读，必须去重；实时推送只改善体验，**数据库任务状态仍是事实源**。

## 五、今天的练习与验收

写一份 OpenAPI 契约或接口夹具，至少回放六种情况：首次提交、同键同体重发、同键异体、两个并发提交、任务完成后取消、外部写动作结果未知时取消。逐个给出 HTTP 状态、业务码、任务状态和是否允许新供应商调用。验收硬条件是同一业务意图不会创建两条任务，取消不能隐瞒未知副作用，跨租户读取被拒绝。

## 六、今日面试题（检索日期：2026-11-21）

以下题面来自牛客公开页面；公司归属是作者自述或社区整理，均未获企业官方核验。参考答案和追问由本文整理。

### 1. Redis 做幂等，处理时间超过 key TTL 会怎样？

- **方向 / 难度**：AI 全栈后端、消息幂等 / 难。
- **参考答案**：TTL 到期后第二个消费者可能拿到同一个业务键；若第一个仍在执行，就会并发重复。Redis 锁要有唯一持有者、续租与原子比较删除，但业务结果仍应由持久化唯一约束和操作回执保护；不能把短 TTL 锁当最终幂等事实。
- **追问**：第一次已提交外部写入、响应丢失，此时锁又过期，重试如何避免第二次写入？使用稳定业务动作键，先查下游回执或进入对账。
- **来源**：[牛客“快手 AI 全栈一面”用户自述](https://www.nowcoder.com/discuss/947982288917110784?sourceSSR=enterprise)，正文直接列出 TTL 追问；企业归属未获官方核验。

### 2. Agent 的状态机如何阻止非法状态转换？

- **方向 / 难度**：任务 API、并发控制 / 中高。
- **参考答案**：明确状态、事件、前置条件和可达边；更新时用 <code>WHERE status = :expected AND version = :version</code> 原子比较更新，失败就读取最新状态并返回冲突。模型输出只是候选动作，不得自行改任务状态。
- **追问**：取消与成功同时写入，哪一个生效？由条件更新和真实外部回执决定，不凭请求到达顺序猜。
- **来源**：[牛客“shopee Agent 开发一面”公开整理帖](https://www.nowcoder.com/discuss/928765054617415680)，正文有状态机题；帖子真实性和公司归属无法独立核验。

### 3. Agent 执行到一半中断，怎样保存状态并处理已发出的写操作？

- **方向 / 难度**：Agent Runtime、取消与副作用 / 难。
- **参考答案**：持久化任务目标、状态、已完成节点、待执行动作、版本、工具回执和幂等键。恢复或取消前先确认外部操作真实状态；回执未知则进入对账，不能把断连当成撤销，也不能盲目重放写动作。
- **追问**：关闭 SSE 连接是否应该取消任务？默认不等同，需看明确的业务契约。
- **来源**：[牛客“AI Agent 高频工程面试 80 问”社区题库第 19 题](https://www.nowcoder.com/discuss/950800001213464576)，公开正文可核对；**社区整理题，非可核验的大厂原题**。

## 资料与下一步

- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)：202 与 409 的 HTTP 语义。
- [IETF Idempotency-Key 草案](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)：仍为工作草案，不应称为已发布标准。
- [PostgreSQL INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html)：并发唯一冲突处理。资料检索日期均为 2026-11-21。

第 17 天用 PostgreSQL 把任务、attempt、事件与用量数据落地，并让每条记录带租户范围。
