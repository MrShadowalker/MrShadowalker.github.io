---
layout: post
title: "模型网关怎么控流：供应商限流、租户配额与安全降级"
date: 2026-11-07 09:00:00.000
updated: 2026-11-07 09:00:00.000
permalink: /articles/AI-Model-Gateway-Rate-Limit-Quota-Fallback.html
comments: true
description: "AI 全栈开发第 12 天，设计模型网关的多维准入、租户公平排队、供应商错误分类、有界重试和安全模型降级，并用本地故障注入验收。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "模型网关"
  - "限流"
  - "多租户"
  - "降级"
  - "面试"
---

第 11 天已经把每次供应商调用接进成本账本，并用原子预留守住任务和租户预算。预算通过后，请求仍可能被供应商限流、被本系统并发限制挡住，或遇到临时过载。把所有失败都当成“再试一次”，会让重试流量放大故障。

今天给模型网关加一层**可解释的准入与恢复策略**：谁占用了哪一维额度，为什么等待或拒绝，何时允许重试，何时可以切模型。文中的网关接口和调度算法是工程设计；供应商错误码、用量口径与响应头以引用的官方文档为准。
<!--more-->

## 一、把四种“额度”分开

| 约束 | 典型键 | 度量 | 到上限后 |
| --- | --- | --- | --- |
| 金额预算 | 租户、任务、账期 | 已结算 + 已预留金额 | 拒绝新的付费调用，等待充值或下个账期 |
| 请求速率 | 租户、模型池、供应商项目 | RPM / RPD 等 | 延后发送或返回可重试的限流结果 |
| Token 速率 | 租户、模型池、供应商项目 | TPM；部分供应商分输入和输出 | 按实际规则保守预留，限额恢复后再尝试 |
| 并发数 | 租户、模型池、工具 | 正在执行的调用数 | 有界排队，队列满则拒绝 |

金额预算不是速率限制：一小时只发一次请求，也可能因单次长上下文越过成本上限。RPM 不是并发：一分钟内只发十个请求，十个请求也可能同时占住十条长连接。Token 速率也不能用请求数代替：短问答和长文档总结对供应商容量的占用不同。

