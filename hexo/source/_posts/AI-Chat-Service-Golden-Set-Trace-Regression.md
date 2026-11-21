---
layout: post
title: "让对话服务可回归：Golden Set、Trace 与发布门槛"
date: 2026-11-19 09:00:00.000
updated: 2026-11-21 20:50:00.000
permalink: /articles/AI-Chat-Service-Golden-Set-Trace-Regression.html
comments: true
description: "AI 全栈开发第 24 天，为多模型对话服务建立分层 Golden Set、可回放 Trace、逐样本判分和灰度发布门槛。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "评测"
  - "Golden Set"
  - "可观测"
  - "面试"
---

补刊说明：本文补齐原定学习日；资料与题目于 2026-11-21 检索核验。

接入两家模型之后，最危险的改动未必会让接口报错。它可能让总成功率上升，却把某类租户的授权引用弄错；也可能只让输出变慢、成本翻倍。今天给最小对话服务建立**固定输入、分层判分、可回放证据**，让路由、Prompt、模型或检索的改动有明确发布门槛。
<!--more-->

## 一、先把“任务成功”写成可判定对象

评测样本不只存问题与标准答案。一个企业知识问答样本至少要写清：

~~~json
{
  "case_id": "policy-tenant-a-001",
  "task_type": "policy_qa",
  "tenant_id": "tenant-a",
  "principal_role": "employee",
  "input": "本月住宿上限是多少？",
  "knowledge_snapshot": "policy-snapshot-7",
  "allowed_evidence_ids": ["travel-17-p4"],
  "forbidden_evidence_ids": ["tenant-b-travel-p2"],
  "expected": {
    "answer_fact": "每日 500 元",
    "citation_required": true,
    "max_provider_attempts": 1
  },
  "risk_bucket": "high",
  "rubric_version": "policy-qa-v3"
}
~~~

<code>expected</code> 不必要求生成文本逐字相同。金额事实、授权引用、是否拒答、是否使用工具等可以用确定性规则判；表达自然度和有争议的答案由盲审或模型裁判辅助，并定期与人工结果对齐。OpenAI 的评测最佳实践强调任务相关、贴近真实分布、持续回归和人工校准；这里采用的是方法，不依赖其具体 Evals 平台。[OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)（检索日期：2026-11-21）

把样本按至少五个桶分开：正常问答、知识缺失、跨租户/越权、供应商故障、长上下文。每个桶保留固定基线和新增 Bad Case。修好一个错误时，不能只把该错误 Case 重新跑通，还要跑相邻场景与全量基线。

## 二、判分拆成四层

| 层次 | 指标与判法 | 失败应先查哪里 |
| --- | --- | --- |
| 入口与权限 | 租户身份、ACL 过滤、预算拒绝是否符合预期 | API / 授权 / 缓存 |
| 检索与证据 | Gold 证据是否进 TopK；最终引用是否授权 | 文档版本 / 切分 / 召回 |
| 模型与协议 | 结构是否合法、是否拒绝、工具调用是否正确 | 模型快照 / Prompt / 适配器 |
| 任务与体验 | 事实正确、完成率、p95 首字延迟、每成功任务成本 | 路由 / 排队 / 下游 |

不要用一个平均分覆盖硬性错误。越权引用即使只出现一次，也应阻断发布；某些表达差异可以人工复核后接受。对非确定性输出，每个样本重复运行若干次并报告样本数、通过数和方差，不把单次成功写成稳定能力。

## 三、Trace 要能把失败定位到一次 attempt

建议每条对话保存以下关联键：

~~~text
conversation_id → task_id → step_id → attempt_id → provider_request_id
~~~

这里的 <code>task_id</code> 就是第 16–22 天 API 中的一轮对话任务；<code>attempt_id</code> 对应一次供应商调用。Trace 记录输入摘要或受控留存引用、租户与权限判定、知识快照、Prompt 版本、路由版本、实际模型 ID、检索证据 ID、结构化校验结果、原始用量引用、错误分类和状态迁移。涉及敏感文本时，日志默认只留摘要与受控访问地址，不能把完整企业文档放进普通追踪系统。

OpenTelemetry 的 GenAI 语义属性为供应商、模型、操作与 Token 用量提供公共命名参考；实际字段和稳定性要按使用的规范版本核对。业务自定义的 <code>tenant_id</code>、<code>task_id</code>、<code>route_version</code> 仍要有统一约定。[OpenTelemetry GenAI 属性](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)（检索日期：2026-11-21）

