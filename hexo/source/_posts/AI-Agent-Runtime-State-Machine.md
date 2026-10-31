---
layout: post
title: "Agent Runtime 怎么设计：状态机、可恢复执行与幂等"
date: 2026-10-28 09:10:00.000
updated: 2026-10-28 09:10:00.000
permalink: /articles/AI-Agent-Runtime-State-Machine.html
comments: true
description: "把 Agent 的长任务拆成可持久化的状态、步骤和事件，让服务重启、工具超时和重复执行都能被安全处理。"
categories:
  - "AI工程"
tags:
  - "Agent"
  - "AI全栈"
  - "状态机"
  - "可靠性"
  - "工程实践"
---

昨天先把企业级 Agent 的目标拆成了任务、步骤、证据和 trace。今天继续往下实现运行时。很多 Agent Demo 的主循环只有几行：调用模型、执行工具、把结果放回上下文，直到模型说任务完成。

这段循环可以证明模型会调用工具，却不能证明系统能处理一个运行二十分钟的真实任务。服务重启怎么办，工具超时但实际已经成功怎么办，用户取消后迟到的结果写到哪里，两个执行器同时推进同一个任务怎么办？这些问题都属于 Agent Runtime，而不是 Prompt 的细节。
<!--more-->

## Runtime 负责把不确定性装进边界

模型适合做判断：选择下一步、提取参数、解释工具结果。Runtime 负责确定性工作：保存状态、校验动作、控制循环、处理超时和重试、记录事件、恢复任务。

可以把一次任务看成下面这条链路：

```text
用户请求
  -> Task Store：创建任务与版本
  -> Context Builder：组装当前上下文
  -> Model Gateway：生成结构化决策
  -> Policy：检查工具、权限和预算
  -> Executor：执行工具或等待输入
  -> Event Store：记录结果与状态迁移
  -> 下一步 / 完成 / 失败 / 转人工
```

这不是要求一开始就部署七个服务。早期可以在一个应用里实现这些模块，但它们应该有独立的接口和测试。将来模型网关、队列、策略服务或工具执行器拆出去时，任务状态不需要跟着重写。

## 先定义状态，再写 Agent Loop

状态机的价值是把“做到哪一步”从对话历史中拿出来。一个最小任务状态可以是：

```text
CREATED
  -> RUNNING
  -> WAITING_FOR_INPUT
  -> WAITING_FOR_APPROVAL
  -> SUCCEEDED
  -> FAILED
  -> CANCELED
```

状态迁移必须有明确的前置条件。比如 `WAITING_FOR_APPROVAL` 只能由审批结果迁移到 `RUNNING`，不能让模型返回一个 `final=true` 就直接变成 `SUCCEEDED`；`CANCELED` 之后不允许再执行新的写入步骤。

可以把迁移规则写成一张表：

| 当前状态 | 事件 | 下一个状态 | 允许的副作用 |
| --- | --- | --- | --- |
| `CREATED` | `task_started` | `RUNNING` | 创建执行版本 |
| `RUNNING` | `need_input` | `WAITING_FOR_INPUT` | 保存问题，不调用写工具 |
| `RUNNING` | `need_approval` | `WAITING_FOR_APPROVAL` | 保存预览和审批摘要 |
| `RUNNING` | `step_succeeded` | `RUNNING` 或 `SUCCEEDED` | 写入步骤结果 |
| `RUNNING` | `retryable_error` | `RUNNING` | 增加重试计数 |
| `RUNNING` | `fatal_error` | `FAILED` | 保存失败原因 |
| 任意可取消状态 | `task_canceled` | `CANCELED` | 发送取消信号，不接受迟到写入 |

状态机只接受列举过的事件，未知事件直接拒绝。这样可以在代码审查和测试中检查边界，也能避免模型输出一句自然语言把任务跳过审批。

## Task、Step 和 Event 要分开保存

`Task` 表示用户要完成的目标，`Step` 表示执行计划中的一个节点，`Event` 表示发生过的事实。不要只保存一份不断覆盖的 JSON，因为恢复和排查都需要知道状态是怎样变化的。

一个简化的数据模型如下：

