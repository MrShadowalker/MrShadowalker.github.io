---
layout: post
title: "模型网关阶段项目预检：用故障演练证明可交付"
date: 2026-11-21 20:50:00.000
updated: 2026-11-21 20:50:00.000
permalink: /articles/AI-Model-Gateway-Stage1-Preflight-Fault-Drill.html
comments: true
description: "AI 全栈开发第 26 天，在第 30 天阶段项目之前，为多租户模型网关、任务 API、SSE 对话页、预算账本与评测发布建立故障演练和证据清单。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "阶段项目"
  - "模型网关"
  - "故障演练"
  - "面试"
---

第 30 天的阶段项目是一个最小模型网关。今天是第 26 天，先做一次**预检**：把已有的注册表、路由、租户预算、适配器、任务状态、事件流、评测和浏览器页面放在同一条链路里，专门找会在面试追问中暴露的问题。

本文给的是练习规格与验收方法，不代表项目已经实现或通过。每一个“通过”都应由代码、日志、评测报告和可复现的故障注入支撑。
<!--more-->

## 一、项目边界：一个任务、一条可回放链路

选择“企业差旅政策问答”作为最小业务。两个租户有不同政策，同一句问题必须得到各自授权的答案。系统图可以压缩为：

~~~text
React 对话页
  → 身份 / 租户 / POST 创建任务
  → 任务表 + 事件表
  → 路由配置快照 + 模型能力注册表
  → 预算预留 + 速率 / 并发准入
  → Provider Adapter
  → 结构和引用校验
  → usage 对账 + Trace + SSE 重放
~~~

不需要为了展示“Agent”硬加多步规划。这个项目的主目标是证明最小 AI 服务的可靠边界：相同输入在不同租户下不会串数据，异常时不会无限重试或重复计费，用户知道任务究竟成功、失败还是被取消。

## 二、冻结一次发布快照

在演练前保存一份只读发布清单：

~~~yaml
release_id: gateway-stage1-candidate
api_contract: chat-api-v2
event_contract: task-events-v2
route_version: route-v8
model_registry_version: registry-v6
prompt_version: travel-policy-v4
knowledge_snapshot: travel-20261121
price_version: provider-price-20261121
golden_set_hash: sha256-of-fixtures
rubric_version: travel-qa-v3
~~~

