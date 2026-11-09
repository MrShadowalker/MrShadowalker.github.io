---
layout: post
title: "AI 全栈开发第二周验收：从检索到模型网关的一次故障演练"
date: 2026-11-09 09:00:00.000
updated: 2026-11-09 09:00:00.000
permalink: /articles/AI-Agent-Fullstack-Week2-Gateway-Review-Quiz.html
comments: true
description: "复盘 AI 全栈开发第 8–13 天，用一个本地多租户知识助手夹具验收检索、缓存、路由、成本、限流和模型注册表，附八道小测与四道有来源的面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "周复盘"
  - "模型网关"
  - "RAG"
  - "多租户"
  - "面试"
---

第二周从 Embedding 和检索开始，一路走到模型路由、缓存、成本账本、限流和模型注册表。今天是第 14 天，按系列约定做周复盘与小测。

这篇文章给出一个**本地可回放的多租户知识助手演练**，把第 8–13 天的边界放在同一条请求链里。下面的夹具和验收标准是练习设计，不能把阅读文章或运行一次正常 Case 当成项目完成；真正的完成证据是自己提交的代码、逐 Case 结果与失败复盘。
<!--more-->

## 一、六篇文章，组成一条请求链

| 篇目 | 本周要守住的边界 | 最小证据 |
| --- | --- | --- |
| [Day 8：Embedding 与检索](/articles/AI-Embedding-Vector-Retrieval-Basics.html) | 切分、版本、混合召回、重排与 ACL 过滤 | 带租户和知识快照的检索结果；Recall@K |
| [Day 9：模型路由](/articles/AI-Model-Routing-Cache-Cost-Ledger.html) | 能力与数据政策先过门槛，再比较质量、延迟和成本 | 候选剔除原因与每成功任务成本 |
| [Day 10：缓存隔离](/articles/AI-Prompt-Semantic-Cache-Isolation.html) | 区分供应商前缀缓存与应用答案缓存；权限撤销要失效 | 缓存键字段、ACL 纪元和命中审计 |
| [Day 11：成本账本](/articles/AI-Task-Tenant-Usage-Cost-Budget.html) | 每次 attempt 单独记账，任务与租户聚合，预算原子预留 | 原始 usage、互斥计费桶与待对账状态 |
| [Day 12：网关控流](/articles/AI-Model-Gateway-Rate-Limit-Quota-Fallback.html) | RPM、TPM、并发与金额分开；按错误语义重试 | 准入决策、重试次数、降级原因 |
| [Day 13：模型注册表](/articles/AI-Model-Registry-Capability-Routing-Release.html) | 能力证据、账号可用性、模型生命周期与配置快照 | 注册表版本、灰度报告与回滚事件 |

它们在请求里应按以下顺序协作：

~~~text
身份 / 租户 / ACL
  → 检索：知识快照 + 候选召回 + 权限过滤 + 重排
  → 缓存：检查租户、ACL 纪元、知识与 Prompt 版本
  → 路由：能力、数据边界、质量门槛、模型注册表
  → 准入：任务预算、租户预算、RPM / TPM、并发
  → ModelClient：一次或多次 attempt，流式与错误分类
  → 验证：结构化输出、引用是否指向授权证据
  → 账本 / Trace：原始 usage、费用、状态与实际模型版本
~~~