```sql
create table agent_task (
  task_id        varchar(64) primary key,
  tenant_id      varchar(64) not null,
  requester_id   varchar(64) not null,
  status         varchar(32) not null,
  version        bigint not null,
  max_steps      int not null,
  deadline_at    timestamp not null,
  created_at     timestamp not null,
  updated_at     timestamp not null
);

create table agent_step (
  task_id        varchar(64) not null,
  step_id        varchar(64) not null,
  step_no        int not null,
  status         varchar(32) not null,
  tool_name      varchar(128),
  idempotency_key varchar(128),
  attempt        int not null,
  input_json     json,
  output_json    json,
  primary key (task_id, step_id)
);

create table agent_event (
  event_id       bigint primary key,
  task_id        varchar(64) not null,
  task_version   bigint not null,
  event_type     varchar(64) not null,
  payload_json   json not null,
  created_at     timestamp not null
);
```

`agent_task.version` 用于乐观并发控制。执行器读取版本 7 后准备推进任务，提交时要求数据库仍然是版本 7；如果另一个执行器已经推进到版本 8，当前提交失败并重新读取状态。这样不需要先把整个任务锁很久。

事件表保存的是“发生过什么”，步骤表保存的是“当前看到的结果”。两者一起使用，既能快速读取当前状态，又能按事件顺序重建一次任务。

## Agent Loop 不等于无边界循环

一个可控的 Loop 至少要有四类停止条件：

1. 正常完成：最终结果通过 schema 和业务校验。
2. 预算耗尽：达到最大步数、token、工具次数或总时长。
3. 无进展：连续多次生成相同动作、相同参数或状态没有变化。
4. 异常终止：权限失败、任务取消、不可恢复错误或策略拒绝。

伪代码可以写成下面这样：

```text
while task.status == RUNNING:
    assert within_deadline(task)
    context = context_builder.build(task, last_confirmed_step)
    decision = model.plan(context, allowed_tools)

    if !schema_valid(decision):
        record(event = INVALID_DECISION)
        retry_or_fail(task)
        continue

    if decision.type == FINAL:
        if result_validator.accept(decision.result):
            commit(SUCCEEDED, decision.result)
        else:
            feedback_and_retry_or_fail()
        continue

    if decision.type == ASK_USER:
        commit(WAITING_FOR_INPUT, decision.question)
        continue

    policy.check(decision.tool, decision.args, task.identity)
    result = executor.run(
        tool=decision.tool,
        args=decision.args,
        idempotency_key=server_generated_key(task, decision)
    )
    commit_step_result(result)
```

这里最关键的一点是：模型只能产生候选决策，不能直接提交状态。`commit` 需要再次检查任务版本、策略结果和可写状态。

## 重试必须和幂等一起设计

工具超时有一个危险情况：请求可能已经在下游成功，只是响应没有返回。如果执行器直接生成新请求重试，就可能重复扣款、重复发消息或重复创建资源。

幂等键应由服务端根据稳定输入生成，例如：

```text
idempotency_key = hash(
  task_id + step_id + tool_name + canonical_json(args)
)
```

模型不能自己生成这个键。模型每次重试时都可能改变输出，导致同一个业务动作得到不同 key。工具服务收到 key 后，先查询执行记录：如果已经成功，直接返回原结果；如果正在执行，返回处理中；如果上次明确失败且允许重试，再根据策略执行。

重试也要分层：

| 层级 | 例子 | 处理方式 |
| --- | --- | --- |
| 瞬时网络错误 | 连接重置、网关 503 | 指数退避，限制次数 |
| 工具业务错误 | 参数非法、资源不存在 | 返回结构化错误，让模型修正或补问 |
| 权限错误 | 没有资源 scope、审批过期 | 直接停止或申请授权 |
| 不确定结果 | 超时但下游状态未知 | 查询状态或人工对账，不能盲目重放 |
| 不可逆失败 | 外部发送已发生但回执丢失 | 依靠幂等查询和补偿流程 |

读操作通常可以安全重试，写操作必须有幂等或补偿。把所有错误都交给模型“再试一次”，会把网络问题扩大成业务事故。

## 取消、超时和服务重启

取消不是把前端按钮变成灰色，而是一次有版本的状态迁移。用户点击取消时，服务端应把任务从可取消状态改为 `CANCELED`，给正在运行的执行器发送取消信号，并让后续提交携带旧版本的执行器失败。

