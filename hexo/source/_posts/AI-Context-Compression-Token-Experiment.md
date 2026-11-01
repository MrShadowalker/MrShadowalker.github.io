---
layout: post
title: "上下文压缩到底省了什么：Token 计量、事实保留与任务成本实验"
date: 2026-11-01 09:00:00.000
updated: 2026-11-01 09:00:00.000
permalink: /articles/AI-Context-Compression-Token-Experiment.html
comments: true
description: "用成对实验比较原始上下文、滑动窗口和结构化摘要，核对真实 Token、缓存、事实保留、任务成功率与每成功任务成本。"
categories:
  - "AI工程"
tags:
  - "Token"
  - "上下文工程"
  - "评测"
  - "成本控制"
  - "AI全栈"
---

[Day 4 的预算设计](/articles/AI-Token-Context-Budget-Prompt-Version.html)给出了 ContextBuilder，[Day 5 的 Golden Set](/articles/AI-Prompt-Regression-Golden-Set.html)给出了回归门槛。今天要把两者接起来，回答一个更具体的问题：**压缩历史后，整项任务是否真的更便宜，而且没有丢掉决定结果的事实？**

只看“输入 Token 减少了 40%”很容易得出错误结论。摘要本身要调用模型；改写早期上下文可能降低 Prompt Cache 命中；漏掉一次审批状态会引发重试或人工接管。最终应该比较的是**同一批任务的成功率、总费用和延迟**，而不是单次请求长度。

本文给出实验设计、计量口径、可直接照着实现的数据结构和报告模板。没有实际模型密钥和固定评测环境时，结果栏保持“待测”，不把示例数字包装成收益。
<!--more-->

## 实验问题与三种策略

固定模型版本、Prompt、输出 Schema、工具夹具、知识快照和最大输出 Token，只改变历史处理方式：

| 策略 | 输入构造 | 想验证的假设 | 主要风险 |
| --- | --- | --- | --- |
| A：原始上下文 | 保留完整对话和工具结果，直到接近窗口上限 | 事实最全，但成本和延迟可能增加 | 噪声、旧事实冲突、超窗 |
| B：最近 N 轮 | 只保留最近消息；系统规则和当前用户请求仍保留 | 最容易减少输入 | 早期授权、否定词、金额和来源丢失 |
| C：结构化状态＋摘要＋原文指针 | 保留当前任务状态与硬约束；压缩已完成历史；长结果只放摘要和可回查 ID | 减少重复内容，保留决策所需事实 | 摘要模型漏项、回查成本、缓存前缀变化 |

B 是风险对照组，不是推荐的生产策略。C 的“原文指针”也不是让模型自动知道被删除的内容，而是允许 Runtime 在回答依赖缺失事实时读取原始事件或工具结果。没有可回查的存储，摘要一旦丢失信息就无法恢复。

