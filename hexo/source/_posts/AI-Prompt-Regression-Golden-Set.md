---
layout: post
title: "Prompt 改一行如何安全上线：Golden Set、回归门槛与灰度"
date: 2026-10-31 09:00:00.000
updated: 2026-10-31 09:00:00.000
permalink: /articles/AI-Prompt-Regression-Golden-Set.html
comments: true
description: "用一套可复现的 Golden Set 检查 Prompt、模型和上下文策略的改动，给企业级 Agent 建立发布门槛。"
categories:
  - "AI工程"
tags:
  - "Prompt"
  - "评测"
  - "AI全栈"
  - "Agent"
  - "工程实践"
---

昨天为模型调用建立了 Token 账本和 `ContextBuilder`。它们有了版本和预算，接下来要回答上线前最关键的问题：**新 Prompt 比旧版好在哪里，又把哪些原来正确的任务改坏了？**

在普通 Java 服务里，接口字段变更有单元测试和契约测试；Prompt 改一行却可能让模型换工具、漏掉引用、把“先审批”理解成“直接执行”。只挑几道顺手的问题人工试聊，很难发现回归。今天把 Prompt 变更做成一次可复现的评测实验，再决定是否灰度发布。
<!--more-->

## 先固定比较对象：一次发布是一个版本组合

模型输出受多个变量共同影响。比较 Prompt A 和 Prompt B 时，如果同时切了模型、检索索引和工具 Schema，就无法把差异归因到 Prompt。

一次评测运行至少记录：

```text
experiment_id
dataset_id + dataset_version + dataset_hash
prompt_id + prompt_version + rendered_hash
model_provider + model_id + model_version
generation_params + output_schema_version
context_builder_version + knowledge_snapshot
tool_fixture_version + policy_version
evaluator_version + run_timestamp
```

这里的 `dataset_hash` 和 `rendered_hash` 用于确认内容真的相同。`temperature=0` 可以减少一部分变化，却不能承诺跨服务、跨模型版本或所有硬件路径都得到逐字一样的结果。因此评测目标不是追求每个字节都相同，而是判断**业务结果是否稳定满足约束**。

最小发布单元可以写成：

```text
release = {
  prompt: incident_triage@v4,
  model: approved_model@2026-10,
  schema: triage_decision@v2,
  context: budget_policy@v3,
  tools: incident_tools@v5,
  policy: tenant_policy@v7
}
```

评测报告绑定整个组合。出问题时回滚组合，而不是只把 Prompt 字符串改回去，留下不兼容的 Schema 或工具版本。

## Golden Set 保存的是任务真相，不只是标准答案

“输入问题 + 一句标准回答”适合少数事实问答，不够覆盖 Agent。一个样本还需要租户身份、数据快照、工具返回、必须满足的规则和禁止行为。下面的退款 Case 是虚构示例：

```json
{
  "case_id": "refund_approval_017",
  "scenario": "refund_over_limit",
  "risk": "high",
  "input": {
    "user_id": "user_A",
    "tenant_id": "tenant_1",
    "message": "帮我处理订单 O-17 的 6200 元退款"
  },
  "fixture": {
    "order_snapshot": "orders@2026-10-31-001",
    "tool_results": "refund_tools@fixture_12",
    "policy_version": "refund_policy@v7"
  },
  "expected": {
    "final_state": "WAITING_FOR_APPROVAL",
    "must_call": ["get_order", "get_refund_policy"],
    "must_not_call": ["execute_refund"],
    "required_fields": ["order_id", "amount", "approval_reason"]
  },
  "source": "production_failure_2026_10_18",
  "reviewed_by": ["finance_owner", "ai_engineer"],
  "dataset_version": "golden_2026_10_31"
}
```

这个样本的“正确结果”是进入 `WAITING_FOR_APPROVAL`，不是写出一段听起来合理的退款说明。评测执行器必须隔离写操作，给 `execute_refund` 注入模拟工具；否则评测本身可能影响真实订单。

样本来源建议分为四类：

