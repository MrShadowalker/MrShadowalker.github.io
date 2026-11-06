---
layout: post
title: "AI 成本账本怎么做：请求、任务、租户三级计量与预算硬上限"
date: 2026-11-06 09:00:00.000
updated: 2026-11-06 09:00:00.000
permalink: /articles/AI-Task-Tenant-Usage-Cost-Budget.html
comments: true
description: "AI 全栈开发第 11 天，从模型调用的原始用量出发，设计请求、任务、租户三级成本账本，以及并发预算预留、流式结算、重试与取消后的对账流程。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "模型网关"
  - "成本账本"
  - "预算控制"
  - "多租户"
  - "面试"
---

第 9 天用“每成功任务成本”衡量路由，第 10 天拆开了 Prompt 缓存和应用缓存。接下来要回答一个更实际的问题：一个 Agent 任务包含规划、检索、模型调用、失败重试和工具执行，账单应该记在哪里？当两个任务同时启动，怎样保证它们不会一起穿透租户预算？

今天把模型供应商的原始用量接成**调用尝试 → 任务 → 租户**三级账本，并设计预算预检、预留和结算。本文的数据模型与控制流程是工程设计推导；各供应商的字段语义与 API 行为以文末官方文档为准。
<!--more-->

## 一、先定义账本的最小单位

一次用户请求可能启动一个任务；一个任务有多个步骤；一个步骤可能因超时、限流或模型降级产生多次供应商调用。**每一次实际发给供应商的调用尝试（attempt）都可能产生费用**，不能只记录最后成功的响应。

~~~text
tenant_id
  └── task_id（一次业务目标）
       ├── step_id：检索 + 重排
       ├── step_id：模型规划
       │    ├── attempt_id：供应商 A，超时但可能已生成
       │    └── attempt_id：供应商 B，成功
       └── step_id：模型总结 + 工具调用
~~~

因此，业务指标和计费指标要分开：

| 层级 | 主键 | 记录什么 | 典型问题 |
| --- | --- | --- | --- |
| 调用尝试 | `attempt_id` | 原始 usage、互斥计费桶、单价快照、估算与最终金额 | 重试和中断有没有漏记？ |
| 任务 | `task_id` | 所有模型、检索、重排和工具调用的实际成本 | 一次成功业务任务要花多少钱？ |
| 租户 | `tenant_id + 账期` | 已结算金额、已预留金额、预算上限、调整记录 | 并发任务会不会超预算？ |

“请求成本”可按入口 `request_id` 聚合，异步任务需要额外保存 `task_id`。一次请求如果启动多个任务，不能把任务成本硬塞进某一个 HTTP 响应；前端可以通过任务 ID 查询累计值。

## 二、原始 usage 永久保留，适配器只产出互斥计费桶

先保存供应商返回的原始 usage、模型标识和响应 ID，再由**供应商专属适配器**归一化。不要让业务代码直接相加 `input_tokens`、`cached_tokens`、`reasoning_tokens` 等名字相似的字段。

~~~json
{
  "event_id": "usage_evt_01",
  "tenant_id": "t_42",
  "task_id": "task_88",
  "step_id": "summarize",
  "attempt_id": "attempt_2",
  "provider": "openai",
  "provider_response_id": "resp_example",
  "model": "model-version-from-response",
  "route_version": "route-v7",
  "price_version": "price-snapshot-2026-11-06",
  "currency": "USD",
  "usage_status": "CONFIRMED",
  "input_uncached_tokens": 1000,
  "input_cache_read_tokens": 4000,
  "input_cache_write_tokens": 7000,
  "output_tokens": 500,
  "raw_usage_ref": "immutable-provider-usage-01"
}
~~~

示例仅展示模型 Token 桶。需要按供应商价格表继续拆分缓存写入保留时长、长上下文、音视频、工具调用等费率；不要把本文示例当作真实模型价格。

### OpenAI：总输入已包含缓存子项

OpenAI Responses 的 `usage.input_tokens` 包含普通输入、缓存读取和缓存写入；`cached_tokens`、`cache_write_tokens` 是其中的子项。因此：

~~~text
普通输入 = input_tokens - cached_tokens - cache_write_tokens
归一化输入总量 = 普通输入 + 缓存读取 + 缓存写入 = input_tokens
~~~