工具调用本身可能无法立即中断，因此还要在写入边界做第二次检查：

```text
执行器准备提交工具结果
  -> 读取 task.status 与 task.version
  -> 若已 CANCELED 或版本不匹配，丢弃迟到结果
  -> 若仍可写，使用幂等键提交业务结果
```

总超时和单工具超时要分开。单工具超时只能结束当前调用，总任务超时则应让任务进入 `FAILED` 或 `WAITING_FOR_HUMAN`，并保存已经完成的步骤。用户再次恢复时，从最后一个确认步骤继续，而不是从头让模型重复所有副作用。

如果进程重启，恢复任务的过程也应该由数据库状态驱动：扫描 `RUNNING` 且心跳过期的任务，将执行租约标记为失效；读取最后一个已确认的 Step，重新构建上下文；对处于不确定结果的工具先调用查询接口；确认没有重复副作用后再继续 Loop。

长任务也可以交给专门的持久化工作流引擎。比如 [Temporal Workflow](https://docs.temporal.io/workflows) 用事件历史重放工作流状态，并把外部 API、数据库、文件和模型调用放进 Activity；这类设计的核心思想与我们自己实现的 Task/Step/Event 一致。是否引入框架，要看任务时长、并发、恢复要求和团队运维能力。

## Context、State 和 Memory 不是一回事

面试时经常把这三个概念混在一起，生产系统必须分开：

| 概念 | 内容 | 生命周期 | 主要用途 |
| --- | --- | --- | --- |
| State | 任务状态、步骤状态、预算、审批状态 | 任务级，必须持久化 | 恢复和并发控制 |
| Context | 当前送入模型窗口的消息和证据 | 单次模型调用 | 帮模型决定下一步 |
| Memory | 可跨任务使用的偏好、事实和产物索引 | 用户/项目级 | 提供长期背景 |

状态不能只存在 context 里；memory 也不能直接覆盖当前任务状态。上下文压缩时，可以丢掉重复日志和寒暄，但用户目标、权限、数字、时间、否定关系、未完成步骤和工具结果引用必须结构化保留。

一个实用做法是“原文可回查，摘要可重建”：摘要表保存关键事实和来源 event_id，模型需要细节时再按引用读取原始消息或工具结果。这样压缩出现偏差时，可以回退到上一个摘要版本。

## 近期面试题整理（检索日期：2026-10-28）

以下题目来自近期公开面经，页面标注的原始来源主要是牛客网；聚合页面可能经过整理，不能当作官方题库。准备时要按自己的项目经历重新组织答案。

### 1. 除了步数上限，怎样防止 Agent Loop 死循环？

**方向：** Agent Runtime；**难度：** 中高。

除了最大步数，还要检测“无进展”：对工具名和规范化参数做哈希，发现连续重复调用就中止；维护待办、已完成、已验证状态，连续多轮没有状态变化就触发重新规划或转人工；同时限制 token、总时长和单工具调用次数。最终完成条件也要由外部校验器判断，例如测试通过、文件生成或数据库状态成立，不能只看模型说“完成”。

**追问：** 如果模型一直换不同参数但任务仍然没有推进呢？

把进展定义为可观测的业务状态变化，而不是动作是否不同；如果状态没有变化，仍然应触发无进展策略。

来源：[字节业务中台 AI 全栈实习一面](https://mj.mianlingai.com/interview/bytedance-ai-fullstack-first-round-2925092/)（页面标注时间 2026-10、来源为牛客网）。

### 2. 工具调用超时后如何重试，怎样避免重复操作？

**方向：** 工具调用与可靠性；**难度：** 中高。

先区分工具是否幂等。读操作可以按错误类型退避重试；写操作必须携带服务端生成的幂等键。超时但结果未知时，先查询下游执行状态，再决定重试；工具服务保存 key 与结果，重复请求直接返回原结果。参数校验失败、权限失败和业务不存在都不应按网络错误重试。

**追问：** 为什么不能让模型生成幂等 key？

因为模型重试时可能生成不同字符串，幂等性会被破坏。key 应由 `task_id + step_id + tool + canonical_args` 等稳定字段确定性派生。

来源：[字节一面 Agent 岗：ReAct、幂等与上下文压缩](https://mj.mianlingai.com/interview/bytedance-agent-first-round-931893943342465024/)（页面标注时间 2026-09、来源为牛客网）。

### 3. 什么是 Agent Harness？它与模型的职责如何划分？

**方向：** Agent 架构；**难度：** 中高。

Harness 可以理解为包住模型的运行时控制层：它负责上下文预算、工具 schema、状态和循环控制、权限、重试、结果验证与可观测。模型负责在当前上下文中提出判断和动作。判断 Harness 是否可靠，要看工具失败、上下文超限、用户取消和权限变化时，系统能否继续安全运行。

**追问：** 如果把 Harness 的规则全部写进系统 Prompt，会怎样？

提示词可以帮助模型理解规则，但不能替代服务端鉴权、状态迁移、schema 校验和幂等提交。关键边界必须由执行器和业务服务再次判断。

来源：[字节跳动 AI Agent 开发一面面经](https://mj.mianlingai.com/interview/bytedance-ai-agent-first-round-933733520864706560/)（页面标注时间 2026-09、来源为牛客网）。

### 4. 上下文压缩怎样尽量减少信息损失？

**方向：** Context Engineering；**难度：** 中高。

先把不能丢的信息结构化抽取出来：用户目标、硬约束、授权、数字、时间、否定关系、未完成事项和步骤结果。近处保留原文，中期保留阶段摘要，长期记忆保存带来源和版本的事实；摘要中的关键事实应能回查原始 event。压缩后做数字、实体、否定词和权限条件的规则校验，并通过任务成功率回归验证，而不是只看摘要读起来是否通顺。

**追问：** 压缩后发现任务失败，如何回退？

保留摘要版本和原始事件指针，失败时回退到上一个摘要版本，重新从原文构建局部上下文，并把这类样本加入压缩回归集。

来源：[百度 AI Agent 开发岗面经：记忆模块与上下文压缩](https://mj.mianlingai.com/interview/baidu-ai-agent-developer-05-931706698258010112/)（页面标注时间 2026-09、面试时间为 2026-08，来源为牛客网）。

### 5. 多 Agent 或多个执行器同时修改同一资源，怎么处理？

**方向：** 分布式 Agent；**难度：** 高。

先判断资源是否可以并行。不能并行的写操作使用资源级租约或数据库锁，并通过版本号检测冲突；所有写工具带幂等键，跨多个资源的流程使用 Saga 和补偿动作。多个 Agent 之间传递关键状态时使用结构化协议，叙述性上下文可以使用自然语言；发生冲突时回到证据和业务约束，不用简单多数投票。

**追问：** 锁超时后可以直接让另一个 Agent 重试吗？

不能直接重放。要先确认原持有者是否还活跃、操作是否已经提交，以及资源版本是否变化；必要时把任务转为等待或人工处理。

来源：[字节跳动大模型 Agent 面试题](https://agentalpha.top/interview/company/bytedance)（公开面经与岗位题目归纳，检索日期 2026-10-28）。

## 今天的资料

- [OpenAI Agents 文档](https://developers.openai.com/api/docs/guides/agents)：文档目录包含会话状态、后台运行、追踪、错误恢复和 Agent SDK 的结果与状态等主题。
- [Temporal Workflow 文档](https://docs.temporal.io/workflows)：理解事件历史、工作流重放、取消、暂停和 Activity 的持久化执行方式。
- [系列 Day 1：企业级 Agent 全栈开发路线图](/articles/AI-Agent-Fullstack-180-Day-Roadmap.html)：回顾任务、步骤、证据和 trace 的最小对象模型。

## 今天的实践任务

在 `agent-platform/` 中实现一个内存版 Runtime，不接真实模型也可以。准备三个工具：一个只读查询、一个可重复写入、一个故意超时的工具；实现任务状态、步骤版本、服务端幂等键、最大步数、无进展检测和取消后的迟到结果丢弃。至少写五个测试：正常完成、校验失败后重试、写工具重复调用、任务取消、执行器并发冲突。

明天进入 Tool Calling 与工具契约：把今天 Runtime 接收的“候选动作”变成有 schema、权限、风险等级、超时和返回结构的可注册工具。
