---
layout: post
title: "模型网关阶段项目怎么准备验收：证据包、发布判定与十分钟演示"
date: 2026-11-24 09:00:00.000
updated: 2026-11-24 09:00:00.000
permalink: /articles/AI-Model-Gateway-Stage1-Acceptance-Evidence-Release-Decision.html
comments: true
description: "AI 全栈开发第 29 天：把模型网关的故障演练、Golden Set、Trace、用量、压测和安全检查整理成可审计的验收证据包，明确发布 NO_GO 门槛与项目演示脚本。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "模型网关"
  - "阶段项目"
  - "评测"
  - "可观测"
  - "发布治理"
  - "面试"
---

第 26 天列了故障 Case，第 27 天讲部署与容量，第 28 天做了跨模块发布演练。第 29 天要解决另一件事：**把“我设计了这些检查”变成“别人可以按同一版本、同一输入复核我的结论”。** 阶段项目面试中，漂亮的架构图只能说明意图；逐 Case 结果、失败样本和版本索引才能说明实际做到哪一步。

本文提供第 30 天阶段项目的验收模板与演示脚本，**不声称网关已实现或测试已通过**。当前博客仓库中的文章是学习材料；项目代码和运行报告若在其他仓库，应按下文的索引加入证据包。
<!--more-->

## 一、先区分设计、运行与线上观察

同一句“支持断线恢复”，可能代表三种完全不同的证据：

| 声明层级 | 可以说什么 | 必须附什么 | 不能推断什么 |
| --- | --- | --- | --- |
| 设计 | 已定义 `task_id + event_id` 的补播契约 | API/事件协议、状态机、故障夹具 | 不代表实现能跑 |
| 本地运行 | 固定版本下，断线 Case 实际通过 | 命令、commit、环境、逐 Case 结果、脱敏 Trace | 不代表生产流量下稳定 |
| 线上观察 | 指定灰度窗口内，指标与告警符合门槛 | 部署版本、时间窗、分母、监控查询与回滚记录 | 不代表所有租户和未来版本都安全 |

第 30 天的阶段项目允许以**本地可复现演示**作为交付范围，但项目报告要明确写范围。尚未运行的 Case 写 `NOT_RUN`；失败写 `FAIL` 和根因，不能因为 PPT 上有方案就填 `PASS`。

## 二、证据包：让一次结论能追到代码、输入和执行

建议按一次候选发布建目录。下面是**待读者生成的模板**，文件名可按项目技术栈调整：

~~~text
stage1-acceptance/
├── release.yaml             # 版本和验收门槛，运行前冻结
├── fixtures/                # 两租户输入、供应商故障帧、Golden Set
├── case-results.jsonl       # A1–A14 等逐 Case 结果
├── eval-summary.json        # 分桶样本数、基线和差异
├── load-summary.json        # 实际到达率、延迟、拒绝和丢迭代
├── usage-reconcile.csv      # task/attempt/供应商回执与待对账项
├── security-report.md       # 越权、密钥、日志和浏览器检查
├── trace-samples.jsonl      # 脱敏的正常与失败链路
├── rollback.md              # 触发条件、执行步骤与演练时间线
└── artifact-sha256.txt      # 其余产物的摘要
~~~

`release.yaml` 至少固定“我测的是哪一版”：

~~~yaml
release_id: gateway-stage1-candidate
source_commit: null           # 待填完整 commit SHA
image_digest: null            # 若使用镜像，填不可变 digest
environment: local            # local / staging / production
run_started_at: null          # 实际执行时间，不预填通过时间
versions:
  api: chat-api-v2
  event: task-events-v2
  route: route-v8
  registry: registry-v6
  prompt: travel-policy-v4
  knowledge: travel-20261124
  price: provider-price-20261124
golden_set_sha256: null
rubric_sha256: null
required_cases: [A2, A3, A4, A7, A8, A10, A11, A13, A14]
thresholds:
  target_arrival_rate: null   # 运行前定负载目标
  max_dropped_iterations: null
  max_p95_task_completion_ms: null