| 来源 | 价值 | 需要检查 |
| --- | --- | --- |
| 生产故障 | 真实失败和长尾条件 | 脱敏、是否还可复现 |
| 人工设计 | 覆盖权限、边界、异常 | 是否贴近真实任务 |
| 历史工单 | 高频场景和表达差异 | 答案是否已过时 |
| 合成样本 | 扩大组合覆盖 | 事实、规则和引用是否真实 |

合成样本不能直接成为“金标”。要有人工或确定性程序核对其来源、预期状态和权限规则。真实线上样本也需要脱敏，并保留能够复现的知识快照和工具夹具。

### 覆盖矩阵比堆数量更有用

至少按四个维度分层：

```text
任务类型 × 难度 × 风险 × 失败方式
```

例如知识问答分“直接命中、证据冲突、无权限、无证据”，工具任务分“正常执行、参数缺失、超时未知、需要审批、用户取消”。每个格子记录样本数和最近一次线上出现频率。样本总数很多，但“越权拒答”只有一条，仍然是明显缺口。

训练 Prompt 时会反复看见的开发集，与发布前才运行的冻结验收集应分开。若把所有错误样本都直接写入 Prompt 示例，验收集又与示例重叠，就会高估实际效果。冻结集也不是永远不变：业务规则变更时需要新版本和复核记录，但不能在看见候选结果后悄悄改预期。

## 评测器分层：规则先判，模型辅助判，人工兜底

一个业务任务至少有三种判分方式：

1. **确定性规则。** JSON Schema、必填字段、枚举、工具名、参数、状态迁移、禁用动作、金额计算、引用 ID 是否存在。
2. **模型评审。** 表达清楚程度、语义等价、解释是否覆盖关键依据等难用规则判定的维度。
3. **人工复核。** 高风险决策、规则与模型结论冲突、评分器低置信、线上新型失败。

先判硬规则，再让模型评审软质量。若样本要求“不执行退款”，实际调用了 `execute_refund`，即使回答很礼貌，也应直接失败。裁判模型的评分不能覆盖安全硬失败。

```java
EvalResult evaluate(Case sample, Trace trace) {
    List<Violation> hard = new ArrayList<>();
    hard.addAll(schemaEvaluator.check(trace.finalOutput()));
    hard.addAll(stateEvaluator.check(sample.expected(), trace));
    hard.addAll(toolEvaluator.check(sample.expected(), trace.toolCalls()));
    hard.addAll(policyEvaluator.check(sample, trace));

    JudgeScore soft = hard.isEmpty()
        ? judge.evaluate(sample.rubric(), trace.finalOutput())
        : JudgeScore.notRun();

    return new EvalResult(sample.caseId(), hard, soft, trace.usage());
}
```

