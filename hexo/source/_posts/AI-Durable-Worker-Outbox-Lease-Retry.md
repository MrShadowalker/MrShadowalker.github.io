---
layout: post
title: "异步 Worker 怎么可靠执行：租约、Outbox 与有界重试"
date: 2026-11-13 09:00:00.000
updated: 2026-11-21 09:00:00.000
permalink: /articles/AI-Durable-Worker-Outbox-Lease-Retry.html
comments: true
description: "AI 全栈开发第 18 天：把持久化 Agent 任务交给 Worker，处理任务已落库但消息未发、重复投递、租约过期、旧 Worker 写回及失败重试。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "异步任务"
  - "Outbox"
  - "Worker"
  - "面试"
---

补刊说明：本文补齐原定学习日；资料与题目于 2026-11-21 检索核验。

第 17 天已经有了任务、attempt、事件和用量表。现在最危险的窗口是：API 成功插入 <code>ai_task</code> 后进程崩溃，消息没有发到队列；或者消息发了两次，两个 Worker 都以为自己应该执行。第 18 天用**事务 Outbox + 条件领取 + 租约和 Fencing Token**把这些窗口缩到可回放的状态。
<!--more-->

## 一、明确要保证的事实

我们要求：

- 请求接收成功后，任务及“需要调度”的意图在同一数据库事务持久化。
- 队列消息允许重复，Worker 每次执行仍须验证任务状态、租约与版本。
- 进程崩溃后可恢复；结果未知时保留 attempt 和待对账状态。
- 重试只针对可恢复故障，受任务截止时间、次数、成本和下游限额约束。

跨数据库和消息队列不要轻易声称“严格恰好执行一次”。这里采用**至少一次投递 + 业务幂等 + 可对账状态**。供应商模型调用可能因重试重复计费，外部写工具更需稳定业务幂等键和回执查询。

## 二、提交任务时写 Outbox

接续第 17 天的 <code>ai_task</code>，新增一张事件 Outbox 表：

~~~sql
CREATE TABLE outbox_event (
  event_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  task_id uuid NOT NULL,
  event_type text NOT NULL,
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (tenant_id, dedupe_key),
  FOREIGN KEY (tenant_id, task_id)
    REFERENCES ai_task (tenant_id, task_id)
);

BEGIN;
-- 此事务先按认证上下文设置 app.tenant_id，再做幂等与预算检查。
INSERT INTO ai_task (
  tenant_id, task_id, created_by, endpoint, idempotency_key,
  request_hash, status, route_release, knowledge_snapshot
) VALUES (
  :tenant_id, :task_id, :principal_id, '/v1/tasks', :key,
  :request_hash, 'QUEUED', :route_release, :knowledge_snapshot
);
INSERT INTO outbox_event (
  event_id, tenant_id, task_id, event_type, dedupe_key, payload
) VALUES (
  :event_id, :tenant_id, :task_id, 'TASK_QUEUED',
  :dedupe_key,
  jsonb_build_object('task_id', :task_id)
);
COMMIT;
~~~

示意 SQL 省略了同键冲突读取和预算预留实现；这两步必须在提交前按第 16、17 天契约补齐。Outbox 表也必须有租户隔离策略；跨租户发布器使用单独的、受审计的服务角色，不应把高权限角色给普通 API。

