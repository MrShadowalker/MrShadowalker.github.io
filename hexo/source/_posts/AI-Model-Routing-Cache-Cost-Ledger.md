---
layout: post
title: "模型路由怎么落地：能力门槛、缓存命中与每成功任务成本"
date: 2026-11-04 09:00:00.000
updated: 2026-11-05 09:00:00.000
permalink: /articles/AI-Model-Routing-Cache-Cost-Ledger.html
comments: true
description: "AI 全栈开发第 9 天，用模型注册表、硬约束、质量门槛、缓存策略和调用账本设计可回放的模型路由，附四道公开面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "模型路由"
  - "模型网关"
  - "缓存"
  - "成本控制"
  - "面试"
---

前面已经有统一 `ModelClient`、Token 预算和 Prompt 回归集。第 8 天又给检索结果加上了版本、权限和评测。现在要回答一个更像平台工程的问题：同一个接口后面接了多个模型，请求进来时到底选谁？

本篇用一个客服任务贯穿路由、缓存和成本账本。目标是把“选更便宜的模型”变成**可审计的路由决策**：先判断能力和权限是否满足，再比较质量、延迟和任务成本；出故障时明确重试、降级或失败。文中的价格与运行结果均是设计示例，不代表真实供应商报价或已完成的线上实验。
<!--more-->

## 一、先说清路由的输入和输出

假设用户问：“解释订单 O-17 为什么不能退款，只查询，不要执行退款。”这个任务要求读取订单与政策、保留“不执行退款”的约束，返回结构化解释，不能因为模型切换而变成写操作。一个路由器最少需要这些输入：

| 输入 | 例子 | 作用 |
| --- | --- | --- |
| 任务契约 | `explain_refund_reason`、只读、JSON Schema v2 | 排除不支持结构化输出或工具调用的模型 |
| 身份与策略 | tenant、地域、数据密级、允许的供应商 | 避免敏感数据越界或跨租户流转 |
| 请求大小 | 完整输入预估、输出预留、工具定义 | 检查上下文与独立输入/输出上限 |
| 质量门槛 | 固定评测集按任务分桶的通过率 | 阻止便宜但不满足业务要求的候选 |
| 服务状态 | P95、错误率、并发余量、RPM/TPM | 避开拥塞与已熔断的实例 |
| 预算 | 租户额度、任务成本上限、价格版本 | 在调用前拒绝超预算请求 |

输出不是一个模型名，而是一条带理由的决策记录：

~~~json
{
  "route_id": "route-20261104-017",
  "task_id": "task-017",
  "policy_version": "router-v3",
  "selected_model": "balanced-model@2026-10",
  "candidate_models": ["balanced-model@2026-10", "strong-model@2026-09"],
  "hard_filters": ["region=cn", "json_schema=true", "input_limit>=8200"],
  "quality_bucket": "refund-explanation",
  "estimated_upper_cost": 0.018,
  "price_snapshot": "price-2026-11-04",
  "fallback_policy": "retry_same_then_strong_if_safe"
}
~~~

`estimated_upper_cost` 在这里只是教学数字。实际系统要用当天的价格快照、完整输入估计和输出上限计算，并保留币种、单位及税费规则。供应商报价与能力会变化，不能把示例值写死进代码。

## 二、模型注册表：把可选条件与运行状态拆开

在 Java 服务里，可以先做一张配置表或一个版本化 JSON，而不用一开始就做完整控制台：

~~~java
record ModelProfile(
    String provider,
    String modelId,
    String revision,
    String region,
    Set<String> capabilities,  // JSON_SCHEMA, TOOL_CALL, STREAM, VISION...
    int contextWindow,
    int inputLimit,
    int outputLimit,
    Set<String> dataClasses,
    String priceVersion,
    int maxConcurrent
) {}

record ModelHealth(
    String modelId,
    double p95LatencyMs,
    double recentErrorRate,
    int availableSlots,
    boolean circuitOpen
) {}
~~~

`ModelProfile` 记录经人工确认的相对稳定能力；`ModelHealth` 记录运行时状态。评测分数也不要直接塞进一条“全局模型分”里：同一个模型可能擅长摘要，却在中文金额、否定词或 Tool Calling 上失分。建议按 `任务类型 × 语言 × 风险等级 × Schema 版本` 维护质量门槛。

真正选择模型时分两段：

1. **硬过滤。** 区域与数据策略、工具/结构化能力、上下文与输入上限、租户准入、预算、熔断状态任何一项不满足，就不进入候选。
2. **软排序。** 对剩余候选比较固定评测通过率、P95/首 Token 延迟、估计成本、近期失败率。权重由业务目标配置，变更要有版本和回放结果。

一个简单的伪代码：

