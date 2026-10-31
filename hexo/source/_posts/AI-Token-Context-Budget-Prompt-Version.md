---
layout: post
title: "Token 与上下文预算怎么做：从 Prompt 版本、压缩到成本可控"
date: 2026-10-30 09:00:00.000
updated: 2026-10-30 09:00:00.000
permalink: /articles/AI-Token-Context-Budget-Prompt-Version.html
comments: true
description: "把 Token 当成 Agent 的容量、延迟和成本预算，设计 Prompt 版本、上下文拼装、压缩、缓存和按租户计量。"
categories:
  - "AI工程"
tags:
  - "Token"
  - "上下文工程"
  - "Prompt"
  - "成本控制"
  - "AI全栈"
  - "模型工程"
---

昨天把模型调用收敛成了 `ModelClient`。今天继续解决一个很容易被 Demo 掩盖的问题：**Agent 为什么越跑越慢、越跑越贵，而且还可能答得更差？**

原因通常不是某一个模型突然变笨，而是每一轮都把系统指令、工具定义、历史消息、检索结果和上一次工具输出重新送进上下文。输入 Token 增长会带来更高的首 token 延迟和费用，也会让真正有用的信息在注意力里被稀释。上下文窗口变大只能延后问题，不能代替预算设计。

今天把 Token 当成一种需要分配、计量和回收的资源，建立一套适合 Java/后端服务的上下文预算方案：Prompt 有版本，消息有优先级，压缩有可回查指针，缓存有命中指标，租户有硬上限。
<!--more-->

## Token 是容量、延迟和费用的共同单位

一次模型请求的资源账本至少包含下面几项：

```text
input_tokens = system + developer + tools + history
             + retrieved_context + current_user
output_tokens = visible_output + tool_arguments + reasoning
billable_tokens = input_tokens + output_tokens
```

不同模型的计费和上下文窗口可能不同，但工程上都要回答四个问题：

1. 这次请求最多允许使用多少输入和输出 Token？
2. 哪些内容必须保留，哪些内容可以裁剪、摘要或外置？
3. 发生重试、压缩或模型降级时，剩余预算是多少？
4. 成本应该归属哪个租户、用户、任务和版本？

不要用字符数直接代替 Token。中文、代码、JSON、URL、图片和不同模型的分词结果差异很大。早期可以用字符数做快速保护，正式计费和边界判断应使用目标模型的 tokenizer 或供应商提供的 usage 字段，并在实际调用后用真实值校正估算器。

### 输入预算和输出预算要分开

```text
context_window >= input_tokens
                 + max_output_tokens
                 + reasoning_reserve
                 + safety_margin
```

`max_output_tokens` 不是“模型一定会输出这么多”，而是要为最坏情况预留的上限。Agent 还要给工具参数、错误修正和最终答案预留空间；如果把整个窗口都填满输入，模型可能还没开始回答就因为输出空间不足而截断。

可以为一次任务建立预算账本：

| 项目 | 例子 | 处理方式 |
| --- | --- | --- |
| 固定前缀 | 系统规则、稳定示例、工具契约 | 版本化，尽量保持字节不变 |
| 当前任务 | 用户目标、当前约束、待办 | 必须保留，结构化表达 |
| 历史上下文 | 最近消息、阶段摘要 | 按 token 阈值滚动压缩 |
| 外部证据 | 检索片段、工具结果 | 只放相关片段，保留引用 ID |
| 输出预留 | 最终答案、工具参数、推理预算 | 设置硬上限，留安全余量 |
| 预算余量 | 重试、澄清、错误修正 | 到阈值时停止扩张 |

## Prompt 是可发布的软件资产

Prompt 版本化不是给文本加一个日期后缀，而是要让一次模型调用能够重现。建议把 Prompt 作为独立记录管理：