注意两条容易错的边界：**相似度不等于权限**，**调用成功不等于任务成功**。OpenAI 的检索文档提供属性过滤和混合检索配置；应用仍须对租户、文档 ACL 与引用做自己的授权检查。[OpenAI Retrieval](https://developers.openai.com/api/docs/guides/retrieval)（检索日期：2026-11-09）

## 二、120 分钟演练：多租户差旅政策助手

只用本地 <code>FakeRetriever</code>、<code>FakeModelClient</code> 和虚拟时钟，不接真实企业文档或付费模型。业务目标是回答“本月差旅住宿上限是多少”，并给出当前租户有权查看的政策引用。

两个租户恰好问同一句话，但政策不同：

~~~json
{
  "case_id": "week2-travel-001",
  "tenant_id": "tenant-a",
  "principal_id": "user-a-7",
  "query": "本月差旅住宿上限是多少？",
  "knowledge_snapshot": "snapshot-9",
  "acl_epoch": 7,
  "allowed_evidence_ids": ["tenant-a-policy-v3-p4"],
  "forbidden_evidence_ids": ["tenant-b-policy-v2-p2"],
  "route_release": "route-v17",
  "task_budget_minor": 1000,
  "expected": {
    "status": "SUCCEEDED",
    "citation_ids": ["tenant-a-policy-v3-p4"],
    "provider_calls_max": 1
  }
}
~~~

另建 <code>tenant-b</code> 的对应 Case，保持 Query 相同，给它自己的政策版本和 ACL。检索夹具同时返回两份语义很近的政策片段，用权限过滤决定最终可见集合。不要把 <code>tenant-a</code> 的证据放进 <code>tenant-b</code> 的模型输入；即使答案缓存已有同一句话，也必须重新校验租户和权限。

### 演练步骤

1. **冻结版本**：保存知识快照、Embedding 模型、检索配置、Prompt、模型注册表、路由发布与价格快照。每条结果写入对应版本 ID。
2. **记录检索层**：保存原始候选、ACL 过滤后的候选、重排结果和引用 ID。分别评测 Recall@K、授权引用率与“已召回却答错”的比例。
3. **验证缓存层**：供应商 Prompt 缓存只减少相同前缀的处理成本，仍生成新输出；应用答案缓存命中则绕过生成。两者分别计量，不能把供应商缓存命中当作答案复用。[OpenAI Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)（检索日期：2026-11-09）
4. **执行模型网关**：选模型时验证严格输出、上下文窗口、数据政策、账号权限和健康状态；准入时独立检查金额、RPM、TPM 与并发。
5. **故障注入与回放**：用固定顺序注入下表 Case。每个 Case 写实际结果和失败原因，不能只报告通过项。

### 故障夹具与预期

| Case | 注入条件 | 必须观察到的结果 |
| --- | --- | --- |
| 正常路径 | 授权片段在 TopK，模型返回正确引用 | SUCCEEDED；引用只指向本租户证据；账本有一个 attempt |
| 检索未召回 | 正确片段不在 TopK | 标为召回失败；不得把生成错误当成根因 |
| 已召回但答错 | 正确片段在 TopK，模型引用错误 | 标为生成或引用校验失败；保留检索结果供定位 |
| 跨租户候选 | 两租户政策语义相近 | 过滤掉无权片段；模型输入与引用都不含它 |
| 权限撤销 | ACL 纪元从 7 变 8，缓存 TTL 未到 | 旧缓存键失效；当前授权重新校验 |
| 知识更新 | 政策 v3 替换 v2，索引切到新快照 | 查询与缓存都使用新快照；旧引用不再当现行政策 |
| 用量子项 | 输入含缓存读写，输出含推理明细 | 互斥计费桶正确；不重复相加 |
| 并发预算竞争 | 两个任务各自预留会超出租户余额 | 原子预留只放行允许的调用；失败者无供应商调用 |
| 临时 429 | 可恢复错误带 Retry-After，但等待超出任务截止时间 | 不提前重试；记录拒绝原因和可选的合格降级 |
| 支出封顶 429 | 错误体指向账期硬上限 | 不把它当临时限流循环重试 |
| 流式半包 | 已向用户输出部分文本后出错，最终 usage 缺失 | 不静默拼接备用模型；费用标 PENDING_USAGE |
| 路由热更新 | 任务执行中活动配置从 v17 切到 v18 | 当前任务继续固定 v17；新任务按 v18 分桶 |

OpenAI 的限流文档区分临时 429、硬支出限额 429 和服务过载；是否重试要结合错误体、<code>Retry-After</code> 与任务截止时间，不能仅看状态码。[OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)（检索日期：2026-11-09）。模型列表和能力也会变化；Anthropic 的模型 API 提供生命周期与能力字段，退役日期可能调整，注册表应保存来源与核验时间。[Anthropic List Models](https://platform.claude.com/docs/en/api/models/list)（检索日期：2026-11-09）

### 交付物和判分

- <code>fixtures.jsonl</code>：上述 12 个 Case 的输入、模拟响应与预期，包含租户、ACL 纪元和版本。
- <code>route-registry.json</code>：两份路由发布快照、能力证据、候选剔除原因与价格版本。
- <code>report.jsonl</code>：逐 Case 的 PASS、FAIL 或 NOT_RUN；保留失败分母与 trace ID。
- <code>ledger.jsonl</code>：每次 attempt 的预留、结算、待对账与任务聚合成本。模拟 usage 只能写作“夹具用量”，不得称为真实供应商账单。
- 一页复盘：最严重的失败、根因、修复、重放命令与修复后的结果。

练习评分可按 100 分分配：权限与隔离 25、检索与引用 15、缓存失效 15、路由与版本 15、预算与账本 15、限流恢复 10、报告可复查性 5。**跨租户泄露、未经授权引用或超预算发出调用属于硬失败**，不能靠其他项的平均分抵消。这个评分是练习规则，真实业务阈值要由风险与服务目标确定。

## 三、第二周小测：先独立回答

下面八题是**本系列自测题**，不是企业面试原题。建议 20 分钟完成；每题按“结论、机制、边界”各 1 分，共 24 分。答完后再看表格。

1. 向量相似度最高的文档属于另一个租户。检索服务能把它交给模型后再让模型“自行忽略”吗？
2. 应用答案缓存键只包含规范化 Query 和模型 ID。两租户问同一句政策问题，还至少缺哪些会改变答案的条件？
3. **仅作计算练习：** OpenAI 式用量里 <code>input_tokens=12000</code>，其中缓存读 4000、缓存写 3000；<code>output_tokens=500</code>，其中推理 200。普通输入、总输入、总输出分别是多少？
4. **仅作计算练习：** Anthropic 式用量里普通输入 1000、缓存写 400、缓存读 2000。逻辑总输入是多少？按其多数 Claude 模型的规则，多少输入 Token 计入 ITPM？
5. 模型返回临时 429，<code>Retry-After=5s</code>，任务总截止时间只剩 3 秒。应该等 3 秒后提前重试吗？
6. 路由 A 共花 90 元，成功 9 个任务；路由 B 共花 80 元，成功 4 个任务。哪条路线的每成功任务成本更低？能只凭这个数字决定上线吗？
7. 任务固定了 <code>route-v17</code>，但它请求的是供应商移动别名，供应商没有返回实际快照 ID。昨天的结果能被精确复现吗？
8. 主模型的流式答案已经向前端输出一半，然后报错。可以把备用模型的文本直接接在后面吗？

### 参考答案与评分要点

| 题号 | 结论和机制 | 必须说出的边界 |
| --- | --- | --- |
| 1 | 不可以。检索阶段按可信身份和 ACL 过滤，送入模型前再次核验；引用也要回查授权 | 相似度是相关性，不是权限；模型提示词不能充当授权 |
| 2 | 至少加入租户、权限/ACL 纪元、知识快照、Prompt 与检索策略版本、适用时间和输出契约 | 命中后仍检查当前授权；权限撤销不能只等 TTL |
| 3 | 普通输入 5000，总输入 12000，总输出 500 | 缓存读写是输入子项，推理是输出子项；供应商口径不能通用套算 |
| 4 | 逻辑总输入 3400；多数 Claude 模型 ITPM 计入 1400 | 缓存读取不计 ITPM 的规则要按具体供应商与模型确认，不等于免费；参见 [Anthropic Rate limits](https://platform.claude.com/docs/en/api/rate-limits) |
| 5 | 不应该。Retry-After 是最短等待，超过 deadline 就停止或转异步；合格备用模型也要重新准入 | 硬支出封顶的 429 不可按临时限流重试 |
| 6 | A 为 10 元/成功，B 为 20 元/成功，A 更低 | 质量、安全、延迟与失败样本仍需过门槛；不能只看成本 |
| 7 | 不能保证精确复现。保存请求 ID、响应模型字段与配置版本，并标明实际快照未知 | 路由快照固定不等于供应商别名固定；不同供应商的 ID 语义不同 |
| 8 | 不可以无标识拼接。终止旧结果版本；若需重试，产生新的可识别结果并重新校验引用与成本 | 已执行工具副作用不能自动重放，缺失用量仍待对账 |

如果有题只能背“要做权限过滤”“要做灰度”，试着为它写一条会失败的夹具。OpenAI 的评测最佳实践强调任务相关样本、真实分布与持续评测；这里用本地执行器实现这些方法，不依赖供应商托管的评测平台。[OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)（检索日期：2026-11-09）

## 四、本周面试题整理（检索日期：2026-11-09）

以下四道题面来自可直接打开正文的牛客用户自述面经；公司与面试经历**未获企业官方核验**。题面按公开内容概括，参考答案与追问由本文结合第二周实践整理，不代表企业标准答案。

### 1. 修好一类 bad case 后，如何发现其他场景退化？只评最终答案够吗？

- **方向 / 难度**：Agent 评测、灰度发布 / 难。
- **参考答案**：冻结模型、Prompt、路由、工具和知识版本，建立按任务、租户、风险等级分层的 Golden Set。除最终答案外，分别检查检索证据、意图/路由、工具轨迹、结构合法性、成本和延迟；对新旧版本做逐 Case 对照，关键切片出现 PASS → FAIL 就阻断发布。灰度期间继续采样真实失败案例回填评测集。
- **追问**：总体成功率上升，但关键租户的越权引用增加，是否扩量？重点是硬安全门槛与分层指标不能被均值掩盖。
- **来源**：[牛客用户自述“字节后端 AI 大模型开发平台一面”](https://api-cdn.nowcoder.com/feed/main/detail/fa50ef5521f84cb788f911cd31e5a98a?sourceSSR=post)；页面显示 10-04 编辑，企业归属未获官方核验。

### 2. 知识库持续更新时，旧向量怎样失效？

- **方向 / 难度**：RAG、索引版本 / 中高。
- **参考答案**：为文档、切片与索引保存版本；新索引构建和验收完成后原子切换读别名，旧切片标记失效并在查询时按有效快照过滤。检索缓存和答案缓存包含知识快照与 ACL 纪元；权限撤销时提升纪元，不等待 TTL 自然过期。保留旧快照一段时间供在途任务与事故回放。
- **追问**：ACL 撤销时旧缓存尚在，怎样保证下一次请求不读出旧答案？
- **来源**：[牛客用户自述“美团 Agent 开发面经”](https://www.nowcoder.com/feed/main/detail/d944d7a4276c435abbc42400c2bbe69c?sourceSSR=post)；检索时页面显示“昨天”，面试日期为作者自述，企业归属未获官方核验。

### 3. 私有 RAG 为什么还要做文档访问控制，怎么落实？

- **方向 / 难度**：企业 RAG、租户权限 / 难。
- **参考答案**：由后端认证身份映射租户与权限，在检索候选进入模型前过滤，引用落地时再次复核。向量相似度不能证明可见性；缓存键包含租户、ACL 指纹或纪元、知识版本，命中后仍验证当前权限。保留文档 ID、授权版本和访问审计，避免共享索引中的跨租户泄露。
- **追问**：两租户的 Query 完全相同，可以共享候选列表或答案缓存吗？重点是候选权限、知识快照和最终引用都要隔离。
- **来源**：[牛客用户自述“阿里千问 AI 应用研发面经”](https://www.nowcoder.com/discuss/942167972557119488?sourceSSR=enterprise)；页面显示 10-20，企业归属未获官方核验。

### 4. 检索内容相关性很差，从哪里开始排查？

- **方向 / 难度**：RAG 评测、故障定位 / 中高。
- **参考答案**：先区分正确文档没有进入 TopK，还是已进入却被重排、上下文截断或生成阶段用错。逐层检查查询改写、ACL/时间过滤、文档解析与切分、Embedding 模型/索引版本、BM25 与向量融合、重排及证据引用。用带标注的样本计算 Recall@K、排序指标和答案忠实度，按租户与文档类型切片。
- **追问**：正确文档已排在 TopK 第一位，但答案仍引用旧政策，优先查哪两层？重点是上下文构建、缓存与引用校验。
- **来源**：[牛客用户自述“字节 AI Agent 开发一面”](https://www.nowcoder.com/feed/main/detail/9cd459d87a754e07a490ba7f1c03b495?sourceSSR=post)；页面显示 10-17，企业归属未获官方核验。

## 资料与第三周起点

- [OpenAI Retrieval](https://developers.openai.com/api/docs/guides/retrieval)：属性过滤、混合检索与排序配置。
- [OpenAI Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)：前缀复用与供应商缓存用量；应用答案缓存仍需自行授权。
- [OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)：RPM/TPM、临时限流、支出封顶与重试边界。
- [OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)：任务相关样本与持续评测。
- [Anthropic List Models](https://platform.claude.com/docs/en/api/models/list)、[Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)与 [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)：模型生命周期、ID 语义和缓存 Token 的速率口径。以上官方资料检索日期：2026-11-09。

第 15 天开始进入服务实现：先把这周的注册表、路由、预算、检索和 trace 契约整理成一个可运行的后端 API，再逐步接异步任务与前端交互。
