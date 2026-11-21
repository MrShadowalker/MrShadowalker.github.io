---
layout: post
title: "最小对话服务接入多模型：适配器、事件流与用量归一化"
date: 2026-11-18 09:00:00.000
updated: 2026-11-21 20:50:00.000
permalink: /articles/AI-Chat-Service-Provider-Adapter-Event-Normalization.html
comments: true
description: "AI 全栈开发第 23 天，将最小对话服务接入模型网关：统一供应商请求、流式事件、结构化输出、错误和用量，同时保存原始证据。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "模型网关"
  - "多模型"
  - "流式输出"
  - "面试"
---

补刊说明：本文补齐原定学习日；资料与题目于 2026-11-21 检索核验。

前几天已经把最小对话服务拆成 API、会话、任务、事件和存储。今天接入真正容易变动的一层：模型供应商。对 Java 后端开发者来说，可以把它理解为“防腐层”：业务只认识自己的请求与事件，适配器负责把供应商协议翻译过来；原始响应也必须保留，便于审计和补账。
<!--more-->

## 一、先定义内部契约，再接 SDK

业务请求不应直接传供应商的 JSON。以下是一个精简内部契约，实际字段按租户政策扩展：

~~~python
@dataclass(frozen=True)
class ModelRequest:
    task_id: str
    tenant_id: str
    messages: list[dict]
    requested_capabilities: set[str]
    response_schema_version: str | None
    deadline_ms: int
    max_output_tokens: int

@dataclass(frozen=True)
class GatewayEvent:
    task_id: str
    attempt_id: str
    seq: int
    kind: str  # STARTED / TEXT_DELTA / TOOL_READY / USAGE / COMPLETED / FAILED
    payload: dict
~~~

这里沿用第 16–22 天的任务 API：一轮对话创建一个 <code>task_id</code>，它也是模型网关内部关联这轮执行的键。<code>tenant_id</code> 来自已认证的服务端上下文，不接受客户端在消息体里自报。<code>attempt_id</code> 每次实际供应商请求都不同；同一个 <code>task_id</code> 可以因重试或降级有多个 attempt。路由器先检查模型能力、数据政策、预算与截止时间，再让适配器发送请求。

对外至少拆四个接口：<code>prepare</code> 校验能力和参数；<code>invoke</code> 返回完整结果；<code>stream</code> 返回内部事件；<code>normalize_usage</code> 保存原始用量并给出厂商专用计价桶。别把供应商 JSON 整包透传到前端，因为它会把业务 UI 绑定到特定供应商字段。

## 二、流式输出是事件状态机