裁判模型也会有偏好和波动。它的 Rubric 要写清评分维度与证据要求，保存裁判 Prompt/模型版本，并用人工标注的“金标集”测误判和漏判。对新旧版本做两两比较时，可以交换答案展示顺序，检查位置偏好；绝不能把裁判分数当成业务正确性的唯一来源。LangSmith 的[评测类型文档](https://docs.langchain.com/langsmith/evaluation-types)也区分代码评测、模型评审、成对评测、离线回归和线上监控；腾讯云的[评测配置文档](https://cloud.tencent.com/document/product/851/132066)则把评测集、模板和基线作为可复用的配置资产。

## 指标要有分母和切片

只有“平均分 8.6”无法决定能否发布。建议至少报告：

| 指标 | 分子/分母 | 用途 |
| --- | --- | --- |
| 任务成功率 | 满足全部必需条件的运行 / 有效运行 | 判断业务结果 |
| 硬规则违规率 | 出现越权、禁用工具或非法状态的运行 / 有效运行 | 安全门禁 |
| Schema 通过率 | 结构合法且完成的输出 / 需要结构输出的运行 | 接口可靠性 |
| 工具参数正确率 | 符合预期和权限的工具调用 / 需要工具调用的运行 | Tool Calling 质量 |
| 每成功任务成本 | 全部样本实际成本 / 成功运行数 | 真实经济性 |
| P95 总延迟 | 有效运行耗时的第 95 百分位 | 长尾体验 |

要分别展示场景、难度、风险、租户策略和模型路由的切片结果。总体成功率上升 2%，但高风险审批样本从 100% 掉到 80%，不能发布。未执行、超时、拒答和人工接管要有独立状态，不能从分母里随意删掉。

每条样本保存新旧版本的结果差异：

```text
PASS -> PASS：保持正确
PASS -> FAIL：回归，优先排查
FAIL -> PASS：修复
FAIL -> FAIL：仍待解决
```

每次 Prompt 变更先看 `PASS -> FAIL` 的清单，再看总分。真实问题通常藏在几个具体的回归 Case 里。

## 随机性：做成对比较和重复运行

即使冻结版本，模型输出也可能有波动。对关键样本可在同一环境里重复运行，并把旧版和候选版成对执行：

```text
for case in frozen_dataset:
    for repeat in 1..3:
        old = run(case, baseline_release, same_fixture)
        new = run(case, candidate_release, same_fixture)
        compare(case.id, repeat, old, new)
```

“重复 3 次”只是小团队的入门预算示例，不代表统计上充分。报告要给出每个 Case 的通过次数、总体差异和置信区间或至少波动范围；样本太少时，把结论写成“有待观察”，不能宣称微小提升已经被证实。高风险的确定性规则应要求每次都通过，不用平均分稀释一次严重违规。

如果要评估 Prompt 一行改动，其他变量尽量固定；如果评估模型升级，则让旧模型和新模型读取同一批样本、同一知识快照和工具夹具，并保留各自原始 Trace。Google Cloud 的[评测数据集文档](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/evaluation-dataset)说明，评测集要保存输入、可选参考答案、对话历史和 Agent 中间事件；这些字段正是复现多步任务所需的信息。

## 发布门槛：把“可以上线”写成可检查的规则

门槛应由业务风险决定。下面是一组**示例**，用于演示如何写规则，不是通用行业标准：

```text
阻断：任何高风险样本出现越权或未经审批的写操作
阻断：候选版新增严重 PASS -> FAIL，且没有业务负责人签收
阻断：需要 JSON Schema 的样本出现未处理的非法结构
观察：总体成功率低于旧版，或高风险切片明显下降
观察：每成功任务成本、P95 延迟超过事先约定的预算
放行：以上门槛通过，且回归清单已经归因
```

门槛不要在看完候选结果后临时调整，否则评测就变成了找理由发布。业务方、模型工程师和安全负责人应提前确认哪些错误是硬阻断，哪些可以在灰度中观察。

可把评测接入 CI：

```text
PR 修改 Prompt/Schema/模型路由
  -> 渲染并记录版本哈希
  -> 运行快速契约集（规则，秒级）
  -> 运行冻结 Golden Set（模型调用，异步）
  -> 生成逐 Case diff 和切片报告
  -> 检查发布门槛
  -> 人工审阅高风险变化
```

不要把每次提交都绑定巨额全量模型评测。可将快速契约集放在 PR 阶段，较大回归集放在合并前和每日任务中；但任何正式发布都要有对应的冻结集报告和版本组合。

## 灰度是离线评测后的第二道门

离线样本无法覆盖所有真实输入。候选版通过回归后，先做影子运行：旧版仍给用户结果，候选版在相同请求上只生成建议和 Trace，不执行真实副作用。再按低风险任务、租户或流量比例放量。

灰度面板至少看任务成功率、人工接管率、硬规则违规、Schema 失败、每成功任务成本、P95/P99 延迟和用户反馈。比较时按相同任务类型和风险等级切片，否则新版本刚好分到简单请求，会造成虚假的改善。回滚条件和负责人在发布前写好，触发后能按版本组合切回旧版。

线上低分、用户纠错和工具失败应进入候选样本池。每条样本先脱敏、复现、标注并审查，再加入下一版 Golden Set；不能把线上日志不经筛选地倒入评测集。阿里云百炼的[模型评测文档](https://help.aliyun.com/zh/model-studio/model-evaluation-overview)把评测数据集与已有推理结果集分开，提醒我们评测时要区分“重新调用模型”和“仅给既有输出评分”的成本。

## 今天的实践任务

用 Day 3 的 `ModelClient` 和 Day 4 的 `ContextBuilder` 搭一个最小评测执行器，不需要接真实退款系统：

1. 准备 20 条 JSONL 样本：正常、缺字段、证据冲突、工具超时、越权各至少 4 条。
2. 每条样本保存 `case_id`、风险、输入、工具夹具、预期状态、禁止动作、数据版本和标注人。
3. 建立规则评分器，检查 Schema、状态、工具名、工具参数与权限。先不接裁判模型，也能跑出第一份报告。
4. 让旧版与候选 Prompt 在相同夹具上各运行 3 次，输出逐 Case 的 `PASS -> FAIL` 清单。
5. 报告任务成功率、硬规则违规率、Schema 通过率、P95 延迟和每成功任务成本，并写明样本量限制。
6. 设置一个严重回归样本，验证 CI 发布门槛确实阻断候选版。

交付物是评测集、版本清单、执行器、逐 Case diff 和一份放行/阻断记录。Day 7 会把本周的接口、预算与评测结果做第一次复盘和小测。

## 近期面试题整理（检索日期：2026-10-31）

以下题面来自公开面经，参考答案和追问由本文按工程实践重新整理。牛客部分原帖的直达页在检索时仅返回页面壳，题面经公开搜索索引核对；公司归属和面试日期按页面自述记录，不能视为企业官方题库。

### 1. 评测集如何构建，怎样保证场景覆盖和可用性？

**方向：** Agent 评测集；**难度：** 中高。

**参考答案：** 从真实日志和业务流程抽样，再按任务类型、难度、风险、失败方式建立覆盖矩阵。每个 Case 有输入、数据快照、工具夹具、预期状态、禁止动作和判分规则；高风险样本由业务与工程人员复核。开发调参集和冻结验收集分开，防止把测试题写进 Prompt 后虚高。

**追问（本文延伸）：** 合成样本能直接放进 Golden Set 吗？

不能。先核验业务事实、权限规则和引用来源，再经人工或确定性程序标注。合成样本可补覆盖，不能靠模型自己生成、自己判对。

来源：[腾讯 AI Agent 开发公开面经原帖](https://api-cdn.nowcoder.com/discuss/931015480939204608?sourceSSR=post)（页面自述面试时间 2026-08-20，公开原帖 2026-09；题面经搜索索引及[可读聚合页](https://mj.mianlingai.com/interview/tencent-ai-agent-qiuzhao-931015480939204608/)核对）。

### 2. Agent 评测体系由哪些部分组成？

**方向：** AI 平台评测流水线；**难度：** 中。

**参考答案：** 四个部分：版本化评测集、固定环境的执行器与 Trace、规则/模型/人工分层判分器、逐 Case diff 与分场景报告。执行器要冻结模型配置、知识快照和工具夹具；报告不仅给总分，还列出新出现的回归 Case。

**追问（本文延伸）：** 哪些指标应该成为硬发布门槛？

越权、未经审批的副作用、非法状态、关键字段缺失等风险项应阻断；成功率、成本和延迟门槛由业务场景事先确定，不能在看到结果后修改。

来源：[作业帮 9.23 一面公开面经原帖](https://www.nowcoder.com/feed/main/detail/3742d4aa5a50419d94aa02d549d6aab6)（页面自述面试时间 2026-09-23；题面经搜索索引及[可读聚合页](https://mj.mianlingai.com/interview/zuoyebang-agent-dev-first-round-2916240/)核对）。

### 3. 哪些指标可以确定性计算，主观回答质量怎么评？

**方向：** 评测指标与裁判模型；**难度：** 中高。

**参考答案：** Schema、工具选择、参数、状态迁移、禁用动作、金额和引用存在性用代码判；解释清晰度、语义等价等软质量用明确 Rubric 的裁判模型和人工抽样。先用人工金标测裁判的误判、漏判和不同风险切片的一致性，安全硬失败不得被平均软分覆盖。

**追问（本文延伸）：** 裁判模型偏好较长答案怎么办？

把简洁性和事实依据写入 Rubric，使用盲评与交换候选答案顺序，抽样人工复核；若裁判与人工差异大，先修评测器再比较 Prompt。

来源：[作业帮 9.23 一面公开面经原帖](https://www.nowcoder.com/feed/main/detail/3742d4aa5a50419d94aa02d549d6aab6)（页面自述面试时间 2026-09-23；题面经搜索索引及[可读聚合页](https://mj.mianlingai.com/interview/zuoyebang-agent-dev-first-round-2916240/)核对）。

### 4. 每个 Case 多次运行有随机性，如何判断新 Prompt 真的变好？

**方向：** 回归实验设计；**难度：** 高。

**参考答案：** 固定可控变量，让旧版和候选版在同一数据快照、工具夹具及参数下成对运行；对关键 Case 重复执行，报告通过次数、场景切片和波动范围。先排查稳定的 `PASS -> FAIL`，再评估总体差异；样本量不足时承认结论不确定，不用一次成功宣布提升。

**追问（本文延伸）：** 温度设为 0 就能完全复现吗？

不能。模型服务、版本和执行环境仍可能变化；应记录完整版本组合与原始 Trace，评估业务条件是否稳定满足，而非逐字一致。

来源：[CVTE 10.24 一面公开面经](https://www.nowcoder.com/feed/main/detail/f2233c6940df4b42b818db288d59c232)（页面自述面试时间 2026-10-24；[可读聚合页](https://mj.mianlingai.com/interview/cvte-app-dev-first-round-2932267/)与题面交叉核对）。

### 5. 模型升级后部分 Case 与预期不同，如何定位？

**方向：** 模型与 Prompt 版本回归；**难度：** 中高。

**参考答案：** 先确认数据集、Prompt、Schema、模型、知识和工具夹具的版本，再对旧新版本做逐 Case 配对回放。按场景与错误类型切片：是结构不合法、工具选择变化、证据不一致，还是预期答案已经过时。对高风险差异人工复核，再决定修 Prompt、改业务规则或暂缓升级。

**追问（本文延伸）：** 灰度期间什么情况立即回滚？

出现越权或未经审批的写入、严重 `PASS -> FAIL`、持续的 Schema 失败或触发事先约定的成功率、成本与延迟门槛时，按完整版本组合回滚。

来源：[CVTE 10.24 一面公开面经](https://www.nowcoder.com/feed/main/detail/f2233c6940df4b42b818db288d59c232)（页面自述面试时间 2026-10-24；[可读聚合页](https://mj.mianlingai.com/interview/cvte-app-dev-first-round-2932267/)与题面交叉核对）。

## 今日资料

- [LangSmith Evaluation types](https://docs.langchain.com/langsmith/evaluation-types)：离线回归、线上监测、代码评测、模型评审与成对比较。
- [腾讯云 TI-ONE 评测配置管理](https://cloud.tencent.com/document/product/851/132066)：评测集、模板和基线的版本化资产。
- [Google Cloud 评测数据集格式](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/evaluation-dataset)：输入、参考答案、对话历史和 Agent 中间事件。
- [阿里云百炼模型评测](https://help.aliyun.com/zh/model-studio/model-evaluation-overview)：评测数据集与已有推理结果集的不同调用成本。
- [Day 4：Token 与上下文预算](/articles/AI-Token-Context-Budget-Prompt-Version.html)：本文评测所使用的 Prompt、上下文与成本版本。

下一篇继续实现 Token 计量与压缩实验：给 `ContextBuilder` 注入不同长度的对话和工具结果，验证预算触发、事实保留和实际调用成本。