一次失败应能回答：正确文档没召回，还是召回后没有进入 Prompt？模型输出正确但适配器丢了引用，还是最终校验拒绝？如果只存最终文本，这些问题无法从证据上区分。

## 四、回归报告是发布工件

同一套 Case 同时跑旧版本与候选版本，冻结知识快照、路由、价格和评测规则。报告格式建议如下：

~~~json
{
  "candidate_release": "gateway-v8",
  "baseline_release": "gateway-v7",
  "dataset_hash": "sha256:...",
  "rubric_version": "policy-qa-v3",
  "cases_total": 120,
  "cases_run": 120,
  "hard_gate_failures": 0,
  "task_success_delta": 0.018,
  "p95_first_token_delta_ms": 85,
  "cost_per_success_delta_minor": -12,
  "failed_case_ids": [],
  "trace_bundle_ref": "restricted-artifact-ref"
}
~~~

上面的数字只是报告示例，不是本项目实测结果。发布规则可设为：安全/权限硬门槛零失败；核心桶不得退化；其余质量、p95 与成本阈值按业务目标事先约定；未跑的 Case 计入分母并使报告不可发布。灰度时再用真实流量的成功率、负反馈与成本检查离线评测是否代表实际分布。

### 今天动手的验收

先用 <code>FakeModelClient</code> 做 12 个固定 Case：正常 4、拒答 2、跨租户 2、结构错误 2、429 与流中断各 1。人为把候选版本的引用过滤关掉，确认报告必定失败且能从 <code>trace_id</code> 找到对应输入、证据与路由版本。再恢复过滤，跑全量回归并保存候选与基线逐 Case 对照。

## 五、今日面试题

以下问题取自牛客公开帖子，检索日期均为 **2026-11-21**。公司与面试场次来自用户自述，未获企业核验；参考答案由本文归纳。

### 1. 评测过程中记录哪些 Trace 数据，哪些指标能确定性判分？

- **方向 / 难度**：Agent 评测与可观测，中级。
- **参考答案**：Trace 至少关联任务、步骤、供应商 attempt、模型/Prompt/路由版本、工具输入输出摘要、检索证据、错误、耗时与用量；确定性指标包括 Schema 合法率、授权引用率、工具参数校验、任务终态、调用次数与预算。主观答案质量另设 rubric 与人工校准。
- **追问**：完整 Prompt 和工具结果能否直接写进普通 Trace？不能，敏感内容应脱敏、限权并设置保留期。
- **来源**：[牛客“阿里千问二面”用户自述](https://api-cdn.nowcoder.com/feed/main/detail/5ff7b7fde8bc49eb960d5badde3ac623?sourceSSR=post)，正文第 8–9 题可直接核对；企业归属未经官方确认。

### 2. 长链路 Agent 的中间步骤和最终结果该如何分别评测？

- **方向 / 难度**：长程任务评测，较难。
- **参考答案**：给计划、工具选择、参数、执行结果和最终任务状态分别设规则与证据；用同一 trace 关联各步，避免“最后答对”掩盖越权工具调用。
- **追问**：中间步骤错了但最终结果碰巧正确，如何计分？任务结果与过程安全分开；违反硬约束仍失败。
- **来源**：[牛客“字节 Agent 算法面经”用户自述](https://www.nowcoder.com/feed/main/detail/1eb010f574cb46f9a847247561f2d18e?sourceSSR=dynamic&weFlow=true)；企业归属未经官方确认。

### 3. Bad Case 如何回流成回归集？

- **方向 / 难度**：质量闭环，中级。
- **参考答案**：从脱敏 trace 提取输入、期望终态与根因；人工确认标注，去重并写入固定样本版本；修复前后均跑全量与相邻桶，保存报告和失败案例。
- **追问**：线上用户点踩能直接成为“模型答错”的标签吗？不能，先区分事实错误、体验问题、权限和产品交互。
- **来源**：[牛客《面了一轮 Agent 岗，我把问过的问题整理成了文章》](https://ac.nowcoder.com/discuss/1680599?type=0)，正文评测部分直接列出这一问题；作者自述曾面试候选人，雇主与实际面试场次无法独立核验。

## 资料

- [OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
- [OpenTelemetry GenAI semantic attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)

下一篇把这套任务与事件契约交给浏览器：展示流式文本、引用、错误和取消状态。