OpenAI Responses 流使用有类型的 SSE 事件，文本增量、完成、不完整和错误各有独立类型；Anthropic Messages 流则有 <code>message_start</code>、内容块、<code>message_delta</code> 与 <code>message_stop</code>，还可能出现 ping 和流内错误。[OpenAI 流式指南](https://developers.openai.com/api/docs/guides/streaming-responses)、[OpenAI 事件参考](https://developers.openai.com/api/reference/resources/responses/streaming-events)、[Anthropic 流式指南](https://platform.claude.com/docs/en/build-with-claude/streaming)（检索日期：2026-11-21）

适配器将这些事件映射为稳定的内部状态：

~~~text
CREATED → STREAMING → COMPLETED
                    ↘ INCOMPLETE
                    ↘ FAILED
                    ↘ CANCELLED
~~~

<code>TEXT_DELTA</code> 可以立即展示；工具参数增量只能先按调用 ID 和内容块索引累积。只有供应商明确结束该工具调用、参数完整、JSON 与工具 Schema 均通过校验，才发 <code>TOOL_READY</code> 给执行器。半截 JSON 不能启动有副作用的工具。来自牛客的 Coding Agent 讨论也专门指出这一故障模式，但该帖是个人经验，不是供应商规范。[牛客：流式工具调用](https://www.nowcoder.com/feed/main/detail/9c12e9fc0e7d4a828c699b83d59cedcb?sourceSSR=dynamic)（检索日期：2026-11-21）

流已经向用户发出文本后发生错误时，对外发 <code>FAILED</code> 并明确标为“不完整”。此时不能悄悄让备用模型续写同一条回答：不同模型的上下文、语气和工具状态可能不一致。想重新生成，应创建新的 attempt 和可见的“重新开始”事件。

## 三、结构化输出有三层校验

以“回答 + 引用”为例，内部对象可以是：

~~~json
{
  "answer": "住宿上限为每日 500 元。",
  "citations": [{"evidence_id": "policy-17", "span": "第 4 条"}],
  "status": "ANSWERED"
}
~~~

第一层是供应商支持的结构化输出能力与 Schema；第二层是服务端解析与版本校验；第三层是业务约束，如引用 ID 必须在本次授权证据集合内。OpenAI 的结构化输出文档说明 Schema 约束适用于完成且未拒绝的输出，应用仍需处理拒绝、不完整和 API 错误；Schema 本身不能验证业务事实。[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)（检索日期：2026-11-21）

因此 <code>JSON_PARSE_OK</code> 不等于 <code>ANSWER_VALID</code>。在事件流中，完整对象的业务校验应在终结事件到来后进行；前端看到的流式文本只是预览，不能提前标为成功。

## 四、用量和错误必须保留供应商语义

账本按 <code>task_id → attempt_id → provider_request_id</code> 关联。每个 attempt 保存 <code>raw_usage</code>、<code>normalized_usage</code>、<code>price_version</code>、<code>usage_status</code>。Anthropic 的 <code>message_delta.usage</code> 是累计值，不能把每个增量事件相加；OpenAI 的完成事件提供最终响应状态与用量，流中断时可能拿不到最终值。[Anthropic 流式指南](https://platform.claude.com/docs/en/build-with-claude/streaming)、[OpenAI 事件参考](https://developers.openai.com/api/reference/resources/responses/streaming-events)（检索日期：2026-11-21）

内部错误至少分为 <code>AUTH</code>、<code>CAPABILITY</code>、<code>RATE_LIMIT_TEMPORARY</code>、<code>BUDGET_EXHAUSTED</code>、<code>PROVIDER_OVERLOADED</code>、<code>TIMEOUT_UNKNOWN</code>、<code>STREAM_INTERRUPTED</code>、<code>OUTPUT_INVALID</code>。是否重试由错误体、是否已有输出、截止时间和幂等边界共同决定。一个 HTTP 429 不能代表所有供应商都只是“稍后再试”；第 12 天的限流文章已把临时限额和支出封顶分开。

### 今天动手的验收

用两个 <code>FakeProvider</code> 实现相同的内部接口：A 分三段返回文本，B 返回累计用量并在第二段后发流内错误。记录原始事件和归一化事件，断言：

1. 正常路径只出现一个终结事件，完成后才落 <code>SUCCEEDED</code>。
2. B 的累计用量只取最终已知值；缺最终值记 <code>PENDING_USAGE</code>，不伪造精确费用。
3. 半截工具参数和无权引用都不能执行或被标为成功。
4. 两家供应商的事件都能被同一个前端契约消费。

这些是练习验收标准；本文并未声称已经替读者实现生产服务。

## 五、今日面试题

当日未检索到可直接核验、与本篇适配器主题高度相关的近期大厂原题，因此选用可打开的社区经典题；不把它们标为大厂真题。以下题面来自公开牛客帖子；参考答案是本文的工程归纳。检索日期均为 **2026-11-21**。社区题库不是可核验的大厂原题；个人分享的项目背景也未经过企业确认。

### 1. 多模型路由为什么需要统一适配器？

- **方向 / 难度**：模型网关，中级。
- **参考答案**：让业务只依赖统一请求、文本、工具、结束状态、错误和用量契约；能力与地区先做准入，供应商差异留在适配器，原始事件保留以便对账与排障。
- **追问**：备用模型不支持严格 Schema 时，网关还能自动切过去吗？应拒绝这个候选或改走经过评测的明确降级产品路径。
- **来源**：[牛客《AI Agent 面试高频 100 问》中的多模型路由题](https://www.nowcoder.com/discuss/922460251717128192?sourceSSR=post)，社区整理，非企业官方题库。

### 2. 模型正在流式输出工具参数，能立刻执行工具吗？

- **方向 / 难度**：流式 Tool Calling，较难。
- **参考答案**：先按调用 ID 汇集参数分片，等待完成事件，校验 JSON、Schema、权限与幂等键，再进入执行器；文本预览与工具执行的安全门槛不同。
- **追问**：连接断在参数最后一个字节之后、完成事件之前怎么办？保持调用未确认，不执行副作用，并保存原始事件供排障。
- **来源**：[牛客 Coding Agent 讨论](https://www.nowcoder.com/feed/main/detail/9c12e9fc0e7d4a828c699b83d59cedcb?sourceSSR=dynamic)，个人技术讨论，不应写成特定公司面试实录。

### 3. Structured Output 怎么用，怎样让下游得到可解析对象？

- **方向 / 难度**：结构化输出，中级。
- **参考答案**：优先用模型原生 Schema 约束，处理拒绝和不完整状态，再做服务端类型校验和业务校验；对不支持该能力的模型设准入限制，不能只靠 Prompt 里写“请输出 JSON”。
- **追问**：引用 ID 格式符合 Schema，却指向别的租户，哪层拦截？在业务授权与证据校验层拦截。
- **来源**：[牛客《Agent 开发岗面试题——整理》](https://www.nowcoder.com/discuss/916831948192944128)，正文可直接核对 Structured Output 题面；社区整理，非可核验的企业原题。

## 资料

- [OpenAI Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses)
- [OpenAI Responses streaming events](https://developers.openai.com/api/reference/resources/responses/streaming-events)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Anthropic Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)

下一篇为这条对话链建立任务级 Golden Set、回归报告和 Trace 证据。
