---
layout: post
title: "Agent 工具执行器怎样处理超时、重复调用与错误分类"
date: 2026-11-28 09:00:00.000
updated: 2026-11-28 09:00:00.000
permalink: /articles/AI-Agent-Tool-Executor-Timeout-Dedup-Error-Taxonomy.html
comments: true
description: "AI 全栈开发第 33 天：用工具执行账本、稳定业务操作 ID、发送后结果未知与对账流程，落地 Agent 工具的超时、去重和错误分类；附四道有来源的面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "Agent"
  - "Tool Calling"
  - "执行器"
  - "幂等"
  - "面试"
---

[第 31 天](/articles/AI-Agent-Tool-Calling-Proposal-Execution-Contract.html)把模型提议和实际执行分开，[第 32 天](/articles/AI-Agent-Tool-Schema-Registry-Version-Compatibility.html)固定了工具版本。现在请求真的要发出去：Worker 发起写操作后等到超时，它能不能告诉模型“失败了，请再调用一次”？**不能。**本地没等到响应，只能证明没有收到响应，不能证明下游没有写成功。

[早期 Runtime 文章](/articles/AI-Agent-Runtime-State-Machine.html)讲过幂等和对账原则。本篇把原则收窄到**一次工具动作的可实施账本**：同一个动作的重复投递、发送后崩溃、晚到回执和参数变化，分别落到什么状态。以下 SQL、状态和测试是练习设计，尚非第 30 天模型网关项目的已运行实现。
<!--more-->

## 一、先把四种 ID 分开

| ID | 范围与用途 | 重试时是否改变 |
| --- | --- | --- |
| `provider_call_id` | OpenAI `call_id` 或 Claude `tool_use_id`，用于把结果配回模型回合 | 新模型提议可能改变；不能当业务幂等键 |
| `action_id` | 服务端为**一次业务意图**分配并持久化的 ID | 同一动作的恢复、队列重投不变；用户确认第二次同类动作则新建 |
| `operation_key` | 传给下游的幂等键，由租户作用域和 `action_id` 派生 | 同一动作的所有网络尝试必须相同 |
| `attempt_id` | 每次真实网络尝试的观测与计费 ID | 每发一次都新建 |

例如用户批准“给工单 T-17 添加这一条评论”，服务端建立 `action_id=A`。队列重投或 Worker 换机仍使用 A 和同一个 `operation_key`；用户后来明确要求再添加一条相同文字的评论，才建立 `action_id=B`。**只把 `tool_name + 参数哈希` 当键会错误合并这两个合法动作**；把每次发送时间戳放进键又会让同一动作的重试失去去重能力。参数规范化摘要应绑定在 A 上，作用是发现“同键改参数”，不能替代业务意图 ID。AWS 的幂等 API 设计也讨论了客户端请求 ID、同 ID 不同参数与迟到请求的处理。[AWS Builders Library：Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)（检索日期：2026-11-28）

## 二、落一张工具动作账本，不靠内存锁

下面是 PostgreSQL 示意表。`request_digest` 覆盖固定工具版本、目标资源与**有业务含义**的规范化参数；不把原始敏感正文放进日志。`operation_key` 需在所选下游服务的幂等作用域内唯一，且保留期覆盖本系统的最长恢复窗口。

~~~sql
CREATE TABLE tool_execution (
  tenant_id uuid NOT NULL,
  action_id uuid NOT NULL,
  task_id uuid NOT NULL,
  step_id text NOT NULL,
  tool_name text NOT NULL,
  tool_version text NOT NULL,
  request_digest bytea NOT NULL,
  operation_key text NOT NULL,
  state text NOT NULL CHECK (state IN (
    'PREPARED', 'DISPATCHING', 'SUCCEEDED',
    'DEFINITIVE_FAILED', 'OUTCOME_UNKNOWN',
    'RECONCILING', 'MANUAL_REVIEW'
  )),
  version bigint NOT NULL DEFAULT 0,
  lease_owner text,
  lease_until timestamptz,
  deadline_at timestamptz NOT NULL,
  receipt_ref text,
  PRIMARY KEY (tenant_id, action_id),
  UNIQUE (tenant_id, operation_key)
);

CREATE TABLE tool_attempt (
  attempt_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  action_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  transport_status text,
  provider_request_id text,
  FOREIGN KEY (tenant_id, action_id)
    REFERENCES tool_execution (tenant_id, action_id)
);
~~~