~~~java
List<ModelProfile> candidates = registry.stream()
    .filter(m -> permittedForTenant(m, request.tenantId()))
    .filter(m -> supports(m, request.requiredCapabilities()))
    .filter(m -> fitsContext(m, preflightInputTokens, outputReserve))
    .filter(m -> passesQualityGate(m, request.evalBucket()))
    .filter(m -> withinBudget(m, estimatedUpperCost))
    .filter(m -> !health.get(m.modelId()).circuitOpen())
    .toList();

ModelProfile selected = rankByPolicy(candidates, policyVersion);
persistRouteDecision(request.taskId(), selected, candidates, policyVersion);
~~~

候选为空时返回明确原因，如 `NO_MODEL_FOR_REGION`、`CAPABILITY_UNAVAILABLE`、`BUDGET_REJECTED`；不能偷偷忽略 Schema、区域或权限约束。`ModelClient` 随后负责供应商协议差异、流式事件、结束原因和 usage 归一化，路由器不应直接解析各家 SSE 文本。

[OpenAI Model selection](https://developers.openai.com/api/docs/guides/model-selection) 与 [Anthropic Choosing a model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) 都建议围绕代表性任务评测模型能力和速度；这里把评测分桶、能力门槛和运行状态组合成路由规则，是本文的工程推导。资料检索日期：2026-11-04，复核日期：2026-11-05。

## 三、缓存要分层：每一层的命中语义不同

“加缓存”容易混淆四种完全不同的复用：

| 缓存层 | 复用内容 | 必须考虑的键与失效条件 |
| --- | --- | --- |
| 供应商 Prompt Cache | 相同前缀的计算状态 | 模型、稳定前缀、工具定义、Schema；由供应商报告命中，应用不把它当旧答案 |
| 精确结果缓存 | 完整请求的已验证回答 | tenant、用户/角色、Prompt、模型、Schema、知识快照、参数；动态事实需短 TTL |
| 检索/工具只读结果缓存 | 文档片段或只读查询回执 | 权限快照、源版本、时间范围、查询参数；业务状态更新后失效 |
| 语义结果缓存 | 相近问法的可复用回答 | 语义阈值之外，还需实体、约束、权限、版本一致和人工评测 |

最安全的起点是**只缓存可证明等价的只读结果**。例如“订单 O-17 的当前状态”随时间变，必须有明确 TTL 或源版本；“执行退款”的结果不能因为问题相似就从缓存里返回“已经执行”。跨租户、跨权限、跨知识版本的命中应当作为安全测试的失败样本。

Prompt Cache 是供应商在相同前缀上复用计算状态，之后仍会生成新答案。它不缩短模型看到的逻辑上下文，也不意味着响应内容相同；缓存输入仍可能计入速率限制。稳定的系统指令、工具定义和 Schema 放在前面，动态订单、用户消息和检索结果放在后面，通常更容易形成复用前缀。但是否命中要看 usage 与供应商条件，不能用“请求看起来差不多”推断。[OpenAI Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)；[Claude Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)（检索日期：2026-11-04，复核日期：2026-11-05）。

缓存键可先写成结构体，再做哈希，避免字符串拼接遗漏字段：

~~~text
CacheKey = hash(
  tenant_id, access_scope_hash, task_type,
  normalized_query, entity_ids, source_version,
  prompt_version, schema_version, model_version,
  tool_result_version, generation_parameters
)
~~~

用户身份不一定要原样写入键，但**访问范围必须可区分**。权限变更、政策撤回、模型/Prompt 升级要能批量失效或自然过期。语义缓存还要在返回前重新校验当前身份和来源有效性，不能只用向量相似度做命中判定。

## 四、成本账本按调用记，按任务算

一次 Agent 任务可能有意图分类、查询改写、主模型、重试、摘要和工具调用。只读最后一次模型的 usage，会把失败与重试藏掉。账本至少保留这几个层次：

~~~text
Task → Step → ModelCall / ToolCall
       request_id、attempt_no、tenant_id、route_id
       provider、model_revision、price_version、currency
       input_tokens、cached_read_tokens、cached_write_tokens
       output_tokens、reasoning_tokens（按供应商语义归一化）
       status、stop_reason、latency、retry_reason
       charged_amount、estimated_amount、reconciliation_status
~~~

**注意计数关系。** 有些供应商把缓存读取包含在总输入里，有些把缓存写入或创建单独报告；推理 Token 往往包含在输出用量的某个子字段里。不要简单把所有字段相加，否则会双计。适配层应给每个供应商写清 `raw_usage → normalized_usage` 的映射，并保留原始响应方便对账。流式调用如果最终 usage 缺失，先写估算值和 `ESTIMATED` 状态，后续用供应商账单或日志对齐，不能当成精确扣费。

一个教学公式（`priceVersion` 中各单位为每百万 Token 的单价）是：

~~~text
单次调用费用 = uncached_input × input_rate
             + cache_read × cache_read_rate
             + cache_write × cache_write_rate
             + output × output_rate
             + 工具及其他计费项

单任务成本 = 该 task_id 下所有实际调用费用之和
每成功任务成本 = 所有计划任务的实际总费用 / 成功任务数
~~~

如果某组 100 个计划任务里只有 80 个成功，且所有调用与重试共花 12 元，那么每成功任务成本是 `12 / 80 = 0.15 元`，不是把失败任务花的钱剔除后再除。还要同时报告成功率 `80/100`、超时/预算拒绝/人工接管数量，以及 P95 延迟。这样才能看出路由把账面单次调用降价后，是否让更多任务失败或重试。

预算要在调用前后都生效：预检用完整请求 Token、输出预留和价格快照估上界；运行中限制任务总耗时、最大调用数、工具次数和租户并发；完成后用实际 usage 入账。`BUDGET_REJECTED` 仍属于计划任务分母，不能只统计被接纳请求的成功率。

[OpenAI Counting tokens](https://developers.openai.com/api/docs/guides/token-counting) 与 [OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits) 说明 Token 预估和多维速率限制需要分别管理；[Anthropic Rate limits](https://platform.claude.com/docs/en/api/rate-limits) 也区分请求、输入和输出 Token 的限制。具体价格应按当日官方报价维护版本，不在本文写死。（检索日期：2026-11-04，复核日期：2026-11-05）

## 五、故障时先判断能不能安全切换

路由与降级的顺序可以这样设计：

~~~text
模型调用失败
  → 记录错误分类和当前响应状态
  → 可恢复错误？剩余总截止时间与预算足够？
  → 同模型有限次退避重试
  → 仍失败且任务允许降级？候选通过同一质量/权限/Schema 门槛？
  → 切备用模型，并给用户或上层任务标明降级
  → 无合格候选：明确失败或等待人工
~~~

错误分类要结合供应商协议：短暂限流、网络中断、服务暂不可用通常可以有限重试；无效参数、余额耗尽、权限拒绝、Schema 不支持属于配置或策略问题，盲目重试只会增加成本。每个供应商和模型设独立并发信号量、连接池与熔断器；租户额度独立，避免一个大租户耗尽其他租户的余量。

流式响应有一个额外边界：已经向客户端发出部分内容时，不能在后面静默换模型并拼接成一个“完整答案”。需要发出 `STREAM_INTERRUPTED` 事件，视业务决定重启一个新尝试并清楚标记版本，或结束请求。涉及写工具的 Agent，还要查外部副作用是否发生；模型重试不等于工具写入可以重放。

一个降级规则必须写清：允许切换的任务类型、最低质量门槛、结构化输出/工具契约兼容性、剩余预算、审计字段和用户可见状态。若备用模型不满足“不执行退款”约束的回归门槛，应直接失败或人工接管，而不是为了可用率输出一个风险更高的答案。

## 六、90 分钟实验：从固定路由走到可回放的策略

先用两个本地 `FakeModelClient` 和固定的 usage 回执，不需要真实 API 费用。建立 40 条请求夹具，至少覆盖：普通 FAQ、金额/否定词、长上下文、结构化输出、工具调用、区域限制、跨租户、模型 429、流式半包、缓存失效和预算不足。

做四组对照：

| 方案 | 路由 | 缓存 | 故障处理 |
| --- | --- | --- | --- |
| A | 全部强模型 | 关闭 | 直接失败 |
| B | 任务类型规则路由 | 关闭 | 同模型有限重试 |
| C | B + 稳定前缀/只读精确缓存 | 开启并记录命中 | 同 B |
| D | C + 健康/预算门槛 | 开启 | 合格候选降级或明确失败 |

每条 Case 记录 `expected_model`、`forbidden_model`、`expected_status`、`allowed_cache_layer` 和 `max_cost`。输出逐 Case 报告，而不是只给四个平均数：

~~~text
quality_pass_rate = quality_pass_count / planned_cases
schema_pass_rate = schema_pass_count / planned_cases
unauthorized_cache_hit_rate = unauthorized_cache_hits / planned_cases
P50、P95 与首 Token 延迟
cache_read/write tokens、cache_hit_rate
total_cost、cost_per_successful_task
retry_count、fallback_count、budget_rejected_count
~~~

质量硬门槛是：跨租户缓存命中为零、禁止动作发生次数为零、结构化输出和权限约束不回退。再比较成本和延迟。若假客户端只模拟缓存命中，应标 `SIMULATED`；没有真实供应商 usage，不能把实验结果写成真实降本百分比。

最终提交物是 `model-registry.json`、`router-policy.json`、`fixtures.jsonl`、`usage-ledger.jsonl` 和一张 A/B/C/D 对照表。第 30 天模型网关阶段项目会把这些字段接入真实服务。

## 七、今天的面试题：模型网关与成本治理

以下题面来自牛客用户公开面经或社区题库，**不是企业官方确认的原题**。资料检索日期为 **2026-11-04**，并于 **2026-11-05** 复核。帖子中的成本百分比属于作者自报，不能当作通用收益或自己的项目实测。

### 题 1：多模型 AI 网关如何设计路由、降级和故障隔离？

- **方向：** 模型网关 / 系统设计
- **难度：** 高
- **来源：** [牛客“去哪儿 AI 应用开发（秋招）一面”用户帖](https://ac.nowcoder.com/discuss/1673529?type=0)。帖子标题含公司与面试轮次，企业未公开核验。
- **参考答案：** 先按租户、地域、数据密级、Schema/工具能力、上下文和预算做硬过滤，再在通过任务评测的候选中比较 P95、成本与错误率。适配层统一消息、流式事件、usage 和错误分类；按供应商隔离连接池与并发，按租户控额度。限流和临时故障可以在总截止时间内有限重试；切备用模型前重新检查质量与契约，流式半包不能静默拼接。
- **追问：** 某供应商 429、另一个供应商余额不足，分别怎么处理？租户 A 突增流量时怎样保护租户 B？

### 题 2：老板要求 Agent 单次成本降 50%，你会先改哪一层？

- **方向：** 成本治理 / Agent 运行时
- **难度：** 中高
- **来源：** [牛客“Agent 成本怎么降 50%”用户讨论](https://www.nowcoder.com/discuss/918987622926548992?sourceSSR=post)。作者自述面试和降本数字，无法独立核验；这里把题目当公开练习题。
- **参考答案：** 先按任务 ID 汇总所有模型调用、摘要、重试、工具和人工接管，按业务类型找高成本且低成功率的分桶。之后依次验证规则/小模型分流、稳定前缀缓存、可证明等价的只读结果缓存、上下文裁剪、最大步数与批处理。每步都在同一评测集报告成功率、P95、总费用和每成功任务成本；没有质量门槛时，便宜模型可能增加重试而使总成本上升。
- **追问：** 成本下降而成功率从 95% 跌到 80%，还算达标吗？缓存命中率升高但每成功任务成本不降，可能是什么原因？

### 题 3：单一模型和多模型路由怎么取舍？

- **方向：** 模型选型 / 平台架构
- **难度：** 中高
- **来源：** [牛客用户整理的“AI Agent 面试高频 100 问”，第 62 题](https://www.nowcoder.com/discuss/922460251717128192?sourceSSR=post&weFlow=true)，为社区整理题，未标注具体企业原题。
- **参考答案：** 单模型起步时协议和回归范围较小；当任务能力、区域、预算和服务可用性出现分化，才值得引入多模型。多模型要有统一 `ModelClient`、注册表、路由策略、逐模型质量门槛和回滚。切换后重新跑结构化输出、工具调用、中文与风险样本，不能把“API 兼容”误当行为兼容。
- **追问：** 新模型价格更低但 JSON Schema 通过率差 2%，如何决定是否灰度？路由器自身出错时如何兜底？

### 题 4：Prompt Cache 与结果缓存有什么区别？怎样防止缓存污染？

- **方向：** Prompt / 缓存安全 / 成本
- **难度：** 中高
- **来源：** [牛客“AI Agent 面试高频 100 问”，第 50 题](https://www.nowcoder.com/discuss/922460251717128192?sourceSSR=post&weFlow=true)，为社区整理题，未标注具体企业原题。
- **参考答案：** Prompt Cache 复用相同前缀的计算状态，仍生成新输出，按供应商 usage 计费；结果缓存则直接复用应用层回答或只读查询结果。结果缓存键要包含租户、访问范围、实体、Prompt/模型/Schema/知识版本与参数，失效依赖源版本或 TTL。语义命中还要重新校验实体、否定约束和当前权限；写操作不能从相似答案缓存推断已执行。
- **追问：** Prompt 顺序变化但总 Token 变少，为什么账单可能上涨？用户角色被撤销后，旧缓存如何失效？

## 资料与下一步

- [OpenAI Model selection](https://developers.openai.com/api/docs/guides/model-selection)：按任务质量、延迟和成本比较候选。
- [OpenAI Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)、[Claude Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)：前缀复用、缓存读写与 usage 的供应商差异。
- [OpenAI Counting tokens](https://developers.openai.com/api/docs/guides/token-counting)、[OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)：预检 Token 与多维限流。
- [Anthropic Choosing a model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)：用代表性任务测选型。

资料检索日期：2026-11-04；复核日期：2026-11-05。明天单独练缓存一致性与失效：让知识版本、权限和时间变化成为固定测试输入，再看哪些缓存能复用、哪些必须失效。
