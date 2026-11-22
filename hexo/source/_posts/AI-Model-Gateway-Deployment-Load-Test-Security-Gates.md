---
layout: post
title: "模型网关上线前怎么验收：容器就绪、流式压测与密钥隔离"
date: 2026-11-22 09:00:00.000
updated: 2026-11-22 09:00:00.000
permalink: /articles/AI-Model-Gateway-Deployment-Load-Test-Security-Gates.html
comments: true
description: "AI 全栈开发第 27 天：把模型网关的故障演练变成部署验收，讲清 Kubernetes 探针和优雅停机、SSE 慢消费者、容量压测、密钥与租户隔离，附三道有来源的面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "模型网关"
  - "部署"
  - "SSE"
  - "性能"
  - "安全"
  - "面试"
---

[第 26 天](/articles/AI-Model-Gateway-Stage1-Preflight-Fault-Drill.html)列了 14 个故障 Case。今天是第 27 天：把“本地夹具能通过”推进到“多副本部署后仍能解释、恢复和限流”。重点不是先堆 Kubernetes YAML，而是回答三个上线问题：**新流量该不该进来，已有流量怎样离开，容量用什么证据证明。**

本文给出部署与压测的练习契约，尚未替读者运行真实网关；文中的阈值和配置片段是待按业务 SLO 校准的示例。
<!--more-->

## 一、从一条任务看部署边界

~~~text
浏览器
  → Ingress / Gateway → Service → API Pod
                            ├─ 任务、事件、Outbox → PostgreSQL
                            ├─ Worker 租约与预算账本
                            └─ Provider Adapter → 模型供应商
~~~

