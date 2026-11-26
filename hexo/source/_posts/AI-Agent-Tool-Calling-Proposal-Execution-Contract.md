---
layout: post
title: "Tool Calling 第一课：模型提议如何变成受控工具调用"
date: 2026-11-26 09:00:00.000
updated: 2026-11-26 09:00:00.000
permalink: /articles/AI-Agent-Tool-Calling-Proposal-Execution-Contract.html
comments: true
description: "AI 全栈开发第 31 天：用只读政策查询说明 Tool Calling 的完整往返、OpenAI 与 Anthropic 协议差异、Java 工具契约、参数校验和结果回填，附面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "Agent"
  - "Tool Calling"
  - "工具契约"
  - "Java"
  - "面试"
---

进入第二个月，我们要把第一个月的 `ModelClient` 接到**受控工具**上。最容易写错的地方是把模型返回的“我要调用某个函数”当成函数已经执行。对于自定义工具，模型只产生候选调用；应用收集参数、校验、授权、执行，并将结果用原调用 ID 交还模型。这个往返才是 Tool Calling 的最小闭环。

本文只做一个只读工具 `lookup_policy_v1`，聚焦协议和执行边界。已有的[工具安全总览](/articles/Agent-Tool-Calling-Security.html)覆盖权限、审批与审计原则；今天把这些原则落成可实现的调用记录和失败路径。第 30 天的模型网关项目仍需独立实现与验收，本文不把工具示例说成它已交付。
<!--more-->

## 一、工具调用至少有五个不同的事实

~~~text
用户提问
  → 应用把可见工具定义交给模型
  → 模型返回 ToolProposal：名称、调用 ID、参数
  → 应用验证并执行 ToolInvocation
  → 应用把 ToolResult 与原调用 ID 回传模型
  → 模型继续回答，应用校验最终引用与终态
~~~

| 对象 | 谁产生 | 能证明什么 | 不能证明什么 |
| --- | --- | --- | --- |
| `ToolSpec` | 应用 | 当前允许模型看见的名称、描述和参数形状 | 用户有权执行 |
| `ToolProposal` | 模型 | 模型建议了什么参数 | 参数真实、合规、完整 |
| `PolicyDecision` | 服务端 | 当时身份、资源和任务状态是否允许 | 下游已执行成功 |
| `ToolInvocation` | 执行器 | 实际向哪个工具发出请求及本地执行 ID | 结果已被模型正确理解 |
| `ToolResult` | 工具/执行器 | 执行回执或明确错误 | 最终答案一定正确 |

OpenAI 自定义函数调用的流程是：暴露工具，模型产生 `function_call`，应用执行后发送同一 `call_id` 的 `function_call_output`，再让模型继续；一次模型响应可能含多个调用。Anthropic 的对应结构是带 `id`、`name`、`input` 的 `tool_use` 内容块，后续 `tool_result` 用 `tool_use_id` 配对，失败可设 `is_error: true`。**`call_id` / `tool_use_id` 是供应商会话内的配对 ID，本地审计和幂等另用 `execution_id`。**[OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)、[Anthropic Tool Calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)（检索日期：2026-11-26）

## 二、定义第一个工具：只读、窄参数、服务端注入身份

假设用户问“请解释差旅政策 `policy-a-v4` 的住宿上限”。模型可以提出读取某个文档，但不能提供租户身份或任意 SQL。模型可见的定义可以是：

~~~json
{
  "type": "function",
  "name": "lookup_policy_v1",
  "description": "按文档 ID 读取调用者有权查看的差旅政策摘要；只读，不修改政策",
  "parameters": {
    "type": "object",
    "properties": {
      "document_id": {"type": "string"}
    },
    "required": ["document_id"],
    "additionalProperties": false
  },
  "strict": true
}
~~~

这是 **OpenAI 风格的函数定义示意**；Anthropic 的工具定义使用 `input_schema`，而不是把这段 JSON 原样发给所有供应商。[Anthropic Define Tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)（检索日期：2026-11-26）。`strict: true` 可以约束模型参数匹配受支持的 Schema；OpenAI 对严格模式要求对象设置 `additionalProperties: false`，所有属性放入 `required`，可选值可用包含 `null` 的类型表达。即便格式合规，服务端仍要重新校验长度、资源归属和当前权限。[OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)（检索日期：2026-11-26）

内部工具注册表还应保存**不暴露给模型**的元数据：工具版本、只读/写入等级、所需权限、超时、输出 Schema、最大返回字节数和审计策略。Java 后端可以用三个记录表达边界：

~~~java
record ToolSpec(String name, int version, String inputSchemaId,
                String outputSchemaId, String permission, boolean readOnly) {}
record ToolProposal(String providerCallId, String name, String rawArguments) {}
record ToolResult(String executionId, String providerCallId,
                  String status, String outputOrError) {}
~~~