首次提议经完整参数校验、服务端授权和预算检查后，短事务插入 `PREPARED`。重复投递尝试插入同一 `(tenant_id, action_id)` 时，由唯一约束拦住；读取已有记录并核对 `request_digest`，**同键不同载荷报冲突**，绝不静默沿用旧回执。Worker 用条件更新和递增 `version` 领取，在发送前持久化 `DISPATCHING` 与 `attempt_id`；网络调用放在事务外。PostgreSQL 的 `INSERT ... ON CONFLICT` 可原子处理本地唯一冲突，但这个数据库约束**不能替外部系统保证恰好执行一次**。[PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)（检索日期：2026-11-28）

~~~sql
-- 在短事务中领取；仅示意一次 PREPARED -> DISPATCHING。
UPDATE tool_execution
   SET state = 'DISPATCHING',
       version = version + 1,
       lease_owner = :worker_id,
       lease_until = :lease_until
 WHERE tenant_id = :tenant_id
   AND action_id = :action_id
   AND state = 'PREPARED'
   AND version = :observed_version
   AND deadline_at > now()
 RETURNING operation_key, version;
-- 只有返回一行才可在同一事务插入 tool_attempt，然后提交并发送。
~~~

`lease_until` 按单次调用超时设置或由持有者续租；领取前还要重新检查当前权限、任务取消状态和风险审批，不能只信创建 `PREPARED` 时的判断；第 34 天详述这些门槛。租约扫描器发现过期的 `DISPATCHING` 时，按 `version` 条件转成 `OUTCOME_UNKNOWN`，随后由对账器接管。旧 Worker 即使拿到晚到回执，也不能用旧版本覆盖新状态；对账器仍要用回执或远端查询确认实际副作用。