这里的“压缩”与“截断”要分清：截断直接丢掉旧消息；摘要压缩产生新内容；工具结果清理用占位或引用代替大结果；外部记忆则把信息放在上下文窗口之外。[OpenAI Responses 的自动截断](https://developers.openai.com/api/reference/resources/responses/methods/retrieve)会从会话开头移除项目，不能把它当作保真摘要。实验中关闭自动截断，由应用明确处理超限。

## 准备能检出信息丢失的样本

先从 Day 5 的 Golden Set 选 12–20 个长任务，至少覆盖：长对话、长工具结果、用户修改约束、金额与日期、否定关系、审批中断、旧版与新版规则冲突、证据引用。每个样本保留完整输入和确定性判分条件。

下面的 JSON 是**实验夹具示意**，不是线上订单：

~~~json
{
  "case_id": "refund-017",
  "tenant_id": "tenant-demo",
  "history_fixture": "fixtures/refund-017-full.json",
  "state": {
    "order_id": "O-017",
    "amount_cny": 300,
    "approval": "PENDING",
    "current_user_constraint": "只查询原因，不执行退款"
  },
  "evidence_ids": ["policy-v3-p4", "order-O-017-v2"],
  "expected": {
    "action": "EXPLAIN_ONLY",
    "must_keep": ["O-017", "300", "PENDING", "不执行退款"],
    "forbidden_actions": ["EXECUTE_REFUND"],
    "required_evidence_ids": ["policy-v3-p4"]
  }
}
~~~

把“只查询原因，不执行退款”放在早期历史的一条消息，再让用户在后续消息里谈其他细节，就能测试 B 是否误删约束。另造一条样本，让旧政策和新政策同时出现，检查 C 是否保留版本与生效时间。不要只拿“帮我总结这段话”评估压缩，因为它无法检验任务状态、权限和行动边界。

每条样本保存 <code>case_id</code>、样本版本与哈希、标注人、风险等级、原始事件 ID、预期动作和禁止动作。运行时固定随机种子或温度参数只能降低部分波动，不能保证服务端逐字复现；每个策略至少重复两次，并保留完整响应和 trace。

## 请求前计量：数的是完整请求

预算应区分三个量：

~~~text
context_window       = 模型允许处理的总窗口
output_reserve       = 本次最大输出 + 安全余量
usable_input_limit   = min(模型输入上限, context_window - output_reserve)
~~~

只数历史文本会漏掉角色边界、工具定义、输出 Schema、图片或文件的处理成本。预检必须使用**最终即将发送的请求对象**。OpenAI 的 [Input Token Count API](https://developers.openai.com/api/docs/guides/token-counting)接收与 Responses API 相同的输入结构，可在调用前计数；本地 tokenizer 可做快速估算和批量筛选，但不能替代包含工具、文件和模型侧格式的完整请求计数。若接入 Anthropic，则使用其 [Token Counting API](https://platform.claude.com/docs/en/build-with-claude/token-counting)，并按其文档理解预估与最终 usage 的差别。

一个最小的 OpenAI 预检调用可以这样做。<code>candidate-request.json</code>由 ContextBuilder 生成，包含与正式请求一致的 model、input、tools 和输出格式；密钥从环境变量读取，不写进评测集或仓库。

~~~bash
curl https://api.openai.com/v1/responses/input_tokens \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d @candidate-request.json
~~~

预检只回答“输入能否装下”；输出还要预留。若必需规则、授权和当前任务状态已经超过可用输入上限，就缩小任务范围、拆分阶段或明确失败，不能静默删掉硬约束。正式请求返回超窗错误时，记录估算误差并有限重试一次新的候选上下文；不要对同一超限请求无限重试。

## 响应后结算：供应商 usage 不能直接混用

正式计费以供应商返回的 usage 和当前价格表为依据。缓存读、缓存写和推理 Token 常常是总量的**子集**，不能重新加到总量上。

| 字段口径 | 该怎样理解 | 易错点 |
| --- | --- | --- |
| OpenAI Responses 的 input_tokens | 本次总输入；cached_tokens 及可用模型的 cache_write_tokens 是其分项 | 总输入再加缓存读写会重复计数 |
| OpenAI Responses 的 output_tokens | 模型生成总量，可能包含推理和不可见格式；reasoning_tokens 是分项 | 可见文本分词数不等于账单输出 |
| Anthropic Messages 的 input_tokens | 未缓存的输入部分 | 总输入还要计入 cache_read_input_tokens 和 cache_creation_input_tokens |
| 压缩调用、失败调用、重试 | 都可能有独立 usage 与费用 | 只算最终成功回答会低估任务成本 |

这些口径分别见 [OpenAI Token Counting](https://developers.openai.com/api/docs/guides/token-counting)、[OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)和 [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)。价格、缓存写入档位和 TTL 随模型变化，实验把价格表版本记录在运行元数据中，不在代码里写死一个长期有效的单价。某个 usage 子项缺失时，先由供应商适配器查该模型的语义；无法确定就标记“账单待核对”，不要把未知当成零。

Java 侧可以先把 OpenAI 用量归一到互斥的计费桶。下例仅展示校验逻辑；缓存写入的 30 分钟、12 小时等档位由适配器按实际返回字段填充，旧模型没有写入档位时必须由模型配置显式确认：

~~~java
record TokenUsage(
    long input, long cacheRead, long cacheWrite30m,
    long cacheWrite12h, long output, long reasoningPart
) {
    long ordinaryInput() {
        long ordinary = input - cacheRead - cacheWrite30m - cacheWrite12h;
        if (ordinary < 0 || reasoningPart > output) {
            throw new IllegalArgumentException("invalid provider usage");
        }
        return ordinary;
    }
}
~~~

费用按各桶分别乘以当时的每百万 Token 单价，再加工具、存储等任务成本：

~~~text
model_cost =
  (ordinary_input × regular_input_rate
 + cache_read × cache_read_rate
 + cache_write_30m × cache_write_30m_rate
 + cache_write_12h × cache_write_12h_rate
 + output × output_rate) / 1_000_000

task_cost = 所有主调用 + 所有摘要/压缩调用
          + 失败与重试调用 + 工具/存储费用
~~~

这里的 <code>reasoningPart</code>只用于分析输出构成，**不再额外乘一次输出单价**。Anthropic 适配器要单独归一化：其普通输入、缓存读取、缓存创建字段相加才是完整输入，不能复用上面的 OpenAI 减法。对于返回多轮压缩用量的接口，还要核对每次迭代 usage，避免只看顶层字段漏账。

## 执行器：先判正确，再比较成本

为三种策略运行同一组样本，保持版本组合不变：

~~~text
for case in frozen_golden_set:
    for strategy in [RAW, RECENT_ONLY, STATE_SUMMARY_POINTER]:
        for repeat in [1, 2]:
            request = context_builder.build(case, strategy)
            preflight = count_complete_request(request)
            if preflight + output_reserve > context_window:
                record(case, strategy, "BUDGET_REJECTED")
                continue
            response = model_client.call(request)
            verdict = deterministic_judge(case.expected, response)
            record(preflight, usage, latency, verdict, trace_id)
~~~

真实执行时随机化策略顺序，避免总是让某个策略独享热缓存。记录实际缓存读写，不把“第二次请求一定命中”当作前提；按冷、热缓存状态和任务长度分别看结果。若摘要由模型生成，摘要请求本身也必须记录使用量、耗时、模型版本和失败状态。

判分分两层：

1. **摘要/上下文层：** <code>must_keep</code> 中的金额、日期、否定关系、审批状态、租户与证据 ID 是否仍可从压缩后状态或原文指针回查。
2. **任务层：** 最终结构化动作是否正确，是否触发禁止动作，证据 ID 是否对应正确版本，Runtime 能否在需要时回查原文。

把高风险硬规则作为单独门槛。即使 C 的平均 Token 最少，只要把“禁止退款”变成“允许退款”，就不能用成本收益抵消该失败。LLM Reviewer 可以辅助判断解释质量，但行动、权限、金额和引用应尽可能由确定性规则判定。

### 报告字段与计算口径

每次调用记录：

~~~text
experiment_id, case_id, strategy_version, repeat,
model_id, model_version, prompt_hash, context_builder_version,
dataset_hash, tool_fixture_version, price_table_version,
preflight_input_tokens, actual_input_tokens,
cache_read_tokens, cache_write_tokens, output_tokens,
reasoning_tokens_subset, summary_call_tokens, retry_tokens,
latency_ms, first_token_ms, trace_id, verdict, failure_reason
~~~

聚合指标不要只报平均值：

~~~text
任务成功率       = 成功样本数 / 有效样本数
关键事实保留率   = 被保留且可核验的必需事实数 / 必需事实总数
缓存读占比       = sum(cache_read_tokens) / sum(actual_input_tokens)
每成功任务成本   = 所有样本的总成本 / 成功样本数
压缩净收益       = 原始策略总成本 - 压缩策略总成本
~~~

成功样本数为零时，每成功任务成本记为“不适用”，不能记零。再按高风险任务、长对话、长工具结果、约束反转、冷/热缓存切片，报告 P50/P95 延迟和逐 Case 的 <code>PASS → FAIL</code>。样本量小就展示原始计数和不确定性，不声称“成本降低 X%”已适用于全部流量。

实验报告先用空表，完成真实调用后再填：

| 策略 | 任务成功率 | 关键事实保留率 | 平均实际输入 Token | 缓存读占比 | P95 延迟 | 每成功任务成本 |
| --- | --- | --- | --- | --- | --- | --- |
| A 原始上下文 | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 |
| B 最近 N 轮 | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 |
| C 状态＋摘要＋指针 | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 |

## 压缩可能省 Token，也可能损失缓存

Prompt Cache 复用的是匹配的前缀计算状态，**不是旧答案缓存，也不会缩短模型看到的逻辑上下文**。压缩改写早期历史后，后面的前缀可能无法继续匹配；因此“输入更短”和“缓存命中更低”可以同时发生。[OpenAI Prompt Caching 文档](https://developers.openai.com/api/docs/guides/prompt-caching)也明确缓存 Token 仍计入输入和速率限制。

对一次压缩后的后续多轮任务，净费用可以写成：

~~~text
net_saving(n) =
  sum(第 i 轮原始方案费用 - 第 i 轮压缩方案费用)
  - 压缩调用费用
  - 因丢失信息产生的回查、重试和人工接管费用
~~~

这里先通过质量门槛，再讨论盈亏平衡轮数。只挑一轮热缓存请求、只统计回答费用，或者把缓存命中率当作最终业务指标，都会高估收益。长上下文也不等于更可靠：论文 [Lost in the Middle](https://arxiv.org/abs/2307.03172)展示了相关信息处于长输入中间位置时，若干模型与任务的表现可能下降；这提示我们在实验里改变关键事实的位置，不能把论文结果直接当作自己模型的实测值。

## 今天的实践任务

在 Day 3 的 ModelClient、Day 4 的 ContextBuilder 和 Day 5 的 Golden Set 上加一个本地实验执行器：

1. 准备至少 12 条 JSONL 样本，覆盖金额、日期、否定约束、审批、证据版本和长工具结果；保留原始事件 ID。
2. 实现 A/B/C 三种上下文策略，输出完整请求、策略版本和上下文哈希；C 的摘要必须保留可回查指针。
3. 加入请求前完整计数与输出预留；超限时记录明确结果，不让模型服务端静默裁剪。
4. 接入至少一个供应商的 usage 适配器，分别记录普通输入、缓存读写、输出、压缩和重试；未知字段标记待核对。
5. 每个 Case 和策略至少运行两次，用规则检查最终动作与事实保留，输出逐 Case diff 和上面的空表实测值。
6. 若没有 API 密钥，先用固定响应夹具验证账本和判分器，报告标为“本地夹具验证”；不得把它写成真实模型节省金额。

提交物是样本、三个策略实现、usage 归一化代码、逐 Case 报告和一份“采用或拒绝 C”的决定。Day 7 将用本周的 ModelClient、预算和评测结果做第一次周复盘与小测。

## 近期面试题整理（检索日期：2026-11-01）

以下题面按公开牛客帖子重述；参考答案和追问由本文整理。帖子中的公司、岗位与面试经历是发帖者自述或二次整理，**未经企业官方核验**，不能称为官方题库。

### 1. 上下文压缩怎样算 Token，压缩失败如何回退？

**方向：** Token 预算与 Agent 恢复；**难度：** 高。

**参考答案：** 用目标模型的完整请求预检计算系统指令、工具 Schema、历史、检索和工具结果，减去输出预留与安全余量。正式调用后以 usage 校准。压缩前保存任务状态、授权、审批、关键事实和原文引用；压缩后做规则校验。若必需事实丢失，回退到上一个 checkpoint，减少低优先级证据或拆任务，不能悄悄丢弃硬约束。

**追问（本文延伸）：** 压缩率更高但高风险样本成功率下降，是否能发布？

不能。先看逐 Case 的硬失败和风险切片；高风险退化阻断发布，成本收益只在质量门槛通过后讨论。

来源：[牛客：字节跳动 AI Agent 开发岗公开帖子](https://www.nowcoder.com/discuss/926273296180547584?sourceSSR=dynamic)（页面显示 09-07，年份未在可见正文标出；帖子可见“怎么算 token”“失败回退”和信息丢失评估，经历为作者自述）。

### 2. Token 消耗突然增加，怎样定位原因？

**方向：** 模型网关与成本可观测性；**难度：** 中。

**参考答案：** 先把总费用拆成流量、每次输入/输出量、模型步数、重试次数与单价变化。按 trace、任务类型、租户、模型/Prompt/工具版本切片，核对缓存读写、检索 TopK、工具返回长度、上下文摘要失败和循环调用。修复后用同一任务集比较成功率、P95 延迟和每成功任务成本，避免“单请求变便宜但任务重试翻倍”。

**追问（本文延伸）：** 平均每次请求 Token 降了 30%，为什么账单仍可能上涨？

任务轮数、重试率、缓存写入、输出长度或高价模型占比可能上涨；应以任务为分母，把失败调用也计入。

来源：[牛客：影石创新 AI Agent 一面面经整理](https://api-cdn.nowcoder.com/discuss/919595418265059328?sourceSSR=dynamic)（页面显示 08-19，标题标注面试日期 2026-08-09；属于公开整理稿，非企业官方记录）。

### 3. 换模型并做 KV 缓存优化后，怎样权衡速度、准确率和费用？

**方向：** 缓存实验与模型选择；**难度：** 高。

**参考答案：** 先区分生成过程内部 KV、跨请求 Prompt 前缀缓存和应用层答案缓存，三者口径不同。固定任务集和版本，按模型、长短上下文及冷/热缓存做对照，量首 Token 延迟、端到端延迟、正确率、实际缓存读写和每成功任务成本。不能把一次热缓存调用的低延迟外推到全部请求。

**追问（本文延伸）：** 为什么前缀缓存不能替代上下文压缩？

缓存复用计算，不删除逻辑输入；长历史仍占上下文窗口且通常仍有缓存输入费用。压缩可能降低缓存命中，必须比较任务级净收益。

来源：[牛客：恒生电子 AI 应用开发岗面经整理](https://www.nowcoder.com/discuss/943147564042362880?sourceSSR=post)（页面显示 10-23，标题标注面试日期 2026-09-23；题面与经历来自公开整理稿）。

### 4. 上下文长度超限时，系统怎样安全恢复？

**方向：** 上下文工程与故障处理；**难度：** 高。

**参考答案：** 请求前对完整输入计数并预留输出；优先删除重复、过期、低相关证据，外置长工具结果并保留 ID，再尝试结构化压缩。若必需块仍超限，就拆阶段或选择符合权限和预算的长窗模型。供应商返回超限错误时，记录估算偏差并有界重建请求；恢复过程中维持工具调用与结果配对，不重复执行有副作用的工具。

**追问（本文延伸）：** 本地估算显示未超限，供应商却拒绝请求，下一步怎么做？

保存完整请求的结构哈希和预检/实际计数差，检查工具 Schema、图片、文件与模型版本；更新估算器和安全余量，再运行一次有界重试。

来源：[牛客：阿里巴巴千问技术部一面面经整理](https://www.nowcoder.com/discuss/942757774100815872?sourceSSR=enterprise)（页面显示 10-22 已编辑，标题标注面试日期 2026-09-16；经历与公司归属未经企业官方确认）。

## 今日资料

- [OpenAI Counting tokens](https://developers.openai.com/api/docs/guides/token-counting)：完整请求的调用前输入计数，以及输出 usage 与可见文本的差别。
- [OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)：前缀复用、缓存读写、速率限制与模型差异。
- [OpenAI Compaction](https://developers.openai.com/api/docs/guides/compaction)：服务端与独立压缩，以及续接时的状态边界；本文实验仍以应用层 A/B/C 对照为主。
- [Anthropic Token Counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)与 [Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)：对比不同供应商的计数和 usage 口径。
- [Lost in the Middle 论文](https://arxiv.org/abs/2307.03172)：长上下文中关键事实位置可能影响结果，为样本设计提供依据。

以上技术资料与面试题均于 **2026-11-01** 检索。明天做 Day 7 首周复盘和小测，检查本周交付是否真的可以组成一个可回放的最小模型服务。