上表含 <code>published_at</code>，适合**轮询发布器**：发送到 broker 并得到确认后再标记已发布；两步之间仍可能崩溃，因此消费者必须去重。若改用 Debezium CDC 的 Outbox Event Router，应按其默认字段或配置映射调整表结构，保持 Outbox **只追加 INSERT**，不要再更新 <code>published_at</code>；该 SMT 会把 UPDATE 视作异常操作。Debezium 把 Outbox 作为缓解数据库状态与对外事件不一致的模式，但不保证下游业务严格执行一次。[Debezium Outbox Event Router 源文档](https://github.com/debezium/debezium/blob/main/documentation/modules/ROOT/pages/transformations/outbox-event-router.adoc)（检索日期：2026-11-21）

## 三、Worker 领取时取得一个递增凭证

消息只告诉 Worker “某个任务可能需要执行”，**不是执行许可**。Worker 先核验消息的 <code>event_id</code> 与受信 Outbox 记录，再读数据库条件领取对应任务。下面的语句假设 <code>tenant_id / task_id</code> 已从受信记录解析；实际实现还要处理 RLS 授权、租户分区与公平性，不能直接把未经验证的消息字段当租户授权。

~~~sql
WITH candidate AS (
  SELECT tenant_id, task_id
    FROM ai_task
   WHERE tenant_id = :tenant_id
     AND task_id = :task_id
     AND (
       (status IN ('QUEUED', 'RETRY_WAIT') AND next_run_at <= now())
       OR (status = 'RUNNING' AND lease_until < now())
     )
     AND (lease_until IS NULL OR lease_until < now())
   FOR UPDATE SKIP LOCKED
   LIMIT 1
)
UPDATE ai_task AS t
   SET status = 'RUNNING',
       lease_owner = :worker_id,
       lease_until = now() + interval '30 seconds',
       fence = t.fence + 1,
       status_version = t.status_version + 1
  FROM candidate AS c
 WHERE t.tenant_id = c.tenant_id
   AND t.task_id = c.task_id
 RETURNING t.tenant_id, t.task_id, t.fence;
~~~

PostgreSQL 文档说明 <code>SKIP LOCKED</code> 会跳过当前无法立即加锁的行，得到的视图不适合一般一致性查询，但适合队列式消费场景。[PostgreSQL SELECT](https://www.postgresql.org/docs/current/sql-select.html)（检索日期：2026-11-21）。上面的事务领取完成后立即提交；在同一短事务中创建递增 attempt_no 的 <code>ai_attempt</code>，接下来才执行模型或工具网络调用。过期的 RUNNING 任务被接管后，必须先核对上一次 attempt 和外部动作状态，不能直接从头执行。

Worker 定时续租时要求 <code>task_id + lease_owner + fence</code> 均匹配，且旧租约尚未过期；完成写回也须同时检查 <code>lease_until > now()</code>。旧 Worker 即使在租约过期后才从慢调用返回，也不能覆盖任务状态。**租约过期不等于旧 Worker 进程已停止**，因此 Fencing Token 必须由数据库单调增加，并在受控写入端验证。若外部系统不支持 Fencing Token，仍可能出现旧 Worker 的外部副作用；要依赖动作幂等键、结果查询和对账。

还需要一个**独立租约扫描器**：broker 消息可能已经确认，Worker 却在领取后崩溃，此时不会有新消息自动到来。扫描器周期性查找过期的 <code>RUNNING</code>，在短事务内锁定任务，按 <code>task_id + fence</code> 生成唯一的 <code>LEASE_EXPIRED</code> Outbox 事件，等待发布器重新通知 Worker。上表的 <code>dedupe_key</code> 唯一约束用于防止同一代次反复补发；原始 <code>TASK_QUEUED</code> 的键可写为 <code>task_id:queued</code>，恢复事件可写为 <code>task_id:lease-expired:fence</code>。接管者仍要先核对旧 attempt 和外部动作，再决定续跑、对账或终止。

## 四、失败分类与有界重试

| 失败 | 任务处理 | 是否直接重试 |
| --- | --- | --- |
| 临时网络失败，确定未执行 | 记录 attempt，按指数退避加抖动设 <code>next_run_at</code> | 可，在截止时间和总预算内 |
| 429 带等待时间 | 按供应商错误语义与 <code>Retry-After</code> 排程 | 等待超过 deadline 则不重试 |
| 参数错误、无权限、配额硬上限 | 记稳定错误码，任务失败或待人工处理 | 否 |
| 外部写动作回执丢失 | 进入 <code>RECONCILING</code>，查下游操作状态 | 不盲目重放 |
| 已向用户输出部分流式内容 | 事件记录部分结果，结束当前流代次 | 不静默拼接新模型输出 |

所有重试都增加新的 <code>attempt_id</code>，单独记供应商请求 ID、用量与可能的费用。第 N 次仍失败时进入明确的 <code>FAILED</code> 终态或人工队列，保存原因；“死信”是可排查的持久化入口，不是把消息丢弃。队列长度、最老等待时间、重试次数、租约失效、重复投递、每成功任务成本都要进入观测。

## 五、一次故障演练

用 FakeModelClient 与虚拟时钟模拟五次崩溃窗口：

1. 任务和 Outbox 提交后、消息发布前崩溃：恢复后 Outbox 仍能发布。
2. 消息发布后、<code>published_at</code> 更新前崩溃：消息重复，但只有一个领取者进入有效租约。
3. Worker 调用模型后崩溃、usage 未写入：留下 attempt 的未知用量，进入对账。
4. 租约到期，新 Worker 已领取，旧 Worker 才返回：旧 Worker 的 <code>fence</code> 写回失败；外部副作用按幂等回执核对。
5. 消息已确认，Worker 崩溃且没有再次投递：独立扫描器发现过期租约，写出唯一恢复事件；新 Worker 先核对旧 attempt。

输出 <code>task_id / attempt_id / event_id / fence / trace_id</code> 的逐步时间线，以及每个窗口的任务状态与账本状态。若能把上述五种情况都回放，才算真正理解“异步化”，而非只会调用一个后台任务函数。FastAPI 的 <code>BackgroundTasks</code> 可在响应后运行进程内工作，但长期任务需要能跨进程恢复的持久化调度；官方文档也把重计算和多服务器执行指向独立任务队列方案。[FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)（检索日期：2026-11-21）

## 六、今日面试题（检索日期：2026-11-21）

以下题面来自牛客可直接查看正文的用户自述。企业归属均未获官方核验；参考答案和追问由本文整理，不代表企业标准答案。

### 1. 消息丢失可能发生在哪些环节？生产者确认和消费者确认分别解决什么？

- **方向 / 难度**：消息队列、Agent 异步任务 / 难。
- **参考答案**：任务落库后未发布、发布后未得到 broker 确认、broker 持久化或复制故障、消费者拿到消息后未提交业务就确认、提交业务后未确认导致重投，都是不同窗口。任务与 Outbox 同事务解决第一类；broker 确认解决发布可见性；消费者确认结合数据库幂等与状态更新处理重复。
- **追问**：业务已写成功、消费者确认前宕机，为什么下一次消费不能再调一次模型或写工具？
- **来源**：[牛客“快手 AI 全栈一面”用户自述](https://www.nowcoder.com/discuss/947982288917110784?sourceSSR=enterprise)，正文列出消息丢失、生产者与消费者确认；企业归属未获官方核验。

### 2. Lease 过期后旧 Worker 又返回，怎样避免旧结果覆盖新结果？

- **方向 / 难度**：分布式任务、并发控制 / 难。
- **参考答案**：租约过期只允许新 Worker 接管，不会杀死旧 Worker。每次领取递增 <code>fence</code>；续租和写回按 owner、fence、状态条件更新，旧值写入失败。外部系统若无法识别 fence，还需要稳定业务幂等键和对账。
- **追问**：两个 Worker 都对不支持幂等的外部服务发起写入，数据库 fencing 能否保证下游只执行一次？不能，需在下游或业务协议里补保证。
- **来源**：[牛客“快手大模型 Agent 研发一面”用户自述](https://www.nowcoder.com/discuss/932315325276618752?sourceSSR=dynamic&weFlow=true)，正文直接列出 Lease 和 Fencing Token 追问；企业归属未获官方核验。

### 3. 消费失败重试几次，超过次数进死信还是丢弃？

- **方向 / 难度**：Worker 恢复、重试策略 / 中高。
- **参考答案**：先按错误语义分类。临时错误在总 deadline、最大 attempt、成本与下游容量内退避重试；永久错误立即终止；结果未知的副作用先对账。超出界限后记录终态和可排查死信，不静默丢弃。核心业务还要有人工处理与补偿入口。
- **追问**：一千个任务同时遭遇 429，如何防重试风暴？分散抖动、按租户和模型池限流，并把重试流量计入准入预算。
- **来源**：[牛客“快手 AI 全栈一面”用户自述](https://www.nowcoder.com/discuss/947982288917110784?sourceSSR=enterprise)，正文列出消费失败与死信追问；企业归属未获官方核验。

## 资料与下一步

- [Debezium Outbox Event Router 源文档](https://github.com/debezium/debezium/blob/main/documentation/modules/ROOT/pages/transformations/outbox-event-router.adoc)：CDC 方案的默认字段与仅追加约束。
- [PostgreSQL SELECT](https://www.postgresql.org/docs/current/sql-select.html)：<code>SKIP LOCKED</code> 的用途与限制。
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)：响应后任务与独立 Worker 的边界。资料检索日期均为 2026-11-21。

第 19 天可把持久化事件接到前端：先定义 SSE 事件顺序、断线补播和终态，而不是把模型原始 Token 直接透传给浏览器。
