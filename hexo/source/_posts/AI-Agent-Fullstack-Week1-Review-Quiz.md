---
layout: post
title: "AI 全栈开发首周验收：把 Runtime、ModelClient、预算和评测接成闭环"
date: 2026-11-02 09:00:00.000
updated: 2026-11-02 09:00:00.000
permalink: /articles/AI-Agent-Fullstack-Week1-Review-Quiz.html
comments: true
description: "复盘 AI 全栈开发前六篇，用一个本地夹具任务验收状态、模型调用、上下文预算和回归门禁，附八道自测题与四道公开面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "Agent"
  - "周复盘"
  - "模型工程"
  - "面试"
---

前六篇分别讲了架构、Agent Runtime、ModelClient、Token 预算、Prompt 回归和上下文压缩。今天是第 7 篇，按系列约定做第一次周复盘与小测。

本篇提供一套**可执行的验收标准**：用本地固定响应和模拟工具串起最小闭环，给出故障夹具、八道自测题及答案。系列文章里有接口、伪代码和实验模板；是否真正完成代码、测试或真实模型降本，要以自己的提交物和运行记录证明，不能把阅读文章算作项目验收。
<!--more-->

## 一周知识，落到同一条请求链

| 篇目 | 本周掌握的边界 | 最小可检查证据 |
| --- | --- | --- |
| [Day 1：180 天路线图](/articles/AI-Agent-Fullstack-180-Day-Roadmap.html) | 业务目标、完成条件、禁用动作与平台分层 | 一张任务契约和组件图 |
| [Day 2：Agent Runtime](/articles/AI-Agent-Runtime-State-Machine.html) | Task/Step/Event、合法状态迁移、幂等与恢复 | 状态表、事件序列、失败注入测试 |
| [Day 3：统一 ModelClient](/articles/AI-ModelClient-Structured-Output-Streaming.html) | 供应商适配、结构化输出、流式完成和总截止时间 | 接口、错误分类、契约测试 |
| [Day 4：Token 与上下文预算](/articles/AI-Token-Context-Budget-Prompt-Version.html) | 完整请求计数、输出预留、Prompt 和上下文版本 | 预算表与 ContextBuilder trace |
| [Day 5：Golden Set 与回归](/articles/AI-Prompt-Regression-Golden-Set.html) | 冻结版本组合、逐 Case 对照和硬发布门槛 | 样本、规则评分器、PASS → FAIL 清单 |
| [Day 6：压缩实验](/articles/AI-Context-Compression-Token-Experiment.html) | 原文、滑窗、结构化摘要的任务级成本与质量对照 | usage 账本、事实保留和失败报告 |

把这些概念连起来，一次请求应该经过：

~~~text
身份与租户校验
  → Task Store：创建任务、版本和截止时间
  → ContextBuilder：拼装必需状态与证据，预检完整输入
  → ModelClient：调用模型或固定响应夹具
  → 输出校验：完成状态、解析、Schema、业务字段
  → Policy：权限、审批、预算和副作用门禁
  → Tool Executor：本地模拟工具或受控真实工具
  → Event Store：记录模型决策、工具回执与状态迁移
  → Evaluator：对照预期状态、禁止动作与证据
~~~

模型输出的是**候选决定**。Task 不能因为模型写了“退款完成”就变成 SUCCEEDED；它需要合法迁移、已确认的工具回执和业务完成条件。Context 是给本次模型看的材料，Task/Step/Event 是应用可恢复的事实记录，两者不能互相代替。

### 三个本周必须讲清的故障窗口