租约过期后接管者不能直接再次发送：旧 Worker 可能还在运行。它先按同一 `operation_key` 查远端状态；若下游不支持查询，则依据明确的幂等协议决定是否重发。若既不能查、也不保证同键去重，写动作进入 `MANUAL_REVIEW`，不能把“超时重试两次”写成可靠性方案。Stripe v1 的幂等文档是**具体产品语义的例子**：同键复用首次执行后的状态码和响应体，参数不一致报错，但键可在至少 24 小时后清理；不能把该保留期推广到所有工具或跨越它继续盲重试。[Stripe API v1：Idempotent requests](https://docs.stripe.com/api/idempotent_requests)（检索日期：2026-11-28）

## 三、发送前与发送后的错误要分开

~~~text
PREPARED --领取并落盘--> DISPATCHING --明确成功回执--> SUCCEEDED
                                  |--明确且无副作用的拒绝--> DEFINITIVE_FAILED
                                  |--响应丢失/超时/崩溃--> OUTCOME_UNKNOWN
OUTCOME_UNKNOWN --开始回查--> RECONCILING
RECONCILING --查到成功--> SUCCEEDED
RECONCILING --经下游保证未执行--> PREPARED 或 DEFINITIVE_FAILED
RECONCILING --无法确认且无安全重发能力--> MANUAL_REVIEW
~~~

`DISPATCHING` 是**保守状态**：即使 Worker 在写下它后、真正发包前崩溃，恢复时也先按“可能发出”处理。这样可能多一次回查，却不会把已完成的写入当成未执行。远端查询返回“暂时查不到”也未必等于没执行，除非下游契约保证该查询的否定结果足以判定未发生。

| 观察到的情况 | 本地判断 | 自动处理 |
| --- | --- | --- |
| Schema、权限或预算在发送前拒绝 | 明确未调用 | 记录拒绝，执行次数为 0 |
| 下游明确返回“未提交、不可重试”的业务拒绝 | `DEFINITIVE_FAILED` | 告知模型受控错误，不换键重试 |
| 只读查询临时过载 | 可恢复的读失败 | 在剩余截止时间内限次退避；必要时返回不确定 |
| 写请求发送后连接断开、等待超时或进程崩溃 | `OUTCOME_UNKNOWN` | 同键回查；只在下游保证幂等且预算允许时同键重发 |
| HTTP 500，但接口没有承诺事务回滚 | `OUTCOME_UNKNOWN` | 不凭状态码断定业务未生效 |
| 已得到成功回执，但落本地账本前崩溃 | `OUTCOME_UNKNOWN` | 通过下游操作 ID / 同键查询补回执 |
| 用户取消时写请求已经发出 | `OUTCOME_UNKNOWN` 或已知结果 | 停止后续步骤，继续对账；取消不撤销外部写入 |

Java `CompletableFuture.orTimeout` 会让等待的 Future 以 `TimeoutException` 完成；取消 Future 也不会自动控制底层计算。因此本地超时或取消后的业务结果，仍须按远端契约核实。[Java 25 CompletableFuture API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CompletableFuture.html#orTimeout(long,java.util.concurrent.TimeUnit))（检索日期：2026-11-28）

## 四、把重试预算和模型反馈放在正确层

执行器只在 `min(工具单次上限, 任务剩余时间 - 持久化与回填预留)` 足够时开始一次调用；每次重试都消耗**同一个任务**的时间、次数、并发与成本预算。429 等过载按下游的 `Retry-After` 和全局容量限流排程，避免每层各重试两次形成倍增。写动作的 `operation_key` 在所有 attempt 中不变，`attempt_id` 递增。不可判定的写结果占用待对账状态，不让模型改个措辞再新建一个同样的写动作。

回给模型的工具错误也要讲事实：只读失败可给 `READ_UNAVAILABLE`；明确业务拒绝可给 `BUSINESS_REJECTED`；写结果未知给 `PENDING_RECONCILIATION`，任务暂停或转人工，**不要写成 `TOOL_FAILED` 后诱导模型换工具重试**。OpenAI 的函数调用循环由应用执行并回传 `function_call_output`；Claude 可用 `tool_result` 的 `is_error: true` 表示工具失败，但这只是模型收到的反馈格式，不是外部副作用未发生的证明。[OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)、[Anthropic Handle Tool Calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)（检索日期：2026-11-28）

若以后通过 MCP 调工具，协议错误与工具执行错误也须分层；后者用工具结果的 `isError: true`。MCP 规范要求服务端校验输入、做权限控制与限流，并建议客户端设置超时和记录调用。协议格式不会代替本文的执行账本。[MCP Tools 规范（2026-07-28）](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)（检索日期：2026-11-28）

## 五、今天的实践：故障注入验收表

用 FakeWriteTool 保存按 `operation_key` 索引的远端回执，用虚拟时钟与两个 Worker 模拟下表。每条输出 `tenant_id / task_id / action_id / attempt_id / operation_key / state / version / provider_request_id` 时间线；展示计数器或断言结果，**未运行则记 `NOT_RUN`**。这只是练习要求，本文未声称跑过这些测试。

| Case | 注入点 | 验收断言 |
| --- | --- | --- |
| 重复投递 | 同一 `action_id` 两条队列消息 | 账本一行；同一参数返回同一动作，不出现两个不同 `operation_key` |
| 改参重投 | 同一 `action_id`，评论文本改变 | 摘要冲突；没有新增下游调用，原动作的既有调用不被重复发送 |
| 发送后丢回执 | FakeTool 已写入，客户端超时 | 先记 `OUTCOME_UNKNOWN`；回查后 `SUCCEEDED`；业务写入数为 1 |
| Worker 崩溃与晚到结果 | A 的租约过期，B 接管；A 回执晚到 | B 先回查；旧 `version` 写回失败；下游写入数为 1 |
| 无法对账 | 下游无查询、无幂等保证 | `MANUAL_REVIEW`；不自动重发；不向模型宣称成功或失败 |
| 用户真的再做一次 | 相同工具与参数，第二次明确确认 | 新 `action_id`；两次合法动作分别留痕 |

第 34 天接着给执行器加权限与审批：即便同一动作可以安全去重，**谁有权发起**仍需单独判定；第 35 天做第五周复盘和小测。

## 六、今日面试题（检索日期：2026-11-28）

以下题意来自公开牛客面经。企业、岗位与面试场次均为发帖者自述，**未经企业官方核验**；参考答案与追问是本文的工程归纳，不是企业标准答案。11 月可直接核对原题的样本有限，本次另选了 8–10 月仍能看到题面的经典题，覆盖超时、去重和恢复三个故障层次。

### 1. 工具执行三秒还没返回，超时值怎样定？

- **方向 / 难度**：工具执行 deadline、延迟预算 / 中等。
- **参考答案**：从任务总 SLA 与剩余截止时间往下分配，结合工具延迟分布、用户等待方式与持久化/回填预留，给单次调用和总重试分别设上限。三秒本身既不证明故障，也不等于还能无限等。只读工具可在预算内退避重试；写工具已发出后超时，应记结果未知并按同一动作 ID 回查。
- **追问**：用户取消能不能直接标记“写入失败”？不能；本地取消不撤销已发出的请求，仍要对账。
- **来源**：[牛客“字节跳动 Agent 一面”用户自述](https://www.nowcoder.com/discuss/939623386806751232?sourceSSR=dynamic)，页面标注 10-13；公司及场次未获官方核验。

### 2. 重试用“工具名 + 参数哈希”作幂等键，参数中时间戳每次变化怎么办？

- **方向 / 难度**：幂等键语义、冲突检测 / 难。
- **参考答案**：由服务端在业务动作被确认时生成 `action_id`，并把同一动作的所有发送绑定到同一 `operation_key`；再保存含业务语义参数的规范化摘要。同键不同摘要报冲突。传输时间戳若仅用于观测可以不参与业务摘要；若决定业务生效时间，就不能随意剔除。只靠参数哈希会把两次合法的相同动作错误合并。
- **追问**：用户确实要连续执行两次完全相同的操作怎么办？两次明确业务意图产生两个 `action_id`，分别走授权与留痕。
- **来源**：[牛客“阿里淘天 Agent 平台一面”用户自述](https://www.nowcoder.com/discuss/947983580246859776?sourceSSR=home)，页面标注 11-05；发帖者的技术回答也不是企业标准答案，公司及场次未获官方核验。

### 3. 工具超时重试会不会造成重复操作，幂等怎样做？

- **方向 / 难度**：写工具重试、重复副作用 / 中高。
- **参考答案**：先区分发送前拒绝与发送后回执缺失。业务动作 ID、下游幂等键和参数摘要持久化；所有网络 attempt 复用同一键。若下游能查询，用键回查；若能保证幂等，在共同截止时间内同键有限重发；既不能查询也不支持幂等，则待人工对账。唯一索引只能防本地重复账本，不能替下游去重。
- **追问**：幂等键记录已写入，业务写入前进程崩溃，如何避免永久卡住？设计可恢复状态和租约；由同键查询、原子事务或下游幂等契约确定后续动作。
- **来源**：[牛客“美团 AI 应用一面”用户自述](https://www.nowcoder.com/discuss/931898194231820288)，页面标注 09-22；公司及场次未获官方核验。

### 4. Agent 工具失败后怎样恢复，同时避免无限重试？

- **方向 / 难度**：错误分类、恢复状态机 / 难。
- **参考答案**：参数错误可在次数上限内要求模型修正；权限和确定性业务拒绝不自动重试；暂时性读故障按退避、`Retry-After`、总 deadline 和成本预算处理；写动作结果未知先进入对账。为每次尝试记录 `attempt_id`，同时保持稳定业务动作键；超过预算转明确终态或人工处理，避免模型自己循环调用。
- **追问**：HTTP 200 但业务返回 `accepted` 而非 `completed` 怎么办？按业务协议保持处理中，后续查询终态；不能凭 HTTP 成功宣布业务完成。
- **来源**：[牛客“阿里 Agent 开发一面”用户自述](https://www.nowcoder.com/discuss/918818769655324672?sourceSSR=post&weFlow=true)，页面标注 08-17；作为较早的经典恢复题使用，公司及场次未获官方核验。

## 资料

- [AWS Builders Library：Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)：调用方请求 ID、同键改参、迟到请求。
- [Stripe API v1：Idempotent requests](https://docs.stripe.com/api/idempotent_requests)：特定 API 的键复用、参数冲突与保留期示例。
- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)：本地唯一冲突和 `ON CONFLICT`。
- [Java 25 CompletableFuture API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CompletableFuture.html#orTimeout(long,java.util.concurrent.TimeUnit))：本地等待超时语义。
- [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)、[Anthropic Handle Tool Calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)、[MCP Tools 规范（2026-07-28）](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)：模型回填与协议错误语义。

以上资料检索日期均为 2026-11-28。跨系统“只写一次”只能在具体下游契约、幂等保留窗口和故障注入结果的范围内主张；本文表格是待实现的验收目标。