这里的 <code>task</code> 就是第 16–22 天 API 中的一轮对话任务。每个任务固定这份快照；热更新只影响新任务。否则同一条长任务中途切换模型、Prompt 或知识库，事后既难复现，也难说明是哪次发布造成退化。OpenAI 的评测建议要求任务相关样本持续回归；供应商的流式事件又有明确终结、错误和不完整状态，发布门槛应覆盖这些协议分支。[OpenAI 评测最佳实践](https://developers.openai.com/api/docs/guides/evaluation-best-practices)、[OpenAI 流式事件参考](https://developers.openai.com/api/reference/resources/responses/streaming-events)（检索日期：2026-11-21）

## 三、故障注入矩阵

用 FakeProvider、FakeClock 与两个租户夹具先验收控制面。真实供应商只用于少量端到端冒烟，不要把其随机输出和限流误认为本地协议的确定性测试结果。

| Case | 注入条件 | 必须留下的证据 |
| --- | --- | --- |
| A1 正常回答 | 授权片段命中，模型返回正确引用 | 终态 SUCCEEDED；证据 ID、模型版本、一次 attempt |
| A2 跨租户召回 | B 的政策比 A 的政策更相似 | 模型输入、引用和缓存均不含 B 的片段 |
| A3 权限撤销 | ACL 纪元更新，旧答案缓存未过期 | 旧缓存不再命中；无权引用被拒绝 |
| A4 预算并发 | 两个请求同时争最后余额 | 原子预留只放行允许的请求；失败者无供应商调用 |
| A5 临时 429 | 带重试等待时间，且截止时间足够 | 有界重试，保留每次 attempt 与实际用量 |
| A6 支出封顶 | 供应商返回不可恢复的额度错误 | 不重试；明确失败分类 |
| A7 先输出后错误 | 第三段文本后出现流内错误 | 对外 FAILED/不完整，不拼接备用模型文本 |
| A8 客户端断开 | 浏览器丢失 SSE 连接 | 重新订阅按事件序号补发或明确退到快照 |
| A9 取消竞争 | 取消与完成几乎同时发生 | 最终只落一个合法终态，已产生用量仍入账 |
| A10 工具半包 | 参数 JSON 到一半就断流 | 不执行工具，不留下未审计副作用 |
| A11 模型降级 | 备用模型缺严格输出能力 | 路由拒绝不合格候选，报告可见原因 |
| A12 热更新 | 旧任务执行中发布 route-v9 | 旧任务固定 v8，新任务才读取 v9 |
| A13 重复投递 | Worker 收到相同任务两次 | 任务/步骤唯一约束、状态版本与 fencing 阻止重复提交；外部动作使用独立幂等键，attempt 按实际调用记账 |
| A14 日志审计 | 输入中有敏感文档片段 | 普通日志只保留摘要/受控引用，不泄漏原文 |

供应商 SSE 已开始后仍可能发送错误事件。Anthropic 文档还说明 <code>message_delta.usage</code> 是累计值，且流中可能有 ping 和新事件类型；适配器不能假定“HTTP 200 就一定成功”，也不能把累计数逐段相加。[Anthropic Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)（检索日期：2026-11-21）

队列层要认真区分“已接收任务”与“恰好执行一次”。Celery 官方建议任务函数幂等；即使设置延迟确认，Worker 异常终止的确认和重投递行为仍有条件，不能承诺绝对的单次执行。任务 ID、业务幂等键和供应商 attempt ID 应分别保存。[Celery Tasks](https://docs.celeryq.dev/en/stable/userguide/tasks.html)（检索日期：2026-11-21）

## 四、通过门槛与交付物

对每个 Case 记录 <code>PASS / FAIL / NOT_RUN</code>，不把未跑记成通过。建议的阶段预检门槛：

1. A2、A3、A4、A10、A11、A13、A14 等权限、预算与副作用安全 Case 全部通过。
2. A7、A8、A9 的最终状态与事件顺序可重放；浏览器与服务端记录一致。
3. Golden Set 报告含逐桶结果、分母、失败样本、基线对比；质量、延迟和每成功任务成本阈值在运行前写定。
4. 每个任务都能沿 <code>task_id → attempt_id → provider_request_id</code> 查到路由、响应状态与用量来源；缺失最终 usage 时标记待对账。

交付目录可用 <code>fixtures/</code> 存故障输入，<code>reports/</code> 存逐 Case JSONL 和差异报告，<code>evidence/</code> 存经脱敏的 trace 与 UI 录屏，<code>release.yaml</code> 固定版本。录屏是交互证据，不能代替自动化报告；通过率数字必须从实际文件计算，不在文章里预填。

## 五、面试时如何讲这个项目

用一条正常请求与一条失败请求说明：用户目标、输入边界、路由决策、供应商调用、终态验证、成本和引用，再展示如何从 trace 找到根因。能说清“为什么拒绝一个不合格备用模型”和“取消后已经产生的 Token 由谁承担”，比罗列框架名更有说服力。第 27–29 天可以补缺口、压测和整理报告；第 30 天再按同一套门槛验收阶段项目。

## 六、今日面试题

以下题面取自公开牛客面经和题单，检索日期均为 **2026-11-21**。标注的公司和场次只来自发帖者自述，未获企业官方核验；社区题单也不是可核验的单场原题。参考答案是本文的工程归纳。

### 1. Agent 在线服务如何做配置热更新、灰度和回滚？

- **方向 / 难度**：AI Infra 发布治理，较难。
- **参考答案**：把模型、Prompt、工具、路由和知识版本做不可变发布快照；新任务按稳定分桶选版本，在途任务固定原快照；灰度按任务成功率、权限错误、p95、成本和负反馈设回滚门槛。
- **追问**：一次错误只发生在高风险租户，整体指标仍健康，回滚吗？该租户桶触发硬门槛，应停止灰度或定向回滚。
- **来源**：[牛客“字节 AI Infra 一面”用户自述](https://www.nowcoder.com/feed/main/detail/a1ce24c561874141abe6ba18a466f982)，公司归属未经官方确认。

### 2. 模型网关什么时候允许自动 Fallback？

- **方向 / 难度**：模型路由与安全降级，较难。
- **参考答案**：只在错误可恢复、业务截止时间允许、尚未对外输出或有明确重启语义时考虑切换；备用模型要通过能力、数据区域、严格 Schema、质量与成本门槛。结果未知的写操作先对账，不能换模型后再盲目重做。
- **追问**：主模型已输出半段文本、备用模型更便宜，能否无提示地接上？不能；应标记原回答不完整，并由用户明确触发新 attempt 或走已定义的恢复流程。
- **来源**：[牛客《JAVA 简历点评（10）》中的 Fallback 追问](https://www.nowcoder.com/feed/main/detail/504ce797ea63400bb26edbe316af5d3d?sourceSSR=post&weFlow=true)，社区简历点评提出的备考题，不是某企业面试原题。

### 3. 手写并发上限为 2 的异步调度器，成功和失败时如何释放名额？

- **方向 / 难度**：网关并发控制，中级。
- **参考答案**：用有界队列和两个 permit；真正发起供应商调用前申请名额，在 <code>finally</code> 释放；取消、异常与超时均走相同释放路径。多实例场景不能靠单进程信号量承诺全局上限，应使用共享计数或分布式租约，并处理崩溃回收。
- **追问**：某个任务持有 permit 等待自己的子任务领取 permit，怎么避免死锁？父节点不占执行 permit 等待子节点，依赖调度与执行容量分离。
- **来源**：[牛客“字节 Agent 全栈研发一面｜备考题单”](https://www.nowcoder.com/discuss/946211096669564928?sourceSSR=enterprise)，作者明确声明来自不同记录的整理，**不是同一场面试实录**，公司归属未获官方核验。

## 资料

- [OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
- [OpenAI Responses streaming events](https://developers.openai.com/api/reference/resources/responses/streaming-events)
- [Anthropic Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Celery Tasks](https://docs.celeryq.dev/en/stable/userguide/tasks.html)

第 27 天继续补预检暴露的缺口，第 30 天用实际报告完成阶段项目验收。