OpenAI 的限额可以按组织、项目、模型及共享模型族生效，响应头提供请求数与 Token 的剩余额度和重置时间；模型可用性与限额是两回事。[OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)（检索日期：2026-11-07）。Anthropic 区分 RPM、输入 Token 每分钟（ITPM）和输出 Token 每分钟（OTPM）；组织上限与 workspace 上限同时生效，并采用 Token Bucket，标称分钟额度不等于短时间内可以一次性突发用完。[Anthropic Rate limits](https://platform.claude.com/docs/en/api/rate-limits)（检索日期：2026-11-07）。

尤其要复用第 11 天的供应商专属 usage 适配器：OpenAI 的缓存输入仍计入 TPM；Anthropic 多数 Claude 模型的缓存读取不计 ITPM，而缓存写入计入。不要把价格账本中的“缓存读费率更低”误读成“不会消耗速率额度”。[OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)、[Anthropic Rate limits](https://platform.claude.com/docs/en/api/rate-limits)（检索日期：2026-11-07）

## 二、一次请求怎样通过网关

模型路由先筛能力、数据边界与成本，再为候选模型申请额度。建议把一次准入拆成以下步骤，所有候选都走同一套规则：

~~~text
可信身份与租户绑定
    → 验证任务类型、数据区域、模型能力、工具和结构化输出契约
    → 估计实际渲染输入与最大输出，计算本次金额上界
    → 进入有界租户队列；等待不能超过业务截止时间
    → 原子申请租户与供应商模型池的速率额度、并发租约
    → 原子预留任务与租户金额预算
    → 发起一次供应商 attempt
    → 记录原始响应、结算成本、释放并发租约
~~~

等待队列不应长期占住金额预留额。真正发出前要重新检查 deadline、权限、模型候选和预算。若准入申请中途失败，撤销**尚未发送**的本地预留；请求一旦送到供应商，就不能假设失败或超时不占其速率额度，也不能把成本写成零。第 11 天的 <code>attempt_id</code> 应贯穿网关、trace 和账本。

对同一 Redis 分片内的多维本地速率额度，可用 Lua 脚本一次检查并扣减；若额度分散在多个存储或地域，就需要单一协调服务或明确的失败回滚与保守拒绝策略。并发名额应使用带租约时限的信号量，任务正常结束时立即释放，实例崩溃后由租约过期回收。金额预算仍用持久化原子预留与结算，不能只靠内存计数。

### 为什么不能只看供应商响应头

响应头是供应商对**已到达请求**的观察值，应用内部还有其他实例、其他项目或绕过本网关的流量。网关应维护自己的保守容量模型，再用供应商的 remaining/reset 信息动态校准。若供应商报剩余 0，就停止本模型池的新发送；若本地估计尚有余额但供应商返回 429，以供应商拒绝为准，降低发送速率并记录偏差。

有界队列可按租户做轮转或带权公平调度；付费等级可以影响权重，但不能让低权重租户永远得不到服务。队列深度、最长等待和单租户在队请求数都要设上限。排队超时应返回明确的 <code>QUEUE_DEADLINE_EXCEEDED</code>，不要在后台继续生成一个用户已经不需要的答案。

## 三、429 只是 HTTP 状态，不是恢复策略

不同错误需要不同处理。下表中的本地错误码是建议的网关契约，不是供应商原样返回值。

| 情况 | 判断证据 | 网关动作 |
| --- | --- | --- |
| 本地租户速率用尽 | 网关限流器拒绝，未发往供应商 | 可排队则等待；否则返回 <code>TENANT_RATE_LIMITED</code> 与可用重试时间 |
| 本地任务或租户金额预算不足 | 预算原子预留失败，未发往供应商 | 返回 <code>BUDGET_EXHAUSTED</code>；不可自动重试 |
| OpenAI 临时爬升限流 | 429、<code>error.code=slow_down</code> | 降速，遵守 <code>Retry-After</code> 的最小等待并加抖动 |
| OpenAI 模型临时过载 | 503、<code>error.code=server_is_overloaded</code> | 在剩余 deadline 和预算内有界重试或切合格模型 |
| OpenAI 支出硬上限 | 429 且错误体指向支出封顶 | 停止该项目调用；提示运营处理，不做盲重试 |
| Anthropic 临时限流 | 429 且可恢复的 rate limit 错误 | 按 <code>retry-after</code> 和剩余预算等待 |
| Anthropic 支出上限 | 供应商封顶错误；可能是 429 或用户设置限制时的 400 | 停止重试，记录配额耗尽 |
| Anthropic 服务过载 | 529 <code>overloaded_error</code> | 有界退避或安全降级 |
| 超时或连接断开 | 未拿到最终供应商结果 | 标为结果未知；先查状态与账本，谨慎重试 |

OpenAI 官方文档明确区分 429 <code>slow_down</code>、503 <code>server_is_overloaded</code>，也说明支出硬上限可能返回 429。[OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)（检索日期：2026-11-07）。Anthropic 文档说明套餐支出上限可通过 <code>error.details.error_code=enforced_spend_limit_reached</code> 识别，用户自设限制可能返回 400；其过载错误为 529。[Anthropic Rate limits](https://platform.claude.com/docs/en/api/rate-limits)、[Anthropic API errors](https://platform.claude.com/docs/en/api/errors)（检索日期：2026-11-07）。

分类函数至少输入 <code>provider</code>、HTTP 状态、供应商 <code>error.type/code/details</code>、响应头和 <code>streamStarted</code>。不要只写 <code>if (status == 429) retry()</code>。对未知错误保留原始响应与请求 ID，采用保守处理，并把明确的 <code>retryable</code>、<code>retryAfter</code> 和 <code>reason</code> 返回给调用方。

## 四、有界重试：把 SDK 自带重试也算进去

重试只有在**错误可恢复、业务截止时间未到、任务预算足够、下次调用仍满足能力与数据边界**时才成立。先看有效的 <code>Retry-After</code>；它是最短等待时间，不应提前发送。若缺失或无效，再用指数退避加随机抖动。若等待时间已超过任务 deadline，就直接结束或转异步队列。

~~~java
RetryDecision decide(AttemptFailure failure, TaskBudget budget, Instant deadline) {
    if (!failure.retryable() || failure.streamStarted()) return RetryDecision.stop();
    if (budget.remainingAttempts() == 0 || budget.remainingMoney() <= 0) return RetryDecision.stop();
    Duration wait = failure.retryAfter().orElseGet(() -> backoffWithJitter(budget.usedAttempts()));
    if (Instant.now().plus(wait).isAfter(deadline)) return RetryDecision.stop();
    return RetryDecision.retryAfter(wait);
}
~~~

这个伪代码省略了成本上界、模型能力与幂等检查，生产实现必须补齐。每一次重试都产生新的 <code>attempt_id</code>，各自申请额度、预留成本并记账；任务层保留统一的业务幂等键。请求已经到达供应商后，超时可能代表“结果未知”，不能因为客户端没收到文本就断言供应商未生成。

OpenAI 和 Anthropic 官方 SDK 都可能自动重试。若网关设最多 3 次、SDK 内部又设最多 3 次，实际供应商尝试可能远超预期。建议网关统一管理重试时关闭 SDK 重试，或把 SDK 内部尝试纳入同一个上限与账本。[OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)、[Anthropic API errors](https://platform.claude.com/docs/en/api/errors)（检索日期：2026-11-07）

故障期间还要控制**重试流量占比**，防止大量首次请求和重试一起挤满模型池。无论 429 还是 503，连续失败都应让相应模型池短暂降速或熔断，再以少量探测恢复。失败请求也可能占用供应商的每分钟额度；重试风暴只会加剧拥塞。[OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)（检索日期：2026-11-07）

## 五、降级必须先通过业务契约

从模型 A 切到模型 B 前，逐项检查：

1. **能力**：工具调用、结构化输出、上下文窗口、模态和最大输出满足本任务。
2. **数据边界**：租户允许的供应商、地域、保留策略和敏感数据规则允许切换。
3. **质量门槛**：该任务的 Golden Set 和灰度结果支持 B；高风险任务可直接失败或转人工。
4. **费用与限额**：B 的最大费用仍在剩余预算内，B 的 RPM/TPM/并发也可用。
5. **状态**：尚未向用户输出无法撤回的流式内容，也未产生不可重复的工具副作用。

OpenAI 与 Anthropic 都说明流式请求开始后仍可能通过事件报告错误。**已经向用户发出部分答案时，不应静默把另一模型的输出接在后面**：模型可能重复前文、改变结论或造成引用错位。可明确终止本次流，展示“部分输出未完成”；若要重试，应启动新的可识别结果版本，重新走预算、权限和证据检查。[OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)、[Anthropic API errors](https://platform.claude.com/docs/en/api/errors)（检索日期：2026-11-07）

发生超时但结果未知时，先保留原 attempt 的预算与对账状态。若供应商支持查询原响应，则优先确认；确认无法查询时，按业务幂等风险决定是否新开 attempt。对带外部写操作的 Agent，模型重试不应自动重放已经执行的工具调用。

## 六、Java 服务接口与故障注入

~~~java
record AdmissionScope(String tenantId, String taskId, String modelPool) {}
record Demand(long inputTokensUpperBound, long outputTokensUpperBound, long moneyUpperBoundMinor) {}
record GatewayError(String code, boolean retryable, Duration retryAfter, String attemptId) {}

interface AdmissionController {
    Lease tryAcquire(AdmissionScope scope, Demand demand, Instant deadline);
    void releaseBeforeSend(Lease lease);
    void finish(Lease lease, UsageResult result);
}

interface ProviderErrorClassifier {
    GatewayError classify(String provider, int httpStatus, RawError body,
                          Map<String, String> headers, boolean streamStarted);
}
~~~

用 <code>FakeProvider</code> 和虚拟时钟做一组可重放实验，避免接真实付费 API：

1. RPM 还有余额但 TPM 不足：准入拒绝，供应商调用数保持零。
2. 同租户并发达到上限：第二个请求进入有界队列，租约释放后继续；实例崩溃时租约到期回收。
3. 两个租户竞争同一模型池：验证全局上限不被突破，低权重租户仍有完成机会。
4. 本地预算不足：无供应商调用，返回 <code>BUDGET_EXHAUSTED</code>。
5. OpenAI 临时 429 带 <code>Retry-After</code>：不提前发送；等待超出 deadline 时停止。
6. 供应商支出封顶也返回 429：不重试、不切到同一付费账户下的另一个模型。
7. 503 或 529 过载：只对符合契约的候选降级，并单独记录每次 attempt 与成本。
8. 流式已输出部分内容后收到错误事件：不自动重放；标记部分结果与待对账用量。
9. SDK 自带重试与网关重试同时开启：检查实际供应商调用次数，修正为单一重试预算。

观察指标至少包括：按原因分组的准入拒绝数、队列等待 p95、租户公平性、供应商 429/503/529 比例、重试放大率、降级后的成功率与质量、每成功任务成本、待对账金额。只看“成功率提升”会掩盖重试成本和质量下降。

## 七、今日面试题（检索日期：2026-11-07）

以下面经中的公司归属均为发帖者自述，**不是企业官方题库**；参考答案是本文的工程归纳。第 4 题只能核验搜索索引与作者主页，原文页面未能完整抓取，已单独标注。

### 1. 工具调度器如何同时处理依赖、单工具配额和总并发上限？

- **方向 / 难度**：Agent Runtime、调度 / 难。
- **参考答案**：用 DAG 拓扑排序和就绪队列安排执行；环在启动前拒绝。真正执行前申请全局与工具级租约，完成或失败后在 <code>finally</code> 释放。父节点不能持有并发名额等待子节点；失败下游标记 <code>SKIPPED</code> 并保留原因。
- **追问**：并行分支同时争抢最后一个名额，如何保证租户公平和不超卖？
- **来源**：[牛客用户自述“阿里淘天 Agent 平台一面”](https://www.nowcoder.com/discuss/947983580246859776?sourceSSR=post)，页面显示 11-05；企业归属未获官方核验。

### 2. 实现最多 N 次、带指数退避和随机抖动、同业务键幂等的重试器

- **方向 / 难度**：模型网关、Java 后端 / 中高。
- **参考答案**：先按供应商错误码区分可恢复与不可恢复；优先遵守 <code>Retry-After</code>，否则指数退避加抖动。用业务键关联任务、用 <code>attempt_id</code> 区分实际调用；限制总次数、总时间、预算与重试流量。网关统一重试时关闭或计入 SDK 自带重试。
- **追问**：一千个请求同一时刻收到 429，怎样避免下一秒再次同步冲击供应商？
- **来源**：[牛客用户自述“快手 AI 全栈一面”](https://www.nowcoder.com/discuss/947982288917110784?sourceSSR=post)；企业归属未获官方核验。

### 3. 多用户调用同一工具，Redis 如何限流？限流和限制并发有什么区别？

- **方向 / 难度**：多租户、分布式限流 / 中高。
- **参考答案**：限流约束单位时间内的请求数或 Token；并发限制约束同一时刻正在执行的任务数。共享存储中按租户和全局维度原子申请，速率可用 Token Bucket，并发用带过期时间的租约。不能用本机 <code>Semaphore</code> 代表多实例总限额。
- **追问**：实例在执行中崩溃，怎样回收并发名额，同时避免任务仍运行时租约提前失效？
- **来源**：[牛客字节相关备考题单](https://www.nowcoder.com/discuss/946211096669564928?sourceSSR=home)，页面显示 11-01；发帖者说明是多份记录整理，未核验为单场企业原题。

### 4. 首次请求返回 429 后切换模型，怎样避免重复生成和重复计费？

- **方向 / 难度**：模型路由、故障恢复 / 难。
- **参考答案**：先区分**确实收到流开始前的供应商拒绝**和超时导致的结果未知；检查 SDK 是否已内部重试。已确定拒绝且未输出时，可以为合格候选重新准入和预留；结果未知时保留原 attempt 对账，不把它写成零。两个供应商调用分别记账，客户端只接受一个明确版本的结果。已输出部分流时不静默续接另一模型。
- **追问**：主模型已有部分 SSE 输出，同时发生超时，怎样向用户说明状态并追踪两次成本？
- **来源**：[牛客用户自述“字节抖音架构后端一面”](https://www.nowcoder.com/feed/main/detail/c687af27a503401888e6b41c0f5ece93?sourceSSR=enterprise)；题面及 2026-10-13 日期见搜索索引与作者主页，原文未能完整核验，企业归属也未获官方核验。

## 资料与下一步

- [OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)：组织/项目/模型族限额，响应头、<code>Retry-After</code>、临时 429 与 503、有界重试和硬支出限额。
- [Anthropic Rate limits](https://platform.claude.com/docs/en/api/rate-limits)：RPM/ITPM/OTPM、Token Bucket、缓存 Token 口径、组织与 workspace 限额及支出封顶。
- [Anthropic API errors](https://platform.claude.com/docs/en/api/errors)：529 过载、流式错误事件与 SDK 重试。以上官方资料检索日期均为 2026-11-07。

明天继续做模型服务治理：模型注册表、能力版本、健康检查与路由配置发布；第 14 天按计划做第二周复盘和小测。
