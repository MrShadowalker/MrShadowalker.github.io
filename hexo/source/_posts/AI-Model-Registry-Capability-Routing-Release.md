---
layout: post
title: "模型注册表怎么治理：能力契约、健康检查与路由配置发布"
date: 2026-11-08 09:00:00.000
updated: 2026-11-08 09:00:00.000
permalink: /articles/AI-Model-Registry-Capability-Routing-Release.html
comments: true
description: "AI 全栈开发第 13 天，设计企业模型注册表、能力证据、生命周期与健康状态，并用不可变配置、灰度评测和一键回滚发布路由策略。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "模型网关"
  - "模型注册表"
  - "模型路由"
  - "灰度发布"
  - "面试"
---

第 12 天的网关已经能按预算、速率和并发决定“现在能否发出请求”，也能区分可重试错误与不可恢复错误。但它仍需要一个可信的候选名单：模型是否支持严格结构化输出？当前项目是否真有调用权限？某个别名改指向新快照后，昨天的任务还能复现吗？

今天把这些问题收进**模型注册表与路由配置发布流程**。注册表回答“有哪些候选、证据是什么”；路由配置回答“哪些租户、哪些任务、按什么规则使用候选”。本文的数据结构、探针和发布流程是工程设计；供应商 API 的字段及版本语义以文末官方资料为准。
<!--more-->

## 一、供应商模型列表不是完整的注册表