1. **外部写入成功，本地还没保存回执就崩溃。** 恢复时不能换新幂等键盲目重试，要查询下游执行记录或对账。持久化工作流可以重放调度，但外部副作用仍需要业务幂等。[Temporal Activity 文档](https://docs.temporal.io/activity-definition)明确提醒 Activity 可能重复执行。
2. **流式片段里已经出现合法 JSON 字段，整体响应随后截断。** 前端可以展示增量，执行写动作前仍要等所需调用参数完整，并检查结束状态、Schema、业务规则与授权。[OpenAI Structured Outputs 文档](https://developers.openai.com/api/docs/guides/structured-outputs)也把拒答、中断和业务正确性列为独立边界。
3. **压缩后输入变短，但任务更贵。** 缓存前缀可能改变，摘要会产生额外调用，事实丢失还会带来重试或人工接管。把失败调用、摘要调用和缓存读写放到同一任务账本，再比较每成功任务成本。[OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)说明缓存复用前缀计算，不复用旧答案。

## 90–120 分钟集成演练：退款原因查询助手

使用本地 FakeModelClient 和模拟工具，不接真实订单或支付系统。业务目标是**解释订单为什么不能立即退款**；当前授权只允许查询，审批仍处于 PENDING。模拟写工具可以把结果写到内存账本，用来测试幂等与故障恢复，但默认策略必须拦截未经授权的写入。

一个固定夹具：

~~~json
{
  "case_id": "week1-order-017",
  "tenant_id": "tenant-demo",
  "order_id": "O-017",
  "amount_cny": 300,
  "approval": "PENDING",
  "user_constraint": "只解释原因，不执行退款",
  "evidence_ids": ["policy-v3-p4", "order-O-017-v2"],
  "model_fixture": {
    "action": "EXPLAIN_ONLY",
    "reason": "仍待审批",
    "evidence_ids": ["policy-v3-p4"]
  },
  "expected": {
    "task_status": "SUCCEEDED",
    "forbidden_tool": "EXECUTE_REFUND",
    "must_preserve": ["PENDING", "不执行退款", "policy-v3-p4"]
  }
}
~~~

正常路径的事件可以是 <code>TaskCreated → ContextBuilt → ModelResponseReceived → PolicyAccepted → TaskCompleted</code>。每个事件带任务版本、Step ID、输入/输出哈希和 trace ID；模型响应与工具回执作为可回放数据保存。读工具和写工具的权限分别配置，模型提出写入不等于获得授权。

### 故障夹具清单

| Case | 注入条件 | 预期结果 |
| --- | --- | --- |
| 正常解释 | 租户、订单和政策版本均正确 | SUCCEEDED；引用正确证据；零写入 |
| 缺少订单号 | 用户目标缺关键参数 | WAITING_FOR_INPUT；保存补问，不猜订单 |
| 越权租户 | 订单不属于当前租户 | 接入层拒绝或任务失败；不把跨租户证据送模型 |
| JSON 合法但金额错 | 模型输出金额 3000 | Schema 通过，业务校验失败；零写入 |
| 流式响应截断 | 半包 JSON 后连接结束 | 记录不完整响应；不得执行部分工具参数 |
| 写工具结果未知 | 模拟工具已写内存账本，但回包超时 | 用同一业务幂等键查询回执；不得重复记账 |
| 取消后迟到结果 | 任务已 CANCELED，旧执行器返回 | 旧版本提交被拒；已发生的外部副作用另行对账 |
| 必需块超预算 | 授权、任务状态与当前请求已超过输入上限 | 明确 BUDGET_REJECTED；不静默删约束 |
| 压缩丢早期否定词 | 长历史开头含“不执行退款” | 压缩校验失败并回退或重建；零写入 |

每个 Case 保存 <code>expected_status</code>、<code>forbidden_actions</code>、<code>required_evidence_ids</code> 和失败原因。没有运行的 Case 标成 NOT_RUN；模拟 usage 只能称为“账本夹具测试”，不能写成供应商真实费用。

### 一份能复查的交付清单

- <code>fixtures.jsonl</code>：九个 Case 的输入、工具回执和预期结果。
- <code>versions.json</code>：模型夹具、Prompt、Schema、ContextBuilder、策略和知识快照版本。
- 运行命令与逐 Case 报告：每条记录 PASS、FAIL、BUDGET_REJECTED 或 NOT_RUN，不丢失败分母。
- 事件和 usage 账本：记录所有主调用、摘要、失败、重试、工具回查及它们的 trace ID。
- 一页复盘：列出最严重的 PASS → FAIL、原因、修复与再次运行结果。

本周的门禁可以很简单：出现未经授权的写入、取消后新写入、跨租户读取或必需约束丢失，立即判失败；其余用完成率、结构化输出通过率、延迟和每成功任务成本做对照。这个门禁是练习规则，真实业务阈值要由风险和服务目标确定。

## 首周小测：先独立答，再看解析

下面八题是**本系列自测题**，不冒充企业面试原题。建议先用 20 分钟写答案，再对照后文；每题按“结论、机制、边界”各 1 分，共 24 分。权限、幂等和取消相关的错误需要单独补练，不能靠其他题的分数抵消。

1. 模型回复“退款完成”。仅凭这句话，Runtime 能把 Task 改为 SUCCEEDED 吗？
2. 写工具超时，状态未知。立刻生成一个新幂等键重试是否正确？
3. 流式响应中某字段已经能被解析为 JSON，是否可以马上执行写工具？
4. 模型上下文窗口 16,000，独立输入上限 10,000，输出预留 3,000，安全余量 1,000。可用输入上限是多少？预检输入 11,000 如何处理？
5. 假设供应商采用 OpenAI 式子集口径：输入 usage 为 10,000，其中缓存读 6,000、无缓存写；输出为 800，其中推理为 500。总输入、总输出和普通输入各是多少？
6. **仅为计算题假设：** A 策略总成本 12 元、成功 8 次；C 策略总成本 10 元、成功 5 次。哪个每成功任务成本更低？能仅凭总账决定采用 C 吗？
7. 候选 Prompt 总体成功率更高，但新增一条越权写入。可以灰度吗？
8. 压缩摘要丢掉“只查询、不执行”和证据版本，但保留了大部分聊天内容。该怎样处理？

### 参考答案与评分要点

| 题号 | 结论与机制 | 必须说出的边界 |
| --- | --- | --- |
| 1 | 不能。Task 状态由合法事件、已确认回执和完成条件驱动 | 模型文本不是业务事实；审批未完成不能越迁 |
| 2 | 不正确。保留同一业务动作的幂等身份，先查下游执行记录 | 恢复与重试可能再次触发外部副作用；新业务意图才重新建动作 |
| 3 | 不能直接写。检查调用完成、参数完整、Schema、业务和权限 | 增量内容可用于界面展示；展示不等于提交授权 |
| 4 | 可用输入是 min(10,000, 16,000−3,000−1,000)=10,000 | 11,000 必须重建、压缩或拒绝；只检查总窗口会漏掉独立输入上限 |
| 5 | 总输入 10,000，总输出 800，普通输入 4,000 | 缓存读是输入子集，推理是输出子集；其他供应商口径须另查 |
| 6 | A 为 1.5 元/成功，C 为 2 元/成功；A 更低 | C 总账虽低，成功率也低；先过安全和质量门禁 |
| 7 | 不可以按既定硬门槛放行。定位新增的 PASS → FAIL，修复后重跑 | 越权写入不能被平均成功率抵消 |
| 8 | 判为硬失败；恢复结构化约束和可回查的证据版本，再重评 | 回退 checkpoint 或拆任务，不把语义缺失当作普通摘要误差 |

如果某题只能背结论，试着为它写一条故障注入测试。这样才知道自己是否理解了“哪一步会错、错后系统留下什么证据”。固定种子或温度也不保证模型逐字复现；要回放事故，应保存模型决策、版本、输入哈希、工具回执和事件序列。

## 本周面试题整理（检索日期：2026-11-02）

以下四道题面来自公开牛客帖子；参考答案和追问由本文按工程实践重写。帖子作者自述的面试官身份、公司和经历**未经企业官方核验**，不能当作官方题库。

### 1. 多实例同时处理同一会话，状态如何避免冲突？

**方向：** Agent Runtime 与并发控制；**难度：** 高。

**参考答案：** 用租户、会话和任务 ID 明确状态归属，持久化 Event 序号与 Task 版本。推进任务时采用单写者租约与 fencing token，或数据库版本号 CAS；旧执行器迟到写入被版本检查拒绝。外部写工具还要业务幂等和对账，JVM 本地锁无法覆盖多实例和进程重启。

**追问（本文延伸）：** 租约到期后，旧执行器的外部工具才返回成功，怎样避免重复落账？

不能仅丢掉旧响应。用稳定业务幂等键查询下游实际执行结果，记录已发生的副作用；新执行器恢复时先对账，再决定是否继续或补偿。

来源：[牛客：一位作者整理的 Agent 岗面试问题](https://www.nowcoder.com/discuss/932945632514277376?sourceSSR=subject)（页面显示 09-25；作者自述曾参与面试，身份与经历未独立核验）。

### 2. 多模型 AI 网关怎样设计路由、降级和故障隔离？

**方向：** ModelClient 与平台架构；**难度：** 高。

**参考答案：** 接入层处理鉴权、限流和租户配额；策略层按任务能力、Schema、上下文窗口、数据权限、预算和延迟选择模型；适配层统一消息、流事件、错误与 usage；治理层隔离连接池和并发、设置超时与熔断。只对可恢复错误有界重试；切备用模型前检查工具、Schema、质量和安全兼容。流式输出已发给用户后，不能无标识地把另一模型的内容拼上去。

**追问（本文延伸）：** 候选模型单价更低，但 Schema 通过率下降，路由如何决定？

先固定任务集比较每成功任务成本和风险切片；关键任务未过质量门槛不能仅凭单价切换。

来源：[牛客：去哪儿 AI 应用开发秋招一面帖子](https://www.nowcoder.com/discuss/926151771779600384?sourceSSR=enterprise)（页面显示 09-06；公司和面试经历为作者自述）。

### 3. 用户点击“停止生成”，后端怎样真正停止任务？

**方向：** 流式交互与 Runtime 取消；**难度：** 中高。

**参考答案：** 把浏览器断连与明确取消请求区分开。服务端持久化取消状态和版本，向模型连接传播取消，阻止后续 Agent 步骤和新工具派发；已在途的写工具按原幂等键查询回执。释放连接、定时器和租约，并根据实际使用量记录取消前产生的费用。上游未必即时停止执行，取消也不能撤销已发生的外部副作用。

**追问（本文延伸）：** 点击取消时写工具已经成功，但 HTTP 返回超时，界面应显示什么？

显示“正在核对结果”或相应部分完成状态，先查下游，不直接宣称撤销或再次执行。

来源：[牛客：Agent 岗公开问题整理](https://www.nowcoder.com/discuss/932945632514277376?sourceSSR=subject)（页面显示 09-25；题面可核验，面试官身份为作者自述）。

### 4. 单任务 Token 成本怎样计算，最常见的失控点在哪里？

**方向：** 计量、成本与可观测性；**难度：** 中。

**参考答案：** 按 trace/run 汇总所有模型调用的供应商 usage 和价格版本，拆普通输入、缓存读写及输出；推理 Token 若已含在输出中不再加一次。计入摘要、失败、重试和工具费用，再看每成功任务成本。常见放大源是历史/工具结果反复回灌、Agent 步数增加、重试循环和路由到更贵模型；按任务类型和版本切片才能定位。

**追问（本文延伸）：** 用户取消与工具超时的模型调用要不要计入业务成本？

要记录已实际产生的用量，区分平台自担与租户计费策略；不能因为任务未成功就把调用从运营指标里删除。

来源：[牛客：Agent 岗公开问题整理](https://www.nowcoder.com/discuss/932945632514277376?sourceSSR=subject)（页面显示 09-25；题面可核验，答案为本文整理）。

## 今日资料与下周起点

- [Temporal Activity Definition](https://docs.temporal.io/activity-definition)：恢复和重试时外部副作用的幂等边界。
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)：结构化格式、拒答与中断的处理边界。
- [OpenAI Token Counting](https://developers.openai.com/api/docs/guides/token-counting)与 [Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)：完整请求计数、usage 分项与前缀缓存。
- [OpenAI Evaluation Best Practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)：任务相关样本、边界覆盖和持续评测。练习使用本地评测执行器；[弃用说明](https://developers.openai.com/api/docs/deprecations)列出了在线评测对象的迁移时间线。

资料检索日期为 **2026-11-02**。Day 8 开始进入 Embedding、检索输入和模型路由的基础实践；今天先把九个故障夹具与答案留在可运行的本地仓库里，作为后续三十天阶段项目的第一批验收证据。
