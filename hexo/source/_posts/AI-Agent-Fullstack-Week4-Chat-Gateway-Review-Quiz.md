---
layout: post
title: "AI 全栈开发第四周验收：最小对话服务与模型网关发布演练"
date: 2026-11-23 09:00:00.000
updated: 2026-11-23 09:00:00.000
permalink: /articles/AI-Agent-Fullstack-Week4-Chat-Gateway-Review-Quiz.html
comments: true
description: "AI 全栈开发第 28 天：复盘会话、模型适配、评测、React 流式页面与网关发布，给出一场可复现的故障演练、八道小测及有来源的面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "周复盘"
  - "模型网关"
  - "对话服务"
  - "故障演练"
  - "面试"
---

第四周要回答一个面试官容易追问的问题：**从浏览器发出一句话，到模型输出、任务落库、引用展示和灰度上线，这条链路哪里算成功？** 单个接口返回 200、页面出现一段文字、Schema 校验通过，都不足以单独证明一次企业级 AI 任务成功。

今天把第 22–27 天的六篇文章接成一场发布演练，附八道自测题。本文给出夹具、门槛和参考答案；它不是已运行的项目报告。真正通过需要保存测试结果、脱敏 Trace、容量记录与回滚证据。
<!--more-->

## 一、六天内容如何组成一次完整交付

| 篇目 | 本周确定的边界 | 第 30 天要提交的证据 |
| --- | --- | --- |
| [Day 22：最小对话服务](/articles/AI-Conversation-Service-Vertical-Slice.html) | 会话、消息、一次任务各有事实状态；重试不产生第二轮回答 | 同键重试只有一个任务，失败回答不写成成功消息 |
| [Day 23：Provider 适配器](/articles/AI-Chat-Service-Provider-Adapter-Event-Normalization.html) | 供应商事件先归一化，再写任务事件与 usage | 完成、失败、不完整、累计用量各有固定夹具 |
| [Day 24：Golden Set 与 Trace](/articles/AI-Chat-Service-Golden-Set-Trace-Regression.html) | 格式、语义、权限、成本分开验；发布比较固定版本 | 逐样本差异、评测分母、Trace 与发布快照 |
| [Day 25：React 对话页](/articles/AI-Chat-UI-React-SSE-Citations-Cancel.html) | UI 订阅与业务执行分离；断线按事件游标恢复 | 重连录屏或自动化记录、引用权限与取消状态 |
| [Day 26：阶段项目预检](/articles/AI-Model-Gateway-Stage1-Preflight-Fault-Drill.html) | 14 个故障 Case 和不可变发布快照 | 每个 Case 的 PASS / FAIL / NOT_RUN 与根因 |
| [Day 27：部署、压测与安全](/articles/AI-Model-Gateway-Deployment-Load-Test-Security-Gates.html) | Pod 就绪、排空、慢消费者、租户及密钥隔离 | 滚动发布时间线、完整任务压测与泄漏扫描 |

把边界串起来，就是一条可以被解释的状态链：

~~~text
认证主体 + 会话请求
  → 幂等任务 / 发布快照 / 预算预留
  → Provider Adapter → 归一化事件 → 持久化任务事件
  → 结构与业务校验 → usage 对账 → 任务终态
  → SSE 投递 / 断线补播 → 前端展示与引用
  → Golden Set、Trace 和发布门槛
~~~