Pod 会被替换，SSE 连接会断；任务和事件必须在共享持久层，另一副本才能根据 <code>task_id + Last-Event-ID</code> 续读。Service 提供一组 Pod 的稳定访问入口，Ingress 或 Gateway 负责外部 HTTP 路由；它们不会自动替应用保存事件或实现任务幂等。[Kubernetes Service](https://kubernetes.io/docs/concepts/services-networking/service/)、[Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)（检索日期：2026-11-22）

把验收分成四个门槛，每个都要有实际报告：

| 门槛 | 必须证明的事实 | 不合格时的动作 |
| --- | --- | --- |
| 权限与密钥 | 租户身份来自认证；跨租户任务、引用与事件不可读；密钥不进镜像和日志 | 停止发布 |
| 恢复 | API/Worker 重启不丢任务；SSE 断线只重放事件；旧 Worker 无法写回 | 修复状态机后重测 |
| 容量 | 指定流量形状下，排队、首字延迟、完成率和内存有上限 | 拒绝扩量或回滚 |
| 运维 | 探针语义正确；部署排空与回滚可复现 | 保留旧版本 |

**HTTP 202 的延迟不能代表任务完成延迟。** 对 AI 服务要分别量提交耗时、队列等待、模型首字、完整答案、SSE 连接驻留与每成功任务成本。

## 二、探针回答不同问题

建议设计三个内部端点，实际实现可复用框架健康组件：

| 探针 | 只回答什么 | 避免什么 |
| --- | --- | --- |
| <code>/health/startup</code> | 配置已解析、连接池初始化完成 | 尚未初始化就触发其他探针 |
| <code>/health/live</code> | 进程与事件循环仍能响应 | 因供应商一次 429 重启所有 Pod |
| <code>/health/ready</code> | 当前副本能否安全接收新任务 | 数据库不能持久化任务时仍返回就绪 |

Readiness 失败会使 Pod 停止接收新的 Service 流量；Liveness 失败会触发容器重启；Startup 成功前不会运行另外两种探针。这是 Kubernetes 的探针语义。把模型供应商偶发 429 直接映射成 Liveness 失败，会把容量问题放大成副本重启，是基于这些语义作出的工程判断。[Kubernetes Probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/)（检索日期：2026-11-22）

<code>ready</code> 应检查本服务的**必要依赖**：发布配置有效、数据库可以完成短时读写、任务能持久化。队列暂时不可用时是否仍能接收任务，取决于 Outbox 能否可靠积压及业务等待 SLO；要在产品契约里写清。健康探针不应每次付费调用模型，更不能让外部供应商的公共状态页决定全部副本就绪。

FastAPI 的 <code>lifespan</code> 可管理连接池初始化与清理。若使用 Kubernetes 多副本，数据库迁移应作为单独、受控的部署步骤，避免每个 API 副本同时改表。[FastAPI Lifespan](https://fastapi.tiangolo.com/advanced/events/)、[FastAPI Docker Deployment](https://fastapi.tiangolo.com/deployment/docker/)（检索日期：2026-11-22）

## 三、滚动发布时如何排空 SSE

一次正常终止应有可观察的顺序：

1. 新请求停止分配给旧 Pod；停止领取新任务。已受理的任务仍保留在数据库和 Outbox。
2. 已建立的 SSE 可在宽限窗口内继续投递；到窗口边界时关闭连接，让浏览器带上最近的事件 ID 连到新副本。
3. Worker 对未完成步骤写检查点、保留租约与 attempt 证据；无法确认的供应商调用进入待对账，而不是假装没执行。
4. 新副本按持久化的任务事件补播，前端按 <code>seq</code> 去重，并以任务快照确认终态。

Kubernetes 终止流程有宽限期：默认 30 秒，可能先运行 <code>preStop</code>，再发送 TERM，超时后执行强制结束；终止中的 EndpointSlice 会标为不就绪。业务应按自己的最长可排空步骤设置窗口，并在实际滚动发布中验证；不能因为 YAML 写了一个秒数就认定流已无损。[Kubernetes Pod Termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-termination/)（检索日期：2026-11-22）

Uvicorn 的 <code>--timeout-graceful-shutdown</code> 限制等待正在处理的请求完成的时间；它要与 Pod 宽限期协调。长 SSE 连接可能不会自然结束，因此恢复能力来自**先持久化事件、再允许客户端续读**。<code>--limit-concurrency</code> 超限会返回 503，<code>--backlog</code> 是 TCP 接入队列；它们都不是按租户公平调度的业务队列。[Uvicorn Settings](https://github.com/Kludex/uvicorn/blob/main/docs/settings.md)、[Server Behavior](https://github.com/Kludex/uvicorn/blob/main/docs/server-behavior.md)（检索日期：2026-11-22）

部署演练至少做一次“旧 Pod 正在推送第 5 条事件时终止”：记录客户端最后确认的 <code>seq</code>、重连目标副本、补播序号和供应商 attempt 数。**重连不能重新创建任务或再扣一次预算。**同时逐跳核对入口代理的缓冲与空闲超时配置；不能只在本机直连 API 测出“流式正常”。

## 四、压测要压完整任务，而不是只压提交接口

先用 <code>FakeProvider</code> 固定首字延迟、每秒增量、总输出和故障比例，再用少量真实供应商调用做兼容性冒烟。这样能把本地容量问题与供应商限额、随机输出和真实账单分开；这是工程测试设计，不是供应商的原生功能。OpenAI 的限流文档列出 RPM、TPM 等独立约束，失败请求与 SDK 重试也会影响实际可用额度，因此不宜把大流量压测直接打向付费 API。[OpenAI Rate Limits](https://developers.openai.com/api/docs/guides/rate-limits)（检索日期：2026-11-22）

一组可复现的压测输入可以这样写：

~~~yaml
scenario: stream-20rps-30s
tenants:
  tenant_a_weight: 0.8
  tenant_b_weight: 0.2
arrival_rate_per_second: 20
duration_minutes: 10
fake_provider:
  first_token_ms: 300
  stream_seconds: 30
  output_events: 60
slow_consumers_percent: 5
failure_cases: [temporary_429, stream_error, client_disconnect]
~~~

稳态估算平均活跃流数约为“到达率 × 平均驻留时间”，这里是 <code>20 × 30 = 600</code> 条；这是容量规划的起点，**不是实际测得的峰值**。压测必须包含完整 SSE 消费者、慢消费者、断线重连与取消，不能只等 <code>POST /v1/tasks</code> 返回 202 就结束。两租户同时压测时还要观察是否有一方挤掉另一方的保底容量。

| 指标 | 按什么粒度看 | 为什么 |
| --- | --- | --- |
| 入口接受 / 拒绝率 | 租户、路由版本、拒绝原因 | 区分主动限流与系统故障 |
| 队列等待、首字、完成耗时 | p50 / p95 / p99 与样本数 | 找到排队和长尾；不编造线上 P99 |
| 活跃 SSE、每连接缓冲、重连成功 | 副本、租户、流量类型 | 发现慢消费者与内存放大 |
| Worker 租约、attempt、待对账 usage | 任务与供应商 | 发现重复执行和漏记成本 |
| CPU、内存、FD、重启、503 | Pod 与入口 | 定位资源限制和过载保护 |

慢客户端不能让每个 SSE 连接无限积压待发送字节。给连接设置有界缓冲和慢消费者阈值；达到阈值时按业务策略停止上游生成或断开该连接，保留可重放事件。资源不足时优先对**新任务**做有解释的准入拒绝，保护已运行任务；确实超过慢连接上限时再断开并提示续读。这里的阈值由压测和业务优先级决定，不是一个通用常数。

k6 的固定到达率执行器按目标速率发起迭代；若虚拟用户不足会产生 <code>dropped_iterations</code>，这不是网关容量达标。其 HTTP 请求耗时指标对长流在响应结束后才完整统计，测 SSE 首字、事件间隔与补播成功率需要额外埋点。两点分别依据 k6 官方执行器与指标语义，后一句是针对本服务的测试推导。[k6 Constant Arrival Rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/)、[Metrics Reference](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/)（检索日期：2026-11-22）

## 五、密钥和租户隔离是发布硬门槛

供应商 Key 只能在服务端适配器使用；前端只拿自己的任务和授权事件。镜像、仓库、浏览器网络响应、普通日志、Trace 属性都不能含明文 Key。Kubernetes Secret 本身不意味着“已安全”：官方文档提醒默认 Secret 在 etcd 中未加密，应启用静态加密并用最小 RBAC 限制读取；可创建 Pod 的主体也可能间接获取同命名空间 Secret。[Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)、[Good Practices](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)（检索日期：2026-11-22）

部署验收要用两个测试租户跑同 Query：从认证主体获取 <code>tenant_id</code>；任务读写、SSE 订阅、引用查询和缓存键均检查租户与 ACL 纪元。成员权限撤销后，已有长连接要停止继续投递敏感事件；读取旧任务时重新鉴权。对无权任务可统一返回 404 以减少枚举风险。安全 Case 出错一次就阻断发布，不能用平均成功率抵消。

## 六、今天交付什么

给第 30 天项目准备一份 <code>deployment-readiness.md</code> 和可回放报告，不预填“全部通过”：

1. 写出 Startup / Liveness / Readiness 的条件与失败处理，保存一次滚动终止时的时间线。
2. 用 FakeProvider 跑“短答、30 秒流式、慢消费者、429、断线重连”五种负载；保存到达率、<code>dropped_iterations</code>、连接数、队列、首字与任务完成分布。
3. 扫描镜像、仓库、普通日志与浏览器响应中的 Key；跑两租户跨读和权限撤销 Case。
4. 在发布前写定门槛：权限泄漏与超预算调用为零；容量门槛给出目标负载、样本数、p95/p99 和允许的拒绝率；部署期间任务无丢失、补播无重复副作用。

验收结果逐 Case 标 <code>PASS / FAIL / NOT_RUN</code>。若还没有代码、测试环境或报告，就诚实保留 <code>NOT_RUN</code>；面试时也应说明这是部署设计而非已完成的线上压测。

## 七、今日面试题（检索日期：2026-11-22）

以下题面来自可直接打开正文的牛客用户自述；企业与场次归属未获官方核验。参考答案与追问是本文按可执行系统整理的版本，不是企业标准答案。

### 1. 不同模型返回速度不一致，或客户端消费很慢，SSE 怎样做背压？

- **方向 / 难度**：Agent 流式服务、容量保护 / 难。
- **参考答案**：每连接设置有界缓冲与待发送字节、排队时长阈值；能暂停上游时暂停，不能暂停时按业务策略取消上游生成或断开慢连接。任务事件先持久化，断开后按游标补读；连接断开不自动等同于任务取消。
- **追问**：慢消费者断开后重新连接，会不会把模型又调用一遍？只重放任务事件，不创建第二个供应商 attempt。
- **来源**：[牛客“阿里集团后端 / Agent 开发一面”用户自述](https://www.nowcoder.com/feed/main/detail/e2d7d87cab1c41c6a70d9eef166ec1c1?sourceSSR=enterprise)，页面显示 11-12；公司归属未获官方核验。

### 2. 上线后的 QPS、P99 与 OOM 风险怎样证明，而不是报一个估计数字？

- **方向 / 难度**：AI 应用容量、故障恢复 / 难。
- **参考答案**：明确请求与任务的分母、负载形状和样本时间；分别测提交接口、队列等待、首字、完成耗时和活跃流。给连接缓冲、队列和模型并发设上限，持续观察内存、FD、重启与拒绝率。没有真实线上数据时给压测报告和限制，不能编造 QPS/P99。
- **追问**：若稳定到达 200 请求/秒、平均 SSE 驻留 30 秒，平均活跃连接约多少？约 6000；还要预留突发和长尾余量。
- **来源**：[牛客“快手 AI 应用开发二面”用户自述](https://www.nowcoder.com/discuss/947236309687345152?sourceSSR=dynamic&weFlow=true)，页面显示 11-03，正文可见 QPS/P99、OOM 和无界队列追问；公司归属未获官方核验。

### 3. Pod 网络、Service、Ingress 在网关流量路径里各做什么？

- **方向 / 难度**：部署与网络链路 / 中高。
- **参考答案**：Pod 网络提供工作负载通信；Service 给动态 Pod 集合一个稳定服务入口；Ingress 或 Gateway 按域名、路径和 TLS 规则接入外部 HTTP 流量。排查 SSE 要沿每一跳检查缓冲、超时和断连，应用层仍负责事件持久化与续读。
- **追问**：滚动发布中旧 Pod 上的长连接关闭后，新 Pod 如何续推？从持久化事件按最后确认的事件 ID 补播，并防重复执行模型。
- **来源**：[牛客“字节抖音社招一面”用户自述](https://api-cdn.nowcoder.com/feed/main/detail/a385d6cc457d47c99c03cb8ea752ab89?sourceSSR=dynamic)，页面显示 08-30；公司归属未获官方核验。

## 资料与下一步

- [Kubernetes Probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/)与[Pod Termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-termination/)：就绪、存活和终止时序。
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)与[Good Practices](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)：密钥存储与访问边界。
- [FastAPI Docker Deployment](https://fastapi.tiangolo.com/deployment/docker/)与[Uvicorn Settings](https://github.com/Kludex/uvicorn/blob/main/docs/settings.md)：容器部署和并发、排空参数。
- [k6 Constant Arrival Rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/)与[Metrics Reference](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/)：到达率与压测指标。以上资料检索日期：2026-11-22。

第 28 天做第四周复盘与小测；第 29 天整理项目验收证据，第 30 天按实际运行报告交付阶段项目一。