```text
prompt_id       = incident_triage
prompt_version  = 2026-10-30.2
content_hash    = sha256(rendered_template)
input_schema    = incident_request_v3
output_schema   = triage_decision_v2
model_policy    = support-agent-default
status          = draft | evaluated | released | retired
owner           = sre-ai
```

每一次请求记录 `prompt_id`、`prompt_version`、模板哈希、输入 Schema、输出 Schema、模型版本、采样参数、上下文构造策略和评测版本。这样排查线上波动时，可以区分：

- Prompt 改动导致指令顺序变化。
- 工具定义或字段描述变化导致 Token 和选择率变化。
- 模型路由变化导致质量或延迟变化。
- 上下文压缩版本变化导致事实丢失。
- 用户输入或检索数据本身发生变化。

Prompt 发布应该像代码发布一样经过草稿、离线评测、灰度和回滚。至少保留一组固定样本，比较任务成功率、Schema 通过率、引用准确率、P95 延迟和每任务成本。只看“回答读起来不错”无法判断一行 Prompt 是否让工具调用或长尾任务退化。

### Prompt 的稳定前缀和动态后缀

如果供应商支持 Prompt Caching，通常只会复用完整匹配的前缀。建议按下面顺序组织请求：

```text
稳定前缀：系统规则 + 版本化示例 + 稳定工具定义
可替换区：租户级策略 + 当前 Skill
动态后缀：用户消息 + 当前检索结果 + 最新工具结果
```