**关键不变量：文本增量不是成功终态，合法 JSON 不是合规答案，SSE 重连不是重新执行任务，HTTP 请求完成不是对话任务完成。** OpenAI 的 Responses 流把 `response.completed`、`response.failed`、`response.incomplete` 分为不同事件；失败或不完整事件中的 usage 可能为 `null`。因此适配器要保留事件事实，不能因为已经收到文本就写 `SUCCEEDED`，也不能把未知用量记成 0。[OpenAI Responses 流事件参考](https://developers.openai.com/api/reference/resources/responses/streaming-events)（检索日期：2026-11-23）

## 二、120 分钟发布演练：两租户的一轮差旅政策问答

沿用第 26 天的“企业差旅政策”场景。租户 A 与 B 对同一问题有不同文档和配额。准备 `FakeProvider`、固定时钟、两组受信身份、可控 SSE 客户端和一份 Golden Set；少量真实模型请求只作协议兼容冒烟，不代替确定性故障测试。

~~~yaml
release_id: travel-gateway-candidate-1
contracts: [chat-api-v2, task-events-v2]
route_version: route-v8
registry_version: registry-v6
prompt_version: travel-policy-v4
knowledge_snapshot: travel-20261123
golden_set_hash: sha256-of-fixtures
tenants: [tenant-a, tenant-b]
~~~

这是一份**练习用发布快照**，不是线上配置。任务创建时固定路由、模型注册、Prompt、知识、价格和评测版本；热更新只影响新任务。若同一任务中途换版本，Trace 即使齐全也无法可靠解释差异。

按时间推进：

1. **0–25 分钟，冻结与提交。** 记录发布快照、Golden Set 哈希、认证主体与任务 ID。并发提交相同幂等键，核对唯一任务、一次预算预留以及同键异体冲突。
2. **25–55 分钟，供应商事件。** 注入完成、不完整、流内错误、累计 usage、半截工具参数。保存原始事件摘要、归一化事件、attempt 和最终任务状态；不要把响应正文原文写进普通日志。
3. **55–85 分钟，浏览器与权限。** 在第五条事件后断线，带 `Last-Event-ID` 重连；同时撤销一个引用的权限。检查事件只补播一次、前端不重复拼字、无权引用不再展示。
4. **85–120 分钟，发布与容量。** 用固定到达率跑完整任务，记录实际到达、丢迭代、排队、首字、完成耗时、活跃 SSE 与内存；再在长流中滚动替换一个 Pod，观察旧连接关闭和新副本补播。

### 故障矩阵：先验状态，再验页面

| Case | 故障注入 | 必须观察到的结果 |
| --- | --- | --- |
| W4-01 | 已输出两段文本，随后 `response.incomplete` | 任务为不完整/失败；页面不给“已完成”；usage 未知则待对账 |
| W4-02 | OpenAI 流内 `response.failed`，usage 为 `null` | 记录失败原因和 attempt；不把未知 usage 归零 |
| W4-03 | Claude 流在开始后返回错误事件 | 适配器分类为流内失败；不把 HTTP 成功当任务成功 |
| W4-04 | Claude 多次报告累计 `message_delta.usage` | 用最后可信累计值结算，不逐段求和 |
| W4-05 | 工具 `input_json_delta` 在半个 JSON 处中断 | 不解析执行、不产生工具副作用 |
| W4-06 | 模型拒绝回答，未按目标 Schema 输出 | 先识别拒绝，不让解析异常伪装成正常业务失败 |
| W4-07 | JSON 格式正确，引用却指向租户 B 文档 | 业务授权门槛拦截，不能因格式通过而发布 |
| W4-08 | 同键并发重放与旧 Worker 写回 | 一个任务、合法持有者写终态；attempt 按实际调用保留 |
| W4-09 | 慢消费者断线并重连 | 连接缓冲有界；按持久化序号补播，不重新调用模型 |
| W4-10 | 滚动发布时旧 Pod 持有长 SSE | 停收新流、排空或关闭旧连接；新副本可续读，无任务丢失 |
| W4-11 | 上游限流 429 | 业务限流/有界重试；不能把偶发 429 映射为全体 Pod 存活失败 |
| W4-12 | 压测器缺少可用虚拟用户，丢失迭代 | 容量报告判为无效或未达标，不能只报剩余请求的 p95 |

Claude 的 `message_delta.usage` 是累计值；流中可能出现 ping、流内错误和未知事件类型，工具参数 `input_json_delta` 是 JSON 片段，需要等内容块结束再解析。[Anthropic Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)（检索日期：2026-11-23）。Structured Outputs 约束输出形状，但模型拒绝时可能不符合 Schema；即使符合 Schema，也要另做引用 ACL、预算和业务规则校验。[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)（检索日期：2026-11-23）。

Kubernetes 的 Readiness 控制 Pod 是否接收 Service 新流量，Liveness 失败触发重启，Startup 成功前另两种探针不会运行。终止有宽限期，默认 30 秒；对长 SSE 必须在演练中证明排空和恢复，而不是只写 `terminationGracePeriodSeconds`。[Kubernetes Probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/)、[Pod Termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-termination/)（检索日期：2026-11-23）

### 发布门槛和证据如何写

每条记录保存 `case_id`、`release_id`、`tenant_id`、`task_id`、`attempt_id`、`trace_id`、预期/实际终态、usage 来源、耗时以及 `PASS / FAIL / NOT_RUN`。**跨租户泄漏、无权引用、超预算调用和未审计工具副作用是硬失败**，不靠其他 Case 的通过率抵消。Golden Set 的准确率、首字和完成耗时的阈值应在测试前约定，记录分母与基线；没有运行结果时保留 `NOT_RUN`。

压测也要写清是否真的达到了计划到达率。k6 的 `checks` 本身不会使测试以非零码失败，应该设置 `thresholds`；固定到达率下虚拟用户不足会产生 `dropped_iterations`。只给成功进入系统的请求报 p95，会把漏压隐藏起来。[k6 Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)、[Dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/)（检索日期：2026-11-23）

建议交付 `release.yaml`、`fixtures.jsonl`、`report.jsonl`、脱敏 `trace-samples.jsonl`、Golden Set 差异报告与滚动发布时间线。把密钥扫描和租户权限 Case 放进发布流水线；Kubernetes Secret 默认存于未加密的 etcd，仍需启用静态加密、限制读取权限，并控制同命名空间创建 Pod 的能力。[Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)（检索日期：2026-11-23）

## 三、第四周小测：先答题，再看答案

以下八题是本系列自测题，**不是企业面试原题**。建议限时 20 分钟，每题按“结论、依据、工程动作”各 1 分，共 24 分。

1. OpenAI 流已经给出三段文本，最后是 `response.incomplete`。任务和 UI 能否标成功？
2. 某次失败事件的 usage 为 `null`。成本账本应该写 0 吗？
3. Claude 的三次 `message_delta.usage.output_tokens` 分别为 10、20、30。结算时如何使用？
4. 工具参数只收到 `{"account_id":"A`，随后流中断。能否先调用工具再补参数？
5. 配置了 Structured Outputs，模型发出拒绝回答。是否继续按目标 JSON Schema 强行解析？
6. 一条输出符合 JSON Schema，却引用了租户 B 的文档。哪个门槛应阻断发布？
7. 供应商偶发 429，能否让 `/health/live` 返回失败以触发所有 Pod 重启？
8. k6 的业务 `checks` 全过，但 `dropped_iterations` 很高；能否宣称目标到达率下 p95 达标？

### 参考答案

| 题号 | 结论与依据 | 应采取的动作 |
| --- | --- | --- |
| 1 | 不能。文本增量不等于 `response.completed` | 标记不完整/失败，保留已输出内容的来源和提示，页面不展示成功终态 |
| 2 | 不应写 0。`null` 表示没有可信用量报告 | 标记 `USAGE_PENDING`，保留 attempt，待供应商账单或其他可信来源对账 |
| 3 | `message_delta.usage` 是累计值，不求和为 60 | 在事件序列可靠且无回退异常时取最后可信累计值 30，记录来源 |
| 4 | 不能。片段不是完整参数，也未通过业务校验 | 等内容块结束、完整解析、授权与审批后才执行工具 |
| 5 | 不继续强行当正常对象解析。拒绝是单独分支 | 先识别 refusal，再按产品契约提示用户或转人工 |
| 6 | 业务授权与引用校验。Schema 只约束形状 | 在模型输入与输出引用两侧检查租户 ACL；泄漏为硬失败 |
| 7 | 不应因一次上游 429 重启服务进程 | 由准入、限流、退避和降级处理；探针按本服务能否接流定义 |
| 8 | 不能。实际负载未达到目标，样本已偏 | 设置丢迭代与业务指标 `thresholds`，补足压测器容量并重跑 |

## 四、今日面试题（检索日期：2026-11-23）

以下题面取自可访问的牛客用户自述。公司、岗位与场次均依发帖者标注，**未获企业官方核验**；参考答案与追问是本文的工程整理，不是企业标准答案。

### 1. JSON 已符合 Schema，但内容判断错了，怎么发现？

- **方向 / 难度**：结构化输出、语义评测 / 中等。
- **参考答案**：Schema 只验证字段、类型等结构；关键判断要用业务不变量、字段间约束和可核验的引用证据检查。把误判样本放进 Golden Set，按正负样本分别看误报和漏报，必要时人工抽检。对于租户、权限、预算等规则，由后端确定性校验执行。
- **追问**：如果模型把“差旅费不超过 800 元”判成“可报销 1800 元”，怎样给这类错误设发布门槛？维护带证据和预期判断的样本桶，报告该桶错误数与分母；高风险规则可设零容忍。
- **来源**：[牛客“蚂蚁面经”求职者自述](https://www.nowcoder.com/feed/main/detail/d9d6a1ea1adc41b4a44ca47b535e9994?sourceSSR=enterprise)，页面标示 11-12；企业归属与题目原话未获企业官方核验。

### 2. 通用 AI 平台如何区分免费、付费和企业客户，并让商业化可持续？

- **方向 / 难度**：模型网关、配额计费 / 中等。
- **参考答案**：先定义各层可用模型、速率、并发、Token 额度、预算上限和服务等级；入口做原子准入，任务级账本记录供应商 attempt、缓存命中、重试及实际用量。按成功任务成本与毛利观察路由策略，超限时明确拒绝或使用符合能力与数据约束的降级路径，而不是静默偷换模型。
- **追问**：一次流已输出一半后失败，如何给用户计费？分开记录供应商实际成本与用户侧计费规则；未知 usage 待对账，不自行记零；账单争议能追到任务与 attempt。
- **来源**：[牛客“阿里云面经”求职者自述](https://www.nowcoder.com/feed/main/detail/e2d7d87cab1c41c6a70d9eef166ec1c1?sourceSSR=enterprise)，页面标示 11-12；企业归属未获官方核验。

### 3. SSE 连接断开后，后台任务怎样继续运行？

- **方向 / 难度**：对话服务、流式恢复 / 难。
- **参考答案**：SSE 是事件投递连接，任务生命周期由持久化状态和 Worker 管理；断开后按后端预算、截止时间与取消策略决定任务是否继续。事件写入持久层并带任务内递增序号，客户端带 `task_id` 与最后确认 ID 重连；任务已完成则读终态快照，未完成则补播后继续订阅。重连不能新建任务或重复调用模型。
- **追问**：事件过期或重复如何处理？重复按序号去重；游标早于保留窗口则返回明确的过期语义，客户端读任务快照并标明无法完整补播。
- **来源**：[牛客“科大讯飞二面 11.16”求职者自述](https://www.nowcoder.com/feed/main/detail/f42d0f8b3a264cb98bd07e55dc1a9e78)，页面发表于 11-19；具体岗位名称未获核验。

### 4. 一次任务中途模型超时，切换到另一个模型会影响什么？

- **方向 / 难度**：Provider 适配、故障切换 / 难。
- **参考答案**：先判断旧 attempt 是否已经输出内容、产生工具副作用或留下未知结果；检查备用模型的上下文窗口、工具/Schema 能力、数据区域、质量与成本约束。已对外投递的文本不能无提示拼接备用模型输出；从安全检查点开启新 attempt，保留旧事件、路由版本和用量证据。写操作结果未知时先查询或对账。
- **追问**：工具参数只流出半个 JSON 时能否切换并执行？不能执行未闭合、未校验的参数；可在新 attempt 重新生成完整参数，重新走授权与审批。
- **来源**：[牛客“科大讯飞二面 11.16”求职者自述](https://www.nowcoder.com/feed/main/detail/f42d0f8b3a264cb98bd07e55dc1a9e78)，页面发表于 11-19；公司与场次来自用户自述，未获企业官方核验。

## 资料与下一步

- [OpenAI Responses 流事件参考](https://developers.openai.com/api/reference/resources/responses/streaming-events)与[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)：终态、拒绝、结构化输出边界。
- [Anthropic Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)：累计 usage、流内错误和工具参数片段。
- [Kubernetes Probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/)与[Pod Termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-termination/)：探针与滚动终止。
- [k6 Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)与[Dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/)：容量验收的有效负载。以上资料检索日期均为 2026-11-23。

第 29 天整理实际运行报告、遗漏项与阶段项目验收材料；第 30 天才按这些证据交付第一个模型网关项目。若还未动手，面试时应明确说“这是设计与测试计划”，不要把练习规格说成真实线上成绩。