例如 `input_tokens=12000`、`cached_tokens=4000`、`cache_write_tokens=7000`，普通输入只有 1000。若再把 4000 和 7000 加到 12000 上，就会重复计费。`output_tokens_details.reasoning_tokens` 同样是 `output_tokens` 的子项，不能额外加一次。若缓存写入分为不同保存时长，要在写入桶内再次按费率拆分。[OpenAI Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)、[OpenAI API pricing](https://developers.openai.com/api/docs/pricing)（检索日期：2026-11-06）

### Anthropic：输入字段需要合并

Anthropic Messages 的 `input_tokens`、`cache_creation_input_tokens`、`cache_read_input_tokens` 是互不重叠的用量；逻辑输入总量是三者之和。缓存读取和写入可能采用不同费率，不能拿 OpenAI 的减法套用。其 `output_tokens` 包含相应的思考 Token，用最终输出总量计价，保留思考明细做诊断即可。[Anthropic Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)、[Anthropic Messages reference](https://platform.claude.com/docs/en/api/typescript/messages)、[Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)（检索日期：2026-11-06）

速率限制也不能共用一个口径：OpenAI 文档说明缓存输入仍计入 TPM；Anthropic 文档说明多数 Claude 模型的缓存读取不计入 ITPM，输入和缓存写入计入。预算金额、上下文容量、供应商 TPM/ITPM 是不同维度，应分别检查。[OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits)、[Anthropic rate limits](https://platform.claude.com/docs/en/api/rate-limits)（检索日期：2026-11-06）

适配器输出至少要携带 `raw_usage_ref`、供应商、模型版本、价格快照和币种。若某个模型或特殊工具的计价规则无法确定，标记为 `UNPRICED` 并告警，不要默默记零。汇率换算也应保存版本和时点，不能把不同币种直接相加。

## 三、流式、重试和取消：没有最终 usage 不等于零成本

流式输出的文字片段只是用户可见内容，可能漏掉不可见推理和结构 Token。OpenAI 的流式事件在 `created`、`in_progress` 阶段可能没有 usage；完成事件才可能提供最终值。Anthropic `message_delta.usage` 对同一消息是累计值，取最后一个有效值，不能逐帧求和。[OpenAI streaming events](https://developers.openai.com/api/reference/resources/responses/streaming-events)、[Anthropic API primer](https://platform.claude.com/docs/en/claude_api_primer)（检索日期：2026-11-06）

建议将 attempt 的计量状态明确分成：

~~~text
RESERVED → CONFIRMED → RECONCILED
         ↘ PENDING_USAGE → RECONCILED / MANUAL_REVIEW
         ↘ ESTIMATED（仅用于展示或风险控制，不能伪装成最终账单）
~~~

- **失败重试**：每次供应商调用都有独立 `attempt_id`；第一个调用超时不等于供应商没有处理，继续保留预留额并等待对账。
- **客户端断开**：前端 SSE 中断不等于后端或供应商停止生成。后端需继续接收最终 usage，或明确取消后进入待对账状态。
- **取消**：即便供应商接受取消，返回 usage 也可能为空；不能立即释放全部预留额。[OpenAI cancel Response](https://developers.openai.com/api/reference/resources/responses/methods/cancel) 的示例就有 `usage=null`。（检索日期：2026-11-06）
- **幂等入账**：对 `(provider, provider_response_id, usage_event_type)` 或稳定的 `attempt_id + settlement_version` 建唯一约束；重复回调只更新同一笔，不追加两次。

供应商组织级 [OpenAI Costs API](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs) 和 [Anthropic Usage and Cost Analytics API](https://platform.claude.com/docs/en/manage-claude/usage-cost-analytics-api) 可用于延迟对账。它们的聚合粒度、更新时间和修订方式与应用实时账本不同；差异应记一条可追溯的调整事件，而非覆盖原始 attempt。（检索日期：2026-11-06）

## 四、预算预检：先数 Token，再按最坏情况预留金额

对于计划发出的模型调用，后端预检要使用**实际渲染后的消息、工具 Schema、多模态输入和输出约束**。OpenAI 提供 `POST /v1/responses/input_tokens`；Anthropic 提供 `POST /v1/messages/count_tokens`。它们比“字符数除以四”可靠，但 Anthropic 计数接口对部分 server tools、MCP connector 和 URL/file 来源内容不覆盖，遇到未覆盖输入需保守估算并施加上限。[OpenAI Counting tokens](https://developers.openai.com/api/docs/guides/token-counting)、[Anthropic Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)（检索日期：2026-11-06）

预留额不是“预计平均花费”，而是本次调用允许消耗的**上界**：

~~~text
预留额 = 普通输入上界 × 输入费率
       + 最大输出 Token × 输出费率
       + 可计价工具/检索/重排的上界
       + 计价规则要求的附加项
~~~

预检不能预设缓存一定命中；也不能只用可见输出文字估算 `max_output_tokens`，因为该上限覆盖不可见的生成 Token。按上下文窗口、模型输入上限、输出上限、RPM/TPM、任务剩余预算分别校验。硬花费上限与速率限制不是同一个开关。[OpenAI Counting tokens](https://developers.openai.com/api/docs/guides/token-counting)、[OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits)（检索日期：2026-11-06）

## 五、并发任务必须原子预留

假设租户剩余预算是 1 个计价单位，两个并发任务各需预留 0.8。若它们先各自读取余额再写入，两者都会通过，最终预留 1.6。预算控制必须在数据库事务或等价的原子操作中完成。

~~~sql
-- 伪 SQL：金额建议用最小货币单位的整数或定点数。
UPDATE budget_account
SET reserved_minor = reserved_minor + :amount
WHERE account_id = :tenant_account
  AND spent_minor + reserved_minor + :amount <= cap_minor;
-- 受影响行数必须为 1，否则拒绝此次调用。
~~~

还要在同一事务内预留任务预算，写入唯一 `reservation_id`。若租户预留成功而任务预留失败，整个事务回滚；不能留下一笔孤儿预留。多层预算应固定锁顺序，避免并发死锁。跨数据库或多区域无法使用同一事务时，需要单一预算服务或有明确一致性语义的协调机制；仅用本地内存计数器不构成租户硬门槛。

结算时用实际供应商 usage 与价格快照计算金额，事务内把 `reserved` 减去原预留额、把 `spent` 加上实际金额；若实际费用因规则变化超过预留额，要记录超额并触发熔断和人工核查。**最终用量缺失时保留预留额或转入待对账额度**，不能为了让余额好看而释放。预留记录与结算事件都要可重放、可去重。

### 任务运行中的闸门

每个新步骤开始前检查：剩余金额、模型调用数、工具调用数、最大步骤数、累计输入/输出 Token、运行时长和用户取消状态。检测到循环重复且没有进展时，终止并返回已完成的事实与未完成原因。并行分支要共享同一个任务预算账户，不能各拿一份完整预算。

这里的“硬上限”准确含义是：**本系统不会批准超出预留上界的新调用**。供应商在一次已经批准的流式调用内可能延迟回传 usage，网络中断后也可能继续计费。因此仅凭应用侧逐字节观察，无法保证最终供应商账单一分钱都不超过上限；应同时设置 `max_output_tokens`、超时、可用的取消机制和供应商级支出限制，并为未知用量留风险额度。不能向业务方承诺应用侧能精确切断每一笔流式费用。

## 六、Java 后端落地：接口与验收用例

账本可以拆成四个明确接口，让 `ModelClient` 不直接操作租户余额：

~~~java
record BudgetScope(String tenantId, String taskId, String stepId) {}
record CostEstimate(long upperBoundMinor, String currency, String priceVersion) {}

interface UsageAdapter {
    NormalizedUsage normalize(String provider, String model, RawUsage rawUsage);
}
interface BudgetService {
    Reservation reserve(BudgetScope scope, CostEstimate estimate, String attemptId);
    void settle(String reservationId, NormalizedUsage usage);
    void markPending(String reservationId, String reason);
}
interface CostLedger {
    void appendAttempt(AttemptCostEvent event);  // 唯一键保证幂等
    TaskCost taskCost(String taskId);
    TenantCost tenantCost(String tenantId, String billingPeriod);
}
~~~

今天的练习无需接真实付费 API。用 `FakeModelClient` 固定原始 usage 和价格快照，完成下列八个可自动检查的场景：

1. 普通输入、缓存读、缓存写分别计价；OpenAI 子项不重复相加，Anthropic 三项合并。
2. 一个任务有两次模型尝试，第一次超时，第二次成功；账本保留两笔 attempt。
3. 两个并发任务竞争同一租户余额，只有一个预留成功。
4. 租户预算充足但任务预算不足，预留整体回滚。
5. 流式最后一帧才有 usage；中途断开则进入 `PENDING_USAGE`。
6. 相同结算事件重放两次，任务成本只增加一次。
7. 取消后 usage 未知，不把成本写成零，也不释放风险额度。
8. 调整价格版本后，历史 attempt 仍按原快照展示；另用调整事件处理对账差异。

验收输出至少包含 `cost_per_successful_task`、`pending_usage_amount`、预算拒绝数，以及按租户、模型、路由版本聚合的成本。这样第 9 天的路由实验才能比较“便宜的单次调用”和“便宜的成功任务”。

## 七、今日面试题（检索日期：2026-11-06）

以下牛客内容是**用户自述面经或社区整理题**；字节、OPPO 标签来自发帖者，无法核验为企业官方题库。题面按公开页面概括，参考答案是基于本文设计给出的工程回答，不代表发帖者或企业标准答案。

### 1. Agent 有严格次数限制时，如何避免误杀正常任务？

- **方向 / 难度**：Agent Runtime、预算治理 / 难。
- **参考答案**：把总预算拆成调用次数、步骤、Token、金额和墙钟时间；进入模型或工具调用前原子预留。对有进展的任务保留合理余量，对重复规划或无状态变化的循环提前停止。达到上限时返回部分结果、未完成原因和可恢复点，不让 Agent 无限尝试。
- **追问**：两个并行分支同时申请最后一次模型调用，如何避免各自通过？答题重点是共享任务账户和原子预留。
- **来源**：[牛客用户自述“字节 AI 全栈一面”](https://www.nowcoder.com/discuss/912833732065656832?sourceSSR=post&weFlow=true)；公司归属未获官方核验。（检索日期：2026-11-06）

### 2. Agent 循环规划时，如何防止耗尽 Token 与工具预算？

- **方向 / 难度**：Agent Runtime、循环控制 / 中高。
- **参考答案**：设置最大步骤、调用次数、Token、金额和运行时长；记录动作指纹与状态进展，重复动作且结果无变化时停止。每个步骤预检并预留预算，流式用量缺失时暂记待对账，重试也占预算。
- **追问**：为什么只限制 Token 不够？答题重点是外部工具可能按次收费，循环还可能耗尽时间和并发资源。
- **来源**：[牛客用户自述“OPPO AI Agent 秋招一面”](https://ac.nowcoder.com/discuss/1674899?type=0)；公司归属未获官方核验。（检索日期：2026-11-06）

### 3. 流式返回时，如何统计 Token 并支持计费？

- **方向 / 难度**：模型网关、流式计量 / 难。
- **参考答案**：以 `attempt_id` 聚合一次供应商调用，优先使用供应商最终 usage。增量帧求和、累计帧取最后值，必须按供应商协议判断；可见文本不能覆盖不可见推理 Token。中断或没有最终 usage 时标记 `PENDING_USAGE`，保留预留额，等待供应商对账。重试和子调用分别入账，并用唯一键防止重复结算。
- **追问**：客户端断开而供应商继续生成，如何避免漏记与双记？答题重点是服务端独立收尾、稳定调用 ID 和幂等结算。
- **来源**：[牛客《80 道 Agent 开发面试题》“流式输出”第 8 题](https://www.nowcoder.com/discuss/867373725035872256?toCommentId=22556982)；社区整理题，未核验具体企业出处。（检索日期：2026-11-06）

### 4. Token 消耗突然增加，怎样定位和优化？

- **方向 / 难度**：AI 平台、成本诊断 / 中高。
- **参考答案**：先按租户、任务类型、模型、Prompt 版本、路由版本聚合，区分请求量上升、每次输入增长、输出变长、重试次数增加和缓存命中下降。再看每成功任务成本与成功率，避免只靠单次 Token 指标优化。使用调用级 trace 对照价格快照和原始 usage，复现后再改上下文压缩、路由或缓存策略。
- **追问**：平均单次 Token 下降而每成功任务成本上升，可能是什么原因？答题重点是失败率、重试、工具费或模型单价变化。
- **来源**：[牛客成本趋势讨论帖](https://www.nowcoder.com/discuss/924002092400775168?sourceSSR=post&weFlow=true)；社区整理题，未核验具体企业出处。（检索日期：2026-11-06）

### 5. 多租户 Agent 平台怎样处理资源配额？

- **方向 / 难度**：多租户、模型网关 / 难。
- **参考答案**：所有调用先绑定可信租户身份；分别设置并发、RPM/TPM、任务预算和账期金额上限。全局额度与租户额度都要通过原子预留，重试不能绕过配额。账本按租户和 attempt 记原始 usage、结算状态及调整事件，并限制用户只能查询本租户成本。
- **追问**：全局 TPM 和租户 TPM 同时紧张，怎样避免先占一个配额后另一个失败？答题重点是固定顺序、短期预留与失败回滚，或集中配额服务。
- **来源**：[牛客 Agent 开发岗面试题整理](https://ac.nowcoder.com/discuss/1665837?type=0)；社区整理题，未核验具体企业出处。（检索日期：2026-11-06）

## 资料与下一步

- 供应商用量、价格和限制：[OpenAI Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)、[OpenAI API pricing](https://developers.openai.com/api/docs/pricing)、[OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits)、[Anthropic Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)、[Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)、[Anthropic rate limits](https://platform.claude.com/docs/en/api/rate-limits)。
- 计数、流式与对账：[OpenAI Counting tokens](https://developers.openai.com/api/docs/guides/token-counting)、[OpenAI streaming events](https://developers.openai.com/api/reference/resources/responses/streaming-events)、[OpenAI Costs API](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs)、[Anthropic Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)、[Anthropic Usage and Cost Analytics API](https://platform.claude.com/docs/en/manage-claude/usage-cost-analytics-api)。（以上资料检索日期：2026-11-06）

明天继续把预算闸门接到模型网关：区分供应商速率限制、租户配额、任务并发和降级策略，并验证 429、超时与预算拒绝的不同处理路径。