OpenAI 的 <code>GET /v1/models</code> 返回模型 ID、创建时间、所有者和可选退役日期等基础元数据。它不能单独证明某模型在指定端点、参数、区域与项目中支持某种工具或输出契约；具体能力还要看模型页与实际验证。[OpenAI List models](https://developers.openai.com/api/reference/resources/models/methods/list)、[OpenAI 模型页示例](https://developers.openai.com/api/docs/models/gpt-6-sol)（检索日期：2026-11-08）

Anthropic Models API 提供能力、Token 上限和生命周期等更丰富的数据，但能力标志仍有范围：其文档说明 server tools 标志只覆盖部分工具，组织设置也可能禁用工具。因此“供应商声明支持”与“本项目凭据可用”仍是两个事实。[Anthropic List Models](https://platform.claude.com/docs/en/api/models/list)、[Anthropic Models overview](https://platform.claude.com/docs/en/models/overview)（检索日期：2026-11-08）

企业网关至少要区分四类证据：

| 证据层 | 能回答什么 | 不能保证什么 |
| --- | --- | --- |
| 供应商目录与模型页 | 标称能力、上下文上限、生命周期 | 当前账号、端点与地区都可用 |
| 凭据级能力探针 | 指定项目能否完成最小调用、工具或 Schema 请求 | 真实业务质量达标 |
| 离线业务评测 | 任务样本的质量、边界案例、成本 | 线上容量与时延一直稳定 |
| 线上真实流量 | 成功率、延迟、限流、成本与质量回归 | 未见过的新输入也安全 |

供应商目录是**发现入口**，不是路由的唯一事实来源。任何强制能力若仍为 <code>UNKNOWN</code>，不能被当成 <code>SUPPORTED</code> 放进生产候选。

## 二、一个模型条目需要哪些字段

注册表的稳定键不能只有“模型名”。同名模型在供应商直连、云伙伴平台、区域、账号和端点上可能有不同的访问权限、退役时间、费用或功能。Anthropic 官方也指出，伙伴运营平台的退役计划可能与直连平台不同。[Anthropic Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)（检索日期：2026-11-08）

~~~yaml
registry_id: "model-entry-42"
provider: "example-provider"
serving_platform: "direct"
account_scope: "project-a"
region: "approved-region"
endpoint: "responses"
requested_model_id: "vendor-model-id-or-alias"
observed_model_id: null
alias_kind: "UNKNOWN"       # MOVING_ALIAS / FIXED_SNAPSHOT / UNKNOWN
provider_lifecycle: "ACTIVE" # ACTIVE / DEPRECATED / RETIRED / UNKNOWN
internal_release: "CANDIDATE" # CANDIDATE / CANARY / ACTIVE / DISABLED
health: "UNKNOWN"           # HEALTHY / DEGRADED / UNAVAILABLE / UNKNOWN
shutdown_at: null
capabilities:
  strict_schema:
    state: "UNKNOWN"        # VERIFIED / UNSUPPORTED / UNKNOWN
    evidence_ref: null
  tool_calling:
    state: "VERIFIED"
    endpoint: "responses"
    parameter_profile: "tool-policy-v2"
    evidence_ref: "probe-run-101"
max_input_tokens: null
max_output_tokens: null
price_version: "price-snapshot-id"
rate_pool_id: "provider-project-model-family"
secret_ref: "server-side-secret-reference"
evidence_checked_at: "2026-11-08T09:00:00+08:00"
~~~

这里的 <code>secret_ref</code> 只是服务端密钥引用，注册表和发布文件不保存明文凭据。<code>observed_model_id</code> 为空时，不能声称知道供应商别名背后的精确快照；至少保存请求的模型 ID、响应中的模型字段、供应商请求 ID 与路由配置版本，明确复现能力的边界。

能力最好带**端点与参数约束**，而不是一个全局布尔值。例如某模型支持工具调用，但在特定端点或推理参数下限制不同；“支持 JSON”也不等于“满足严格 JSON Schema”。OpenAI 模型页按端点、工具和功能分别列能力，不能把其中一个绿色标记推广到所有调用方式。[OpenAI 模型页示例](https://developers.openai.com/api/docs/models/gpt-6-sol)（检索日期：2026-11-08）

### 别名、快照与退役

不要根据“模型 ID 中没有日期”自行推断它一定是移动别名。Anthropic 的版本说明明确指出，4.6 及以后部分无日期模型 ID 是固定快照，较早系列的短别名才指向对应日期快照；不同供应商、不同系列应按官方规则登记。[Anthropic Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)（检索日期：2026-11-08）

OpenAI 文档说明模型快照之间的提示行为可能变化，推荐固定模型版本并持续做业务评测。即便使用固定版本，也要监控供应商退役公告和 <code>shutdown_date</code>，提前迁移，而不是等线上返回“模型不存在”。[OpenAI API Overview](https://developers.openai.com/api/reference/overview)、[OpenAI Deprecations](https://developers.openai.com/api/docs/deprecations)（检索日期：2026-11-08）

生命周期建议分开记录：供应商的 <code>ACTIVE / DEPRECATED / RETIRED</code>、本平台的 <code>CANDIDATE / CANARY / ACTIVE / DISABLED</code>、实时的 <code>HEALTHY / DEGRADED / UNAVAILABLE</code>。一个已弃用但尚未退役的模型可能仍可调用，却不应继续接收新项目；一个生命周期为 ACTIVE 的模型也可能因当前账号没有权限而不可用。Anthropic 的 <code>retires_at</code> 日期可能调整，应以生命周期字段与最新公告共同判断，不能仅因日期过去就擅自认定已退役。[Anthropic List Models](https://platform.claude.com/docs/en/api/models/list)（检索日期：2026-11-08）

## 三、健康检查要分访问、功能和业务质量

公共状态页只能说明平台整体情况，不能替代本项目验证。OpenAI 状态页说明其可用率按模型、订阅层级与错误类型聚合，个别客户体验可能不同。[OpenAI Status](https://status.openai.com/)（检索日期：2026-11-08）

给每个 <code>provider + platform + account + region + endpoint</code> 设置低频、低费用的探针：

1. **访问探针**：用实际项目凭据确认模型与端点可用，区分 401/403、模型不存在和临时 429；探针不携带生产用户数据。
2. **能力探针**：在安全测试租户中验证最小工具调用、严格 Schema、流式和多模态契约。只验证当前路由需要的能力，记录测试版本与结果。
3. **业务探针**：用固定 Golden Set 看正确率、结构合法率、引用完整性和成本。它是发布门槛，不必每秒运行。
4. **流量观测**：按模型池看成功率、p95 延迟、错误码、限流、每成功任务成本；把租户预算拒绝与供应商故障分开统计。

探针的 <code>VERIFIED</code> 必须有有效期。模型权限、项目设置、区域和参数变更后，应重新验证对应条目。健康状态不宜用单次失败翻转：设置最少样本量、连续失败阈值和恢复滞后；熔断后用少量半开探测恢复。短时 429 是容量信号，不能直接把模型判成永久故障；内容安全拒绝也不能算基础设施故障。

## 四、路由配置如何发布和回滚

注册表描述候选，路由配置描述业务选择。**每次发布生成不可变快照**，运行中的任务固定一个配置版本；只有新任务使用新指针。这样热更新不会让一个多步骤 Agent 在中途换成另一套未评测的模型策略。

~~~yaml
release_id: "route-20261108-001"
task_type: "enterprise-knowledge-answer"
tenant_scope: "approved-tenants"
required_capabilities:
  strict_schema: true
  tool_calling: true
data_policy: "policy-v4"
candidates:
  - registry_id: "model-entry-42"
    weight: 90
  - registry_id: "model-entry-57"
    weight: 10
budget_policy: "budget-v3"
quality_gate: "golden-set-20261108"
config_hash: "sha256-of-canonical-config"
approved_by: "review-record-id"
~~~

发布步骤可以落成一条可审计流水线：

~~~text
草案 → Schema/引用/权限校验 → 候选能力与凭据探针
     → 业务 Golden Set 与成本回归 → 影子路由对照
     → 小流量灰度 → 指标观察 → 扩大权重 → 正式发布
                         ↘ 超阈值：原子回滚活动配置指针
~~~

影子路由只计算新策略会选什么，**不实际执行带副作用的工具**；如果要额外调用候选模型，必须单独计入探针费用与数据政策。灰度可按 <code>hash(tenant_id, user_id, experiment_id)</code> 稳定分桶，避免同一用户每次跳组；一个任务启动后记录 <code>release_id</code> 和 <code>config_hash</code>，即使权重变了也继续按原版本执行。只有第 12 天定义的显式降级条件，才允许中途切到已验证的兼容候选，并把切换原因写进 trace。

回滚应是**把活动指针指向上一份已验证快照**，不是在生产配置上手改权重。保留旧版本直到所有引用它的任务结束；审计记录保存发布人、审批、验证报告、开始时间、回滚原因。不能把密钥放在配置快照里。

OpenAI 和 Anthropic 都建议用真实任务样本比较不同模型的质量、边界案例和成本；配置版本、灰度权重与回滚指针是本文基于此提出的工程实现，并非供应商原生路由功能。[OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)、[Anthropic Choosing a model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)（检索日期：2026-11-08）

### 一个运行时决策记录

~~~json
{
  "task_id": "task-884",
  "tenant_id": "tenant-42",
  "release_id": "route-20261108-001",
  "registry_version": "registry-20261108-3",
  "requested_model_id": "vendor-model-id-or-alias",
  "observed_model_id": null,
  "selected_registry_id": "model-entry-42",
  "rejected_candidates": [
    {"registry_id": "model-entry-57", "reason": "STRICT_SCHEMA_UNKNOWN"}
  ],
  "capability_evidence_ref": "probe-run-101",
  "attempt_id": "attempt-9"
}
~~~

有这条记录，才能回答“为什么当时选它”“切换后谁受影响”“昨天的问题还能否复现”。如果供应商没有暴露别名实际指向的快照，记录应明确为未知，不要伪造一个版本号。

## 五、Java 后端今天要交付什么

~~~java
record ModelKey(String provider, String platform, String accountScope,
                String region, String endpoint, String requestedModelId) {}
record CapabilityResult(String name, String state, String evidenceRef) {}
record RouteDecision(String releaseId, String registryVersion, ModelKey selected,
                     Map<ModelKey, String> rejectedReasons) {}

interface ModelRegistry {
    ModelEntry get(ModelKey key, String registryVersion);
    List<ModelEntry> eligible(TaskContract task, String registryVersion);
}
interface RoutePublisher {
    ValidationReport validate(RouteRelease draft);
    void activate(String releaseId, String expectedCurrentReleaseId);
    void rollback(String targetReleaseId, String expectedCurrentReleaseId);
}
~~~

<code>activate</code> 与 <code>rollback</code> 的 <code>expectedCurrentReleaseId</code> 用于比较并交换，避免两个管理员同时发布时后一人覆盖前一人的结果。用 <code>FakeProvider</code> 和本地注册表完成八个验收案例：

1. 模型列表有 ID，但严格 Schema 能力仍为 <code>UNKNOWN</code>：强制结构化任务不能选它。
2. 模型页宣称支持工具，当前项目的探针返回权限不足：只标记这个账号范围不可用。
3. 同一模型名出现在直连和伙伴平台，退役计划不同：两个注册条目独立演进。
4. 别名指向发生变化：新任务走新版本；旧任务日志保留当时的请求 ID、已观察模型 ID 和复现限制。
5. 同一任务执行三步时发布新路由：三步仍固定原 <code>release_id</code>。
6. 灰度样本结构合法率低于门槛：自动停止扩量并回滚活动指针。
7. 两个租户各自发布配置：一方回滚不影响另一方。
8. 模型探针连续超时后进入 DEGRADED，单次 429 不触发永久下线；恢复需连续成功。

验收输出包括可追溯的模型注册表快照、发布报告、路由决策 trace、回滚事件和 Golden Set 对照表。第 30 天阶段项目可把这些接口接入真正的模型网关。

## 六、今日面试题（检索日期：2026-11-08）

当天检索到的直接可核验大厂原题有限；以下优先使用可打开正文的用户面经，再补充有价值的社区模拟题。公司归属来自发帖者自述，**均不等于企业官方题库**；参考答案是本文的工程归纳。

### 1. 多租户环境中，模型切换如何支持热更新且彼此独立？

- **方向 / 难度**：AI 平台、配置治理 / 难。
- **参考答案**：按租户保存不可变路由发布版本，活动指针原子切换；每个任务启动时固定 <code>release_id</code>，避免运行中混用两版。候选模型仍经过能力、数据政策、额度和预算校验；灰度分桶与回滚只影响目标租户。发布记录保留审批、配置哈希和指标。
- **追问**：两个租户同时发布或回滚，怎样保证互不覆盖？重点是租户范围键和带预期版本的比较并交换。
- **来源**：[牛客用户自述“字节 Agent 开发实习一面”](https://www.nowcoder.com/feed/main/detail/c3711862bc1f47d4914274dde70ff1de)，页面显示 03-30；公司归属未获官方核验。

### 2. 规则意图路由如何证明覆盖了线上真实流量？

- **方向 / 难度**：路由评测、灰度 / 中高。
- **参考答案**：先影子运行新旧路由，只让旧策略产出用户结果；按任务类型、租户和新输入类型抽样分桶，对分歧样本做人工标注。比较误路由率、拒绝率、成功率和成本，而不是只报规则命中率。灰度期间监控流量分布漂移，超过门槛停止扩量。
- **追问**：一种新意图突然增长但训练集里没有，怎样让灰度自动暂停？重点是未知类占比、分歧率和延迟标注的组合阈值。
- **来源**：[牛客用户自述“迅雷服务端开发 AI 一面”](https://api-cdn.nowcoder.com/discuss/918809114392657920?sourceSSR=post)，页面显示 08-17；公司归属未获官方核验。

### 3. Agent 项目用内网私有模型还是公网模型？准确的模型版本是什么？

- **方向 / 难度**：系统设计、模型治理 / 中。
- **参考答案**：说明部署平台、供应商、区域、实际请求模型 ID、端点和数据边界；区分业务路由名、供应商别名和固定快照。展示注册表证据、能力探针、价格与退役计划。若供应商不返回别名解析后的快照，承认历史复现有限，并保留原请求与响应元数据。
- **追问**：供应商把别名指向新快照后，如何发现质量回归并定位受影响任务？
- **来源**：[牛客用户自述“CLPS 华钦科技 Agent 开发实习”](https://www.nowcoder.com/feed/main/detail/9c022e75bbce4683985bee256e1eb8d0)，页面显示 10-26；公司归属未获官方核验。

### 4. 用户提问进行到一半时需要切模型，怎样处理？

- **方向 / 难度**：Agent Runtime、流式恢复 / 难。
- **参考答案**：先固定当前任务的路由配置版本；如果只是发布新策略，运行中任务不切。若当前模型确实故障，只有在候选满足能力与数据契约、预算足够且状态可恢复时才显式切换。已输出部分流式结果时结束旧结果版本，新调用产出独立结果，不能把两段文本无标识拼接；工具副作用需按幂等记录处理。
- **追问**：旧模型已经执行写入工具但 SSE 断开，新模型能否重放这一步？重点是工具回执、幂等键和人工确认。
- **来源**：[牛客“阿里千问技术部一面”社区模拟整理帖](https://www.nowcoder.com/discuss/942757774100815872?sourceSSR=enterprise)，页面显示 09-16；标题明确为模拟整理，不能核验为阿里原题。

## 资料与下一步

- OpenAI 官方资料：[List models](https://developers.openai.com/api/reference/resources/models/methods/list)、[模型页示例](https://developers.openai.com/api/docs/models/gpt-6-sol)、[API Overview](https://developers.openai.com/api/reference/overview)、[Deprecations](https://developers.openai.com/api/docs/deprecations)、[Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)。
- Anthropic 官方资料：[List Models](https://platform.claude.com/docs/en/api/models/list)、[Models overview](https://platform.claude.com/docs/en/models/overview)、[Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)、[Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)、[Choosing a model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)。以上资料检索日期：2026-11-08。

明天是第二周复盘：把第 8–13 天的检索、路由、缓存、成本、限流与注册表串成一次模型网关演练，再用小测找出设计中的薄弱环节。