这只是**契约示例**，不是已运行的 Spring Bean。`providerCallId` 用于把结果交回模型；服务端生成的 `executionId` 用于追踪真实调用。不要把模型参数里的 `tenant_id`、`user_id`、`approved` 当权威值，甚至不应在这个工具的 Schema 中暴露它们。租户和主体从已验证的请求上下文取得，工具服务还要按 `document_id` 做资源级授权。[OWASP LLM03:2026 Excessive Agency](https://genai.owasp.org/llm2026/llm032026-excessive-agency/)（检索日期：2026-11-26）

## 三、执行器必须在完整参数后才跨越边界

流式模型可能逐段输出工具参数。OpenAI 有参数增量与完成事件；Claude 的工具输入也可能以 JSON 片段到达。收到 `{"document_id":"policy-` 时，**不能抢先发出查询**。只有整个调用完成，才能解析、校验并分配执行 ID。[OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)、[Anthropic Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)（检索日期：2026-11-26）

~~~text
execute(proposal, authenticatedContext, taskSnapshot):
  assert proposal 完整且属于当前模型回合
  spec = registry.lookup(proposal.name, taskSnapshot.toolVersion)
  reject if spec 不在当前任务的允许列表
  args = parseAndValidate(proposal.rawArguments, spec.inputSchema)
  tenant = authenticatedContext.tenantId       # 绝不取自 args
  authorize(tenant, authenticatedContext.actorId, args.document_id)
  assert task 未取消、未超时，工具次数与成本仍在预算内
  executionId = persistProposalAndPolicyDecision(...)
  result = callWithTimeout(spec, tenant, args, executionId)
  validateAndRedact(result, spec.outputSchema, spec.maxOutputBytes)
  persistResultAndUsage(...)
  return mapToProviderResult(proposal.providerCallId, result)
~~~

一次模型响应若有多个工具提议，要为每个调用分别保留 ID、结果和错误；只读且互不依赖的调用可以有界并行，不能把“模型同时提出”解释为“任何写操作都可同时执行”。未知工具名、参数不完整、Schema 不符或权限拒绝时，执行次数应为 **0**；返回给模型的是受控错误码，不泄露另一个租户的文档是否存在。

工具结果同样是不可信输入。它可以包含用户写的政策文本，甚至“忽略之前的规则”之类恶意句子；回填模型时作为工具数据，不升级为系统指令。最终回答中的引用 ID 还要由服务端核对，不能因为模型看过工具结果就跳过授权。[OWASP LLM03:2026 Excessive Agency](https://genai.owasp.org/llm2026/llm032026-excessive-agency/)（检索日期：2026-11-26）

## 四、把结果和错误都接回模型

一个成功的内部结果可以只包含受控字段：

~~~json
{
  "execution_id": "exec-17",
  "status": "OK",
  "document": {
    "id": "policy-a-v4",
    "version": 4,
    "summary": "住宿上限按城市等级区分，具体金额见授权原文"
  }
}
~~~

执行器将这份结果按供应商协议回传：OpenAI 使用原 `call_id` 的 `function_call_output`；Anthropic 使用原 `tool_use_id` 的 `tool_result`。内部 `execution_id` 可以用于审计，但不替代供应商的关联 ID。失败时使用可解释的 `INVALID_ARGUMENTS`、`NOT_FOUND_OR_FORBIDDEN`、`TOOL_TIMEOUT` 等错误分类，保留真实执行记录，再决定是否允许模型修正参数。模型若反复用同样参数触发同样错误，运行时应按次数和截止时间停止循环，而不是无限“自我修复”。[OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)、[Anthropic Handle Tool Calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)（检索日期：2026-11-26）

Day 57–60 再把本地工具注册表和 MCP 接起来。MCP 的 `tools/list`、`tools/call`、`inputSchema`、可选 `outputSchema` 与错误标记提供跨进程工具协议，但输入校验、访问控制、超时和审计仍由宿主与工具服务负责；不要因为换了协议就省掉今天的执行器。[MCP Tools 规范（2026-07-28）](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)（检索日期：2026-11-26）

## 五、今天的最小实践

在独立练习工程中实现 `lookup_policy_v1` 的 FakeTool 与供应商无关的执行器；可以先只用固定模型输出夹具，不调用付费模型。保存以下五条自动断言及执行日志：

| Case | 输入 | 必须成立 |
| --- | --- | --- |
| 正常读取 | A 查询 A 的 `policy-a-v4` | 执行一次，结果带版本；最终引用仍校验 A 的权限 |
| 越权 ID | A 查询 B 的文档 | 业务工具执行 0 次或在服务端授权处拒绝；无 B 正文泄漏 |
| 半截参数 | JSON 参数流未结束 | 执行次数为 0；任务等待完整调用或进入错误分支 |
| 未知工具 | 模型提出 `execute_sql` | 注册表拒绝；不把工具名当命令解释 |
| 重复错误 | 模型连续三次提相同非法 ID | 按配置的步数/时间上限结束，不无限调用 |

每条记录保存 `task_id`、`provider_call_id`、`execution_id`、工具版本、决策原因和最终状态；敏感原文只保存在受控存储。第 32 天进一步讲 Schema 版本和工具发现，第 35 天做第五周复盘；Day 30 的网关 P0 实现仍需独立补齐。

## 六、今日面试题（检索日期：2026-11-26）

以下题面来自公开来源。公司、岗位和场次如果依赖发帖者自述，均未获企业官方核验；参考答案与追问是本文的工程归纳。

### 1. Function Calling 的完整流程是什么？在项目里怎么用？

- **方向 / 难度**：工具协议、Agent 集成 / 中高。
- **参考答案**：应用先暴露当前任务允许的工具定义；模型产出带调用 ID、工具名和参数的候选调用。应用等参数完整后按白名单和 Schema 校验，再用受信身份做资源授权，记录并执行，最后用同一供应商调用 ID 回传结果，让模型继续生成。任务最终状态以执行器和业务校验为准，不能以模型提出调用作为成功。
- **追问**：参数里的设备 ID 格式合法，但设备属于另一个租户，能执行吗？不能。Schema 只能证明形状，资源归属由服务端再次校验。
- **来源**：[牛客“阿里巴巴 AI Agent 应用开发一面”用户自述](https://www.nowcoder.com/discuss/948634862812946432?sourceSSR=post&weFlow=true)，页面显示 11-07；公司与场次未获官方核验。

### 2. 模型返回符合 Schema 的对象，与发出一次工具调用有什么区别？两者都算成功吗？

- **方向 / 难度**：结构化输出、工具执行边界 / 中高。
- **参考答案**：符合 Schema 的对象是模型生成的数据，可作为分类或草稿，但仍要验业务语义；工具调用是对某个动作的提议，必须经过执行器校验、授权和真实工具回执。两者都不自动等于任务成功；最终状态还要看工具结果、后续模型回答和业务断言。
- **追问**：模型生成 `{"status":"paid"}` 且 Schema 正确，能把订单改成已支付吗？不能；支付状态来自受控业务系统的可信回执，模型文本不能提交状态。
- **来源**：[牛客“vivo Agent 开发工程师一面题解”用户发布内容](https://www.nowcoder.com/discuss/953318284886122496?sourceSSR=home)，页面显示 11-20；题解不是可证明的逐字面试实录，公司与场次未获官方核验。

### 3. `search_events` 和 `find_free_time` 经常选错，怎样改、怎样验证？

- **方向 / 难度**：工具选择、离线评测 / 中高。
- **参考答案**：把两个工具的适用目标、禁用条件、参数和返回值写成互斥且可检验的描述；提供相近问题的成对反例，如“查我明天的会议”与“找明天空档”。固定模型和工具版本后评测首步工具选择率与最终任务完成率，并检查误选的代价，不能只凭一次 Demo 判断描述改善。
- **追问**：首步选择准确率提高，但最终日程草稿错误更多，怎么办？沿 Trace 查参数提取、工具结果解释和最终草稿校验，分别加样本；整体任务成功率是发布门槛。
- **来源**：[牛客“vivo Agent 开发工程师一面题解”用户发布内容](https://www.nowcoder.com/discuss/953318284886122496?sourceSSR=home)，页面显示 11-20；题解与公司归属未获官方核验。

### 4. 普通 Tool Calling 和接口也能校验参数，领域对象约束还解决什么？

- **方向 / 难度**：工具契约、业务不变量 / 难。
- **参考答案**：Schema 验字段和局部类型；接口校验可以验证即时规则。跨对象关系、版本适用性和合法状态迁移需要领域模型或明确的业务规则表达，例如“只有当前审批版本可以提交”。不论是否采用本体化建模，工具端都必须用最新业务事实和受信身份做授权，模型输出的合格参数不能绕过执行前检查。
- **追问**：模型参数合法，但订单状态在模型思考期间已改变，还能执行写工具吗？不能按旧快照盲写；执行前重读状态并做版本条件更新，冲突时要求重新确认。
- **来源**：[牛客“淘天 AI Agent / 大模型应用研发一面”用户自述](https://www.nowcoder.com/feed/main/detail/6d45897f57b0484eb9863bc991993866?sourceSSR=enterprise)，页面显示 11-12；公司与场次未获官方核验。

## 资料

- [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)：自定义函数调用、参数流与结果回传。
- [Anthropic Define Tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)与[Handle Tool Calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)：工具定义、调用 ID 和失败结果。
- [MCP Tools 规范（2026-07-28）](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)：跨进程工具协议与服务端责任。
- [OWASP LLM03:2026 Excessive Agency](https://genai.owasp.org/llm2026/llm032026-excessive-agency/)：最小权限和独立授权。以上资料检索日期均为 2026-11-26。