[OpenAI Prompt Caching 官方文档](https://developers.openai.com/api/docs/guides/prompt-caching)说明，缓存复用依赖前缀匹配，工具名称、描述、Schema 和顺序变化都可能破坏命中；缓存减少的是重复处理前缀的成本和延迟，不会复用旧答案，也不代表每次请求都一定命中。

所以不要为了“看起来模块化”而每轮随机排序工具、插入当前时间或重新渲染同一段 Markdown。稳定内容保持字节级一致，动态内容放在后面；同时记录 `cached_tokens`、总输入 Token、首 token 延迟和实际费用，用数据验证缓存是否真的有效。

## 上下文拼装要有预算分配器

把所有消息直接 `messages.addAll()` 是上下文失控的起点。应该先定义每类内容的上限和优先级，再由 `ContextBuilder` 组装一次请求。

```java
public record ContextBudget(
    int maxInputTokens,
    int maxOutputTokens,
    int reserveTokens,
    int systemTokens,
    int taskTokens,
    int recentHistoryTokens,
    int retrievedTokens,
    int toolResultTokens
) {
    public int usableInputTokens() {
        return maxInputTokens - reserveTokens;
    }
}

public record ContextBlock(
    String id,
    BlockType type,
    int estimatedTokens,
    Priority priority,
    boolean required,
    String content
) {}

enum BlockType {
    SYSTEM, POLICY, TASK, STATE, HISTORY, EVIDENCE, TOOL_RESULT, MEMORY
}

enum Priority { REQUIRED, HIGH, MEDIUM, LOW }
```

拼装步骤可以是：

```text
1. 放入 SYSTEM、租户策略、权限和任务状态
2. 放入当前用户目标与完成标准
3. 按相关性选择证据和工具结果
4. 从最近消息向前加入历史，直到达到 history 配额
5. 如果超过总预算，依次执行裁剪、摘要、外置和分流
6. 计算真实/估算 Token，确认仍为 input + output + reserve <= window
7. 固化 context_version，写入 trace
```

`required=true` 的块不能因为普通历史变长而被挤掉。权限范围、审批状态、金额、日期、租户 ID、资源版本和任务完成条件都属于硬约束；超过预算时应减少低优先级历史或降低任务范围，而不是删除这些字段。

### 不是越多信息越好

上下文有三个常见的质量风险：

- **噪声：** 无关的检索片段和工具日志让模型把注意力放在错误位置。
- **冲突：** 旧消息和新数据库状态同时出现，但没有标记哪个版本生效。
- **污染：** 一个子 Agent 收到主 Agent 的全部中间推理和不相关历史，产生错误的委派或重复工作。

每个子 Agent 只接受完成自己任务所需的输入，返回结构化交付物和证据 ID。不要把一个大上下文复制给所有节点；这既浪费 Token，也让责任边界变模糊。

## 上下文压缩：先保存可恢复状态，再生成摘要

上下文压缩的目标不是把文字变短，而是保留下一步决策所需的最小状态。建议按四种动作从低成本到高成本处理：

1. **裁剪：** 丢弃寒暄、重复日志、已经确认且不再影响决策的旧内容。
2. **摘要：** 把一组消息或工具调用结果压缩成阶段结论。
3. **外置：** 将大段文档、完整工具结果、代码 diff 和附件落到数据库或对象存储，给模型保留索引与关键片段。
4. **分流：** 把独立子任务交给独立上下文，只返回结构化结果，不共享整段历史。

压缩前先抽取一个结构化状态，而不是直接让模型“总结一下”：

```json
{
  "goal": "为订单 20261030-001 生成退款审批建议",
  "completion_criteria": ["核对支付状态", "确认租户权限", "输出审批结论"],
  "constraints": ["金额超过 5000 需要人工审批", "不得修改订单"],
  "confirmed_facts": [
    {"key": "payment_status", "value": "PAID", "source": "tool_call_17"}
  ],
  "pending_steps": ["查询退款历史"],
  "decisions": [],
  "artifacts": [
    {"id": "tool_result_17", "location": "s3://...", "summary": "支付状态查询结果"}
  ],
  "version": 4
}
```

摘要正文可以变化，但 `goal`、`constraints`、`confirmed_facts`、`pending_steps` 和 `artifacts` 要有 Schema、版本和来源。金额、编号、时间、权限、否定关系和状态迁移不能只存在自然语言摘要里。

### 什么时候触发压缩

按对话轮数触发不可靠：一轮可能只有十几个 Token，也可能包含一个很长的工具结果。更合理的触发条件是预算和风险的组合：

```text
if estimated_input_tokens > 0.70 * max_input_tokens:
    prepare_compaction()

if estimated_input_tokens > 0.85 * max_input_tokens:
    compact_before_next_model_call()

if context_loss_risk > threshold:
    stop_and_ask_user_or_externalize()
```

提前压缩可以避免下一轮已经没有空间才匆忙总结。每次压缩生成 `summary_version`，并记录它基于哪些 `message_id`、`tool_result_id` 和事件版本。压缩后仍然可以根据引用读取原文，出现摘要错误时能回退和重建。

### 长工具结果怎么压缩

工具返回一万行日志时，不要直接把全文塞回下一轮。推荐保存三层内容：

```text
原始结果：对象存储/数据库，可按权限回查
结构化元数据：查询条件、时间范围、总条数、是否截断、版本
模型摘要：结论、异常行、下一步建议、原文引用 ID
```

摘要必须明确“这是前 1000 条中的摘要”还是“完整结果的统计”，否则模型会把截断数据当成全量数据。对于金额、错误码、资源 ID 等关键字段，保留原始片段或确定性聚合结果，不要只依赖模型重述。

## Token 预算要贯穿 Agent 的每一层

只在 API 网关记录总费用不够。一次任务可能有多个模型调用、重试、摘要调用、子 Agent 和工具结果。需要把预算从租户到步骤逐层传递：

```text
租户月度额度
  -> 用户/项目额度
      -> Task 总预算
          -> Step 预算
              -> Model Call input/output/retry 预算
```

每层都有硬上限和软上限：

- **硬上限：** 达到后拒绝新调用、转异步或转人工，不能由模型请求覆盖。
- **软上限：** 触发小模型、摘要、减少检索 TopK 或缩短输出。
- **保留额度：** 为错误修正、审批和最终答案保留，不允许前面的历史无限消耗。

一次模型调用的计量记录可以是：

```text
trace_id, task_id, step_id, tenant_id,
model, model_version, prompt_version, context_version,
input_tokens, cached_tokens, output_tokens, reasoning_tokens,
retry_count, latency_ms, first_token_ms,
unit_price, estimated_cost, actual_cost,
budget_before, budget_after, finish_reason
```

成本不能只除以请求数。至少要按“成功任务”统计平均成本和 P95 成本；失败重试、压缩调用、路由降级和子 Agent 都要算入同一条任务账单。这样才能比较“多花一次摘要调用是否减少了后续五轮输入”这种真实决策。

### 成本控制的顺序

建议按下面顺序优化：

1. 先移除无关上下文和重复工具结果。
2. 再用结构化输出减少无用解释和重复文本。
3. 合并可并行的判断，减少模型轮次。
4. 稳定前缀，测量 Prompt Cache 命中和实际费用。
5. 按任务难度路由模型，小模型处理分类、改写和摘要。
6. 最后才调低输出上限或强行截断，因为这可能直接损害任务成功率。

优化前后必须使用同一评测集比较质量、延迟和成本。只有成本下降而任务成功率明显下降，不能算优化。

## 模型路由要看任务预算，不是只看价格

Day 3 的 `ModelGateway` 可以在这里加入预算感知路由。路由输入至少包括：

```text
task_type, quality_target, context_tokens,
remaining_budget, deadline, tenant_policy,
data_sensitivity, tool_required, retry_count
```

一个简单策略如下：

```text
if data_sensitivity == HIGH:
    choose approved_model_only
else if remaining_budget < LOW_WATERMARK:
    choose small_model or ask_for_confirmation
else if context_tokens > large_context_threshold:
    choose context-capable_model
else if deadline - now < short_deadline:
    choose low-latency_model
else:
    choose model_from_quality_baseline
```

模型降级不能只改变 `model` 字段。不同模型可能支持不同上下文窗口、Schema、工具数量、缓存策略和安全等级。路由后要重新计算可用预算和能力矩阵；如果目标模型不支持当前输出 Schema，应先切换兼容的 Prompt/解析策略，不能把不兼容请求直接发送出去。

## Java 服务的 ContextBuilder 伪代码

```java
public ContextResult build(
    TaskState task,
    PromptTemplate prompt,
    List<Message> history,
    List<Evidence> evidence,
    ContextBudget budget,
    TokenCounter counter
) {
    List<ContextBlock> blocks = new ArrayList<>();
    blocks.add(required(prompt.renderStablePrefix()));
    blocks.add(required(renderPolicy(task.tenantPolicy())));
    blocks.add(required(renderTaskState(task)));
    blocks.add(required(renderUserGoal(task.userGoal())));

    addByBudget(blocks, evidence, budget.retrievedTokens(), Priority.HIGH);
    addByBudget(blocks, recent(history), budget.recentHistoryTokens(), Priority.MEDIUM);

    int estimated = counter.count(blocks);
    if (estimated > budget.usableInputTokens()) {
        blocks = compactAndExternalize(blocks, budget, counter);
        estimated = counter.count(blocks);
    }
    if (estimated + budget.maxOutputTokens() + budget.reserveTokens()
            > budget.maxInputTokens()) {
        throw new ContextBudgetExceeded(estimated);
    }
    return new ContextResult(blocks, estimated, contextVersion(blocks));
}
```

这里的 `required()` 不是说所有必需内容都永远不能缩短，而是说其语义不能被普通裁剪删除。系统规则可以使用一个经过评测的短版本，工具结果可以外置，历史可以摘要，但任务授权和完成条件必须仍然可验证。

## 可观测性和评测：证明压缩没有把任务压坏

上下文工程要同时看三类指标：

### 资源指标

- 输入、输出、推理和缓存命中 Token。
- 每任务成本、每租户成本、重试成本。
- 首 token、总延迟、上下文压缩耗时。
- 上下文使用率、超限率、平均消息数。

### 行为指标

- 结构化输出通过率。
- 任务成功率、工具选择准确率、引用准确率。
- 压缩前后事实保留率、数字/实体/权限规则错误率。
- 模型降级后的质量差异。

### 运维指标

- Prompt/Schema/模型版本的失败分布。
- 缓存命中下降、上下文超限、摘要失败告警。
- 单租户突发 Token 消耗和预算拒绝率。
- 长任务 P95/P99 延迟及其阶段分解。

为压缩单独准备回归集：长对话、多个冲突事实、包含金额和日期、长工具结果、用户修改约束、人工审批和断点恢复。分别比较“原始上下文”和“压缩上下文”的任务结果，不能只让另一个模型评价摘要是否通顺。

## 今天的实践任务

在 Day 3 的 `ModelClient` 之上实现一个 `ContextBuilder`：

- 定义固定前缀、任务状态、历史、证据和工具结果五类块。
- 为每类块设置 Token 配额、优先级和是否必需。
- 模拟上下文达到 70%、85% 和 100% 时的裁剪、摘要、外置和失败策略。
- 保存 `prompt_version`、`context_version`、`summary_version` 和每次压缩的来源 ID。
- 输出一份成本报告，至少包含输入、输出、缓存命中、压缩调用和重试成本。
- 用 10 条长任务样本比较压缩前后的任务成功率、关键事实保留率和 P95 延迟。

提交物是 `ContextBuilder` 接口、预算分配表、两种压缩策略的对比记录和一份可以解释“为什么删掉这段历史”的 trace。明天继续研究 Embedding、模型路由和缓存，把今天的预算接到具体的检索与模型选择上。

## 近期面试题整理（检索日期：2026-10-30）

以下题目来自近期公开面经和题库页面，页面多数标注原始来源为牛客网；聚合页面的解析经过整理，适合练习回答结构，不能替代真实代码和评测。

### 1. Agent 上下文越来越长，应该怎样处理？

**方向：** 上下文工程；**难度：** 中高。

先给 system、任务状态、检索证据、最近历史和工具结果分别设置 Token 配额，超过阈值按优先级处理：先裁剪重复内容，再做阶段摘要，长结果外置并保留 `result_id`、摘要和查询条件，独立子任务使用独立上下文。金额、时间、编号、权限、用户目标和未完成事项不能只放在自然语言摘要里，必须结构化保存。

**追问：** 为什么不能把 1M 上下文窗口全部用满？

因为输入 Token 仍会消耗延迟和成本，噪声会稀释注意力，输出还需要预留空间；窗口大不代表把全量历史都送进去是最优方案。

来源：[快手 Agent 开发一面：工具兜底、多 Agent 与流式解析](https://mj.mianlingai.com/interview/kuaishou-agent-first-round-931679347587444736/)（页面标注时间 2026-09、来源为牛客网）。

### 2. 上下文压缩时应该保留什么，如何证明没有压坏任务？

**方向：** Agent 记忆与可靠性；**难度：** 中高。

保留当前目标和完成标准、硬约束与授权、已确认事实、任务状态、决策及依据、未完成事项，以及可回查的工具结果和文档引用。压缩后对数字、实体、否定关系、权限和状态做规则校验，再用长任务回归集比较任务成功率、事实保留率、引用准确率和成本，而不是只评价摘要是否通顺。

**追问：** 压缩发现新旧事实冲突怎么办？

两个版本都保留来源和时间，在状态层显式标记当前生效版本；需要时回查原始事件，不能让摘要静默覆盖旧事实。

来源：[阿里云 AI Agent 算法一面面经：上下文压缩时保留什么信息](https://www.nowcoder.com/discuss/933731739082510336?sourceSSR=dynamic&weFlow=true)（页面标注时间 2026-09-01、来源为牛客网）。

### 3. 为什么 Prompt、工具定义和 Skill 顺序会影响缓存命中？

**方向：** Prompt 版本与性能；**难度：** 中高。

Prompt Cache 通常匹配完整的前缀。系统指令、工具 Schema、工具顺序或中间内容变化，会让后续 Token 无法复用。工程上应把稳定规则和工具定义放在前面，动态用户输入、检索结果和工具返回放在后面，并保持同一版本内的字节级稳定；同时用 `cached_tokens`、首 token 延迟和实际费用验证，而不是假设命中。

**追问：** 压缩后 Token 变少，为什么缓存命中率可能反而下降？

压缩会重写早期上下文，新的前缀与旧缓存不再完全匹配。应保留稳定前缀，把变化集中在后缀，并比较“缓存损失”和“输入 Token 减少”哪个更省钱。

来源：[腾讯营销后端一面：Agent 上下文体系与多路归并](https://mj.mianlingai.com/interview/tencent-marketing-backend-2916638/)（页面标注时间 2026-09、来源为牛客网）；缓存机制参考[OpenAI Prompt Caching 官方文档](https://developers.openai.com/api/docs/guides/prompt-caching)。

### 4. 如何降低 Agent 的 Token 成本？

**方向：** AI 平台与成本治理；**难度：** 中高。

先减少输入：检索只取相关片段、工具按需加载、历史滚动摘要、去重 Few-shot；再提高稳定前缀的缓存命中；限制输出解释和 JSON 字段；合并可并行步骤、减少模型轮次；最后按任务难度路由模型。每种优化都要在固定评测集上同时看质量、P95 延迟和每成功任务成本，不能只看账单下降。

**追问：** 简单任务都切到小模型，质量下降怎么办？

先定义任务分级和质量基线，使用小模型做分类/改写/摘要等低风险步骤；质量不达标时回退大模型或请求人工确认，并把路由版本记录在 trace 中。

来源：[腾讯社招一面面经（Agent 方向）](https://mj.mianlingai.com/interview/tencent-backend-social-2915915/)（页面标注时间 2026-09、来源为牛客网）。

### 5. 长流程 Agent 的上下文超限和延迟如何定位？

**方向：** Agent 性能与可观测性；**难度：** 高。

用同一个 `trace_id` 拆分排队、模型首 token、模型总耗时、工具等待、重试、上下文压缩、锁和连接池等待，比较 P95/P99 而不是只看均值。再按任务类型、模型/Prompt/工具版本和上下文长度切分，验证是上下文膨胀、重复工具调用、重试放大还是下游等待。修复后用相同任务集做回归。

**追问：** 1M 上下文还不够怎么办？

先缩小当前任务目标，做分层摘要和外置索引，把独立工作拆给子 Agent，保留可回查的原文；如果业务仍需要全量信息，考虑专门检索、批处理或异步工作流，不能只继续提高窗口上限。

来源：[米哈游 AI Agent 一面：代码生成链路、并发隔离与手撕 LRU](https://mj.mianlingai.com/interview/mihoyo-ai-agent-938914757099130880/)（页面标注时间 2026-10、来源为牛客网）；性能排查思路参考[字节跳动 AI Agent 开发一面面经](https://mj.mianlingai.com/interview/bytedance-ai-agent-first-round-933733520864706560/)（页面标注时间 2026-09、来源为牛客网）。

## 今日资料

- [OpenAI Prompt Caching 官方指南](https://developers.openai.com/api/docs/guides/prompt-caching)：稳定前缀、缓存命中、缓存 Token 和监控方法。
- [OpenAI Prompting 官方指南](https://developers.openai.com/api/docs/guides/prompting)：Prompt 组织、版本维护和缓存前缀建议。
- [Day 3：统一 ModelClient](/articles/AI-ModelClient-Structured-Output-Streaming.html)：消息、结构化输出、流式事件、超时和重试边界。

明天继续把预算接到 Embedding、模型路由和缓存实现，比较“更大模型”“更长上下文”和“更好的检索”分别解决什么问题。