~~~

示例中的版本名是练习标识，`null` 明确表示尚未冻结或执行。真实运行前，要为每项填写值、记录工作区是否有未提交改动，并计算夹具和评分规则的 SHA-256。只存一个 `latest` 标签无法复现：同一个 URL、Prompt 名或模型别名在不同时间可能指向不同内容。

这种“产物对应输入、构建者和构建过程”的思路与 [SLSA Build Provenance](https://slsa.dev/spec/v1.2/build-provenance) 一致；这里的简单清单只是项目级可追溯记录，**不表示已获得某个 SLSA 等级**（检索日期：2026-11-24）。若用 GitHub Actions 收集报告，Artifacts 可随 run 上传并返回 SHA-256 digest；下载时 digest 不符可能只是警告，因此发布门禁仍应主动校验摘要并令流水线失败。[GitHub Actions：Store and share data](https://docs.github.com/en/actions/tutorials/store-and-share-data)（检索日期：2026-11-24）

### 每个 Case 的最小记录

~~~json
{"case_id":"A2","release_id":"gateway-stage1-candidate","status":"NOT_RUN","expected":"租户 A 的输入和引用均不含租户 B 文档","actual":null,"task_id":null,"attempt_id":null,"trace_id":null,"evidence":[],"reason":"等待两租户夹具执行"}
~~~

真实结果至少要带 `case_id`、预期/实际、状态、任务/attempt/trace 索引、执行时间、环境和证据文件路径。`PASS` 必须可追到自动断言或可复核的观察记录；只有“我看着好像对了”应标为人工观察，并说明判定人。失败日志要脱敏，普通 Trace 不写入 API Key、完整 Prompt 或敏感原文。OpenTelemetry 的 Span 提供 trace ID、时间、属性、事件和状态，可用来串起入口、路由、供应商调用与用量记录；具体采集字段仍由项目设计，不能把 trace ID 当作证据本身。[OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)（检索日期：2026-11-24）

如果项目以 Java/Spring Boot 实现，可以让集成测试直接输出 `case_id` 和断言结果，再用测试数据库与 FakeProvider 重放同一夹具；业务代码仍负责生成 `task_id`、`attempt_id` 和 Trace。这样报告可以从测试运行产出，避免会后手工改写“通过”。

## 三、验收判定：缺证据和硬失败都不能给 GO

把发布判定写成机器可检查的规则，而不是会后凭印象打分：

~~~text
if 缺少已约定的必跑 Case、发布版本、夹具哈希或运行报告:
    NO_GO（证据不完整）
else if 任一权限、预算、副作用、密钥 Case != PASS:
    NO_GO（安全硬门槛）
else if Golden Set 任一关键桶低于预设阈值:
    NO_GO（质量退化）
else if 压测未达到目标负载，或丢迭代/拒绝/延迟超出门槛:
    NO_GO（容量证据不足或不达标）
else if 无法按 task_id → attempt_id → trace_id 对账，或缺少可执行回滚:
    NO_GO（运营不可解释）
else:
    GO（仅针对本次声明的验收范围）
~~~

第 26 天的 A2 跨租户召回、A3 权限撤销、A4 并发预算、A10 半截工具参数、A11 能力不符的降级、A13 重复投递、A14 敏感日志，以及第 28 天的失败流和重连，是优先的硬门槛。其他 Case 也应按运行前的 `required_cases` 检查。**不要把 `NOT_RUN` 自动当作通过，更不能靠总体 95% 通过率覆盖一次跨租户泄漏。**

对容量报告，列出计划与实际到达率、测试时长、样本数、`dropped_iterations`、任务首字/完成的 p50/p95/p99、主动拒绝率、最大活跃流和内存峰值。若压测器没产生足够流量，剩余请求的低 p95 不证明网关容量。用量表则逐 `attempt_id` 标注供应商回执、可信 usage 来源、结算规则与 `PENDING`；先输出后失败和缺失 usage 都不能无声归零。

Golden Set 报告要给每个样本桶的分母、失败明细、基线与评分规则版本。评测应持续针对真实业务错误回归，并用人工复核校准自动评分。[OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)（检索日期：2026-11-24）。截至本文检索日期，OpenAI 官方弃用信息显示旧 Evals dashboard/API 已进入只读和停用流程；本项目宜用自有 Golden Set 与 CI 报告，避免新建对即将停用接口的依赖。[OpenAI Deprecations](https://developers.openai.com/api/docs/deprecations)（检索日期：2026-11-24）

若要申请生产灰度，再增加明确的 SLO、错误预算、观察窗口和停止条件。Google SRE 的错误预算策略将发布速度与 SLO 消耗关联；本地 Case 全过不能替代真实流量的预算判断。[Google SRE：Error Budget Policy](https://sre.google/workbook/error-budget-policy/)（检索日期：2026-11-24）

## 四、十分钟项目演示：用一条成功链路和一条失败链路

准备好代码与证据后，可以按下面的顺序演示；每一步只展示实际完成的内容：

| 时间 | 展示 | 面试官应看到的证据 |
| --- | --- | --- |
| 0–1 分钟 | 场景、系统边界和发布快照 | 两租户、一次会话任务、版本与 commit |
| 1–3 分钟 | 正常任务从提交到引用展示 | 幂等任务 ID、路由选择、事件序号、合法引用 |
| 3–5 分钟 | 注入一次“已输出后失败” | 失败终态、前端提示、attempt 与 usage 待对账 |
| 5–7 分钟 | 断开 SSE 或撤销文档权限 | 补播不重跑模型，越权引用被拒绝 |
| 7–9 分钟 | 打开评测、容量和安全报告 | 分桶分母、真实负载、硬门槛与失败明细 |
| 9–10 分钟 | 发布决定与复盘 | `GO / NO_GO` 的依据、回滚触发器、尚未完成项 |

讲项目时先说**做了什么、在什么环境做的、如何证实、还有什么没测**。如果没有真实 Kubernetes 环境，就展示本地关闭连接和恢复的报告，不把它描述为“多副本滚动发布已验证”。如果容量报告来自 FakeProvider，也说明它证明的是自有网关容量，真实供应商限额仍要单独验证。

## 五、今天提交什么，明天如何验收

1. 先填 `release.yaml`：commit、版本、夹具和评分规则哈希，运行前写定必跑 Case 与质量/容量阈值。
2. 将已经运行的结果放入逐 Case、评测、容量、用量与安全报告；未运行的项目保留 `NOT_RUN`，写负责人和下一次执行条件。
3. 对所有证据文件计算 SHA-256，保存 CI run、环境和执行时间；随机抽查一个失败 Case 能否从结果跳到脱敏 Trace、attempt 与用量。
4. 按上面的演示顺序跑一遍，记录任何找不到证据的断点。第 30 天只根据实际报告给阶段项目判定；不补造“全通过”截图。

## 六、今日面试题（检索日期：2026-11-24）

以下公开题目中的公司和面试场次若来自发帖者自述，均不代表企业官方题库。参考答案与追问是本文针对阶段项目验收的工程整理。

### 1. Agent 节点怎样单独调试、回归？有自动化 Benchmark 吗？

- **方向 / 难度**：Agent 评测与项目交付 / 难。
- **参考答案**：把节点的输入输出契约、工具返回和时钟固定为夹具，先测节点不变量，再用端到端 Golden Set 看任务成功率；每次运行记录代码、Prompt、模型、样本和评分规则版本。报告按场景与风险分桶，留下失败样本、Trace、基线差异与 CI 阻断阈值。不能把未运行的 Case 算作通过。
- **追问**：节点指标提升，全链路结果却退化，怎样定位？先比较同一发布快照下的任务轨迹，找节点输出在下游使用时的首个偏离，再将该组合样本加入回归集。
- **来源**：[牛客“米哈游 Agent 方向一面”求职者自述](https://www.nowcoder.com/feed/main/detail/925738d51a77467d9f546aec46de588a)，页面显示 11-22；公司和场次未获官方核验。

### 2. 离线评测集有多少条？为什么选这个数量？由谁构建？

- **方向 / 难度**：评测数据、验收可信度 / 中高。
- **参考答案**：不能编造一个“标准条数”。先按业务意图、租户权限、失败类型和风险分桶，定义每桶必须覆盖的正反例；记录样本来源、标注者、标注规则和版本。报告各桶分母、错误数和人工复核分歧，再根据上线风险、误差容忍度和标注预算扩大样本。回归集与未见过的盲测集应分开。
- **追问**：100 条样本全部通过，为什么仍不能直接上线？若高风险权限样本只占 1 条，整体 100% 对该类风险的证据很弱；还需看覆盖、置信度和真实流量灰度。
- **来源**：[牛客“小红书社区工程 Agent 一面”求职者自述](https://www.nowcoder.com/feed/main/detail/ffa23b02ce2048c4a8db2cb2e3fd28ce)，页面显示 11-22；公司和场次未获官方核验。

### 3. 怎样用 Langfuse 排查一个 bad case？

- **方向 / 难度**：可观测、故障归因 / 中高。
- **参考答案**：从任务 ID 找 Trace，按入口、检索、路由、模型、工具与终态的时间线查最早偏离预期的步骤；同时看当时的发布快照、错误分类、usage 与引用权限。将脱敏且人工确认的失败样本标注后回流 Golden Set，比较修复前后同一夹具的结果。Trace 平台可以帮助定位，不能代替业务真值或安全审计。
- **追问**：模型输出有随机性，如何复现？先固定可控输入、模型与 Prompt 版本、工具夹具和路由；对无法完全固定的模型输出，验业务不变量和多次运行分布，报告不确定性。
- **来源**：[牛客“字节大模型算法岗三面”求职者自述](https://www.nowcoder.com/feed/main/detail/baf7ce2ec084425aa8553965330ffb46?sourceSSR=enterprise)，页面显示 11-21；公司和场次未获官方核验。

### 4. 选一个真正工程化落地的项目介绍，你如何证明它已落地？

- **方向 / 难度**：AI 全栈项目陈述 / 中高。
- **参考答案**：按业务目标、自己的职责、系统边界、关键取舍、实际代码与运行证据、量化结果、未完成项讲述。展示同一候选版本的一条正常链路和一条失败链路，给出可复现命令、评测分母、容量负载、Trace 与发布决定。若只有本地演示，就明确说本地范围；不拿方案图冒充线上指标。
- **追问**：最初说“项目已上线”，却拿不出生产流量指标怎么办？纠正描述，说明当前可证明的环境和证据，以及上线还缺哪些门槛。
- **来源**：[牛客“华为 AI 应用三面”求职者自述](https://www.nowcoder.com/feed/main/detail/6003e1c10fc14b82a8c4a759983784d2)，页面显示 11-21；公司、岗位与场次未获官方核验。

## 资料

- [SLSA Build Provenance](https://slsa.dev/spec/v1.2/build-provenance)：产物、输入和构建过程的可追溯关系。
- [GitHub Actions Artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data)：随 CI run 保存报告与摘要。
- [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)：跨入口、路由、模型与账本定位链路。
- [OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)与[Deprecations](https://developers.openai.com/api/docs/deprecations)：持续回归方法及旧 Evals 接口现状。
- [Google SRE Error Budget Policy](https://sre.google/workbook/error-budget-policy/)：生产灰度的 SLO 与发布决策。以上资料检索日期均为 2026-11-24。

第 30 天交付阶段项目一：展示实际代码、证据包和可复现命令，给出与验收范围一致的结论。设计稿、文章和演练计划只能支持“已设计”，不能冒充“已交付”。
