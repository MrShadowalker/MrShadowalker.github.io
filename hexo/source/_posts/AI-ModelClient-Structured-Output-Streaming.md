---
layout: post
title: "统一 ModelClient 怎么设计：消息、结构化输出、流式与重试的边界"
date: 2026-10-29 09:00:00.000
updated: 2026-10-29 09:00:00.000
permalink: /articles/AI-ModelClient-Structured-Output-Streaming.html
comments: true
description: "面向 Java/后端开发者，设计一个不绑定厂商 SDK 的 ModelClient，统一消息、结构化输出、流式事件、超时重试和模型路由。"
categories:
  - "AI工程"
tags:
  - "模型工程"
  - "AI全栈"
  - "结构化输出"
  - "流式响应"
  - "模型网关"
  - "工程实践"
---

昨天我们把 Agent Runtime 的任务、步骤、事件和状态迁移固定下来。Runtime 要继续向前走，就必须有一个稳定的模型调用边界。否则业务代码会到处出现 `if (provider == ...)`：某家模型用 `messages`，另一家模型用 `input`；某家返回 `choices`，另一家返回事件流；结构化输出、工具调用、计费字段和错误码也各不相同。

今天实现第一层模型工程：**统一 `ModelClient`**。它不是把所有厂商能力抹平，而是把业务真正依赖的契约固定下来，把供应商差异收进适配器。后续切换模型、做灰度、设置超时降级和统计成本，都应在这个边界上完成。
<!--more-->

## 先定义边界：业务依赖什么，厂商差异放哪里

一个可维护的模型接入层至少分三层：

```text
业务 / Agent Runtime
        |
        v
ModelGateway：路由、配额、超时、重试、成本、审计
        |
        v
ModelClient：稳定的请求与响应契约
        |
        +--> OpenAIAdapter
        +--> AnthropicAdapter
        +--> QwenAdapter
        +--> 本地 vLLM Adapter
```

`ModelClient` 只关心一次模型调用的输入、输出和生命周期；`ModelGateway` 决定调用哪一个模型以及这次调用允许花多少时间和钱；供应商适配器负责把内部契约翻译成具体 SDK 请求。

不要让 `ModelClient` 直接读取 HTTP Header 中的租户信息，也不要让它决定用户是否有权限调用某个工具。身份、权限和任务状态由上层 Runtime 与 Gateway 校验，模型客户端只接受已经确定的请求。这样可以避免一个“方便”的 SDK 封装逐渐变成无法测试的万能类。

### 业务真正需要的最小能力

第一版可以只支持四件事：

1. 文本消息输入。
2. 普通文本输出或 JSON Schema 输出。
3. 完整响应和增量事件两种读取方式。
4. 截止时间、取消信号、重试预算和请求追踪信息。

工具调用和多模态可以在同一契约上扩展，但不要为了“以后可能用到”把所有供应商字段原样暴露出去。内部契约每增加一个字段，所有适配器、测试和观测面板都要维护它。

## 消息结构不要用一个大字符串糊过去

模型调用的输入应当是有角色和类型的消息，而不是拼好的长字符串。一个适合 Java 服务的最小数据模型如下：

```java
public record Message(
    Role role,
    List<ContentPart> parts,
    String name,
    String messageId
) {}

enum Role {
    SYSTEM, DEVELOPER, USER, ASSISTANT, TOOL
}

public sealed interface ContentPart
    permits TextPart, ImagePart, ToolResultPart {}

public record TextPart(String text) implements ContentPart {}
public record ImagePart(String mediaType, String uri) implements ContentPart {}
public record ToolResultPart(
    String toolCallId,
    String toolName,
    String resultJson
) implements ContentPart {}
```

这样做有三个实际好处：

- **可以审计。** 日志能区分系统规则、用户输入、模型输出和工具结果，排查提示词注入时不会把所有内容混成一段字符串。
- **可以适配。** 某些供应商没有 `DEVELOPER` 角色，适配器可以把它合并到系统消息，而业务层不需要改代码。
- **可以扩展。** 图片、文件、工具结果和引用可以成为新的 `ContentPart`，不需要改变调用方的字符串拼接逻辑。

消息还要有明确的大小策略。构造请求前统计字符数只是粗略估计，真正的 token 计数应由模型适配器或对应 tokenizer 提供。截断时要保留任务目标、权限约束、结构化结果和最后一个已确认的工具结果；不能简单地从列表头部删掉最老消息。

### Prompt 是配置，需要版本化

Prompt 不应该散落在 Java 常量、前端代码和数据库脚本里。建议把它表示成可追踪的模板记录：

```text
prompt_id       = invoice_extract
prompt_version  = 2026-10-29.3
template_hash   = sha256(...)
input_variables = [document_text, locale]
output_schema   = invoice_v2
owner           = finance-ai
status          = released
```

每次请求至少记录 `prompt_id`、`prompt_version`、模型名、模型版本、采样参数、输入 token、输出 token 和结果状态。问题出现时，才能回答“是模型变了、Prompt 变了、Schema 变了，还是下游数据变了”。不要只把最终文本存下来，否则无法做回归和重放。

## 一个稳定的 ModelClient 契约

可以把请求、响应和流事件定义成下面的内部接口：

```java
public interface ModelClient {
    ModelResponse complete(ModelRequest request, CallContext context);

    Flow.Publisher<ModelEvent> stream(
        ModelRequest request,
        CallContext context
    );
}

public record ModelRequest(
    String model,
    List<Message> messages,
    GenerationOptions generation,
    OutputSpec output,
    List<ToolDefinition> tools,
    RequestBudget budget,
    PromptRef prompt
) {}

public record GenerationOptions(
    Double temperature,
    Integer maxOutputTokens,
    Double topP,
    String seed
) {}

public record OutputSpec(
    OutputMode mode,
    JsonSchema schema,
    String schemaName
) {}

enum OutputMode { TEXT, JSON_SCHEMA, TOOL_CALL }

public record ModelResponse(
    String requestId,
    String model,
    String text,
    JsonNode parsed,
    FinishReason finishReason,
    Usage usage,
    String providerResponseId
) {}
```

这里有一个重要的设计取舍：`ModelResponse` 里可以同时保留原始文本和解析后的 `JsonNode`，但业务代码只能读取已经通过校验的字段。原始响应用于调试和重放，不能因为“看起来像 JSON”就直接写入数据库。

流式响应不应返回一个只能拼字符串的 `Consumer<String>`。事件需要表达完成、用量、错误和工具参数增量：

```java
public sealed interface ModelEvent
    permits TextDelta, JsonDelta, UsageEvent, Completed, Failed {}

public record TextDelta(String text, long sequence) implements ModelEvent {}
public record JsonDelta(String partial, long sequence) implements ModelEvent {}
public record UsageEvent(Usage usage) implements ModelEvent {}
public record Completed(FinishReason reason) implements ModelEvent {}
public record Failed(ModelError error, boolean retryable) implements ModelEvent {}
```

`sequence` 和 `requestId` 让客户端重连时可以去重。`DONE` 事件必须和“模型生成了一个合法结果”区分开：流结束不代表 JSON 完整，也不代表业务校验成功。

## 结构化输出：JSON 合法只是第一关

生产代码经常把下面两件事混为一谈：

- **JSON mode：** 尽量让输出是合法 JSON，但不保证字段、类型和枚举值符合业务 Schema。
- **Structured Outputs：** 让模型遵守给定的 JSON Schema；仍然需要处理拒答、截断、供应商不支持和业务规则失败。

OpenAI 的[Structured Outputs 文档](https://developers.openai.com/api/docs/guides/structured-outputs)明确区分了两者：JSON mode 只保证 JSON 形式，结构化输出才约束 Schema；流式生成时还要处理增量 JSON 和响应结束状态。其他厂商的名称不同，但内部契约应统一为“输出模式 + Schema + 校验结果”。

推荐采用四层校验：

```text
模型原始响应
   -> 传输层完整性：是否正常结束、是否被截断、是否拒答
   -> 语法解析：是否是合法 JSON
   -> Schema 校验：字段、类型、枚举、必填项
   -> 业务校验：金额范围、权限、状态、引用是否存在
```

例如发票抽取的 Schema 通过了，并不表示 `total_amount` 可以直接入账。还要校验币种、税额与明细之和，检查供应商账号是否属于当前租户。模型负责提取候选值，业务服务负责决定这些值是否能产生副作用。

### Schema 设计的四条经验

1. **输出结构服务于下游动作。** 如果后端只需要 `answer` 和 `citations`，不要要求模型生成一大段无法消费的解释字段。
2. **枚举要窄。** `status` 使用 `PENDING|APPROVED|REJECTED`，不要让模型自由生成十几种近义词。
3. **拒答和失败是显式分支。** 不要用空字符串表示“模型拒绝”或“输出被截断”。
4. **Schema 也要版本化。** `invoice_v1` 与 `invoice_v2` 同时存在时，记录版本并让解析器按版本选择。

一个安全的解析流程可以写成：

```text
response = provider.call(request)
if response.refusal != null:
    return MODEL_REFUSAL
if response.finish_reason == LENGTH:
    return INCOMPLETE_OUTPUT
parsed = json.parse(response.text)
if !schema.validate(parsed):
    retry_with_error_feedback_once()
if !business.validate(parsed):
    return BUSINESS_REJECTED
return ACCEPTED(parsed)
```

重试时把校验错误作为结构化反馈即可，不要把完整的内部 Prompt、权限信息或敏感数据原样回填给模型。重试必须受次数、截止时间和 token 预算限制。

## 流式输出：文本和结构化结果走两条通道

流式的价值是降低首字节等待，让用户先看到进度；它不能改变最终结果仍需完整校验的事实。常见的错误是对每一个 delta 直接调用 `JSON.parse`：第一个片段只有 `{ "name"`，必然不是完整 JSON。

建议分成两条通道：

```text
文本通道：TextDelta -> 前端增量渲染 Markdown
结构通道：JsonDelta -> 服务端缓冲/增量解析 -> 完整后挂载卡片
```

对于结构化卡片，可以在流期间展示骨架和状态，等完整 JSON 通过 Schema 与业务校验后再渲染按钮。这样即使中途断线，也不会把半个未校验的按钮展示给用户。前端组件要使用稳定的 `componentKey`，重连或补发事件时才不会把用户已经输入的表单重置。

服务端应持久化流状态，而不是只在内存里转发：

```text
stream_message(
  task_id,
  request_id,
  sequence,
  channel,
  delta,
  status,       -- OPEN / COMPLETED / FAILED
  created_at
)
```

客户端带上 `last_sequence` 重连时，服务端补发缺失事件；如果服务端无法补齐，返回明确的 `STREAM_GAP`，前端显示“重新生成”或“查看完整结果”，不要留下永远转圈的 loading。

## 超时与重试：按截止时间管理，而不是每层各睡几秒

一次模型请求至少有三种时间限制：

- `connectTimeout`：建立连接允许多久。
- `readTimeout`：两个响应事件之间允许多久没有数据。
- `deadline`：从 Agent Runtime 角度，这次调用最晚何时必须结束。

只设置 HTTP 客户端的 30 秒超时是不够的。模型网关、Runtime、工具和前端各自设置 timeout 后，容易出现上层已经取消，底层还在重试的情况。建议把 `deadline` 作为请求的一部分向下传递，所有等待和重试都计算剩余时间：

```text
remaining = deadline - now()
if remaining <= 0:
    fail(TOTAL_DEADLINE_EXCEEDED)

attemptTimeout = min(provider_limit, remaining)
call(attemptTimeout)
```

重试策略应由错误分类驱动：

| 错误 | 是否重试 | 处理方式 |
| --- | --- | --- |
| 连接重置、网关 502/503、短暂限流 | 有条件 | 指数退避 + 抖动，遵守 `Retry-After` |
| 请求体过大、Schema 不支持 | 否 | 修改请求或路由到支持的模型 |
| 鉴权失败、租户配额不足 | 否 | 记录审计并快速失败 |
| 模型拒答 | 通常否 | 走安全提示或业务兜底，不盲目重复 |
| 达到输出长度上限 | 一般否 | 缩小任务、摘要上下文或提高预算 |
| 流中断且结果未知 | 有条件 | 按 requestId 查询或重连，避免无限重放 |

模型调用本身通常没有业务副作用，但每次重试都可能产生额外 token 成本和延迟。因此还要有 `maxAttempts`、`maxRetryTokens` 和全局预算。降级到小模型前，应确认输出 Schema、上下文窗口和安全等级仍然满足要求；敏感任务不能为了成功率自动降到不合规的模型。

## ModelGateway 的策略不能塞进适配器

适配器只做翻译：

```text
InternalRequest
  -> provider request
  -> provider response/event
  -> InternalResponse/Event
```

路由、配额和降级放在 Gateway：

```java
public ModelResponse invoke(ModelRequest request, CallContext ctx) {
    ModelRoute route = router.select(request, ctx.tenant(), ctx.budget());
    for (ModelAttempt attempt : route.attempts()) {
        try {
            return clients.get(attempt.provider())
                .complete(request.withModel(attempt.model()),
                          ctx.withDeadline(attempt.deadline()));
        } catch (ModelError e) {
            metrics.record(attempt, e);
            if (!retryPolicy.canRetry(e, ctx)) throw e;
        }
    }
    throw new ModelError("MODEL_ROUTE_EXHAUSTED");
}
```

这样可以根据任务类型、质量目标、延迟、预算和安全等级路由。比如摘要任务可以选择便宜模型，财务审批的结构化抽取要求严格 Schema 和更高质量；两者不能只靠一个全局默认模型解决。

每次调用至少记录：

```text
trace_id, task_id, tenant_id,
provider, model, model_version,
prompt_id, prompt_version, schema_version,
input_tokens, output_tokens, first_token_ms, total_ms,
retry_count, finish_reason, error_code, degraded
```

不要把完整用户消息无条件写入日志。生产环境应按租户策略脱敏或只存哈希、长度和可检索的事件引用；调试需要原文时，使用受控存储和审计权限。

## Java 后端的最小落地顺序

如果你现在有一个 Spring Boot 服务，不需要先引入复杂 Agent 框架，可以按下面顺序完成：

1. 定义 `Message`、`ModelRequest`、`ModelResponse` 和 `ModelEvent`，写纯单元测试。
2. 先接一个供应商适配器，禁止业务代码直接依赖供应商 SDK 的 response 类型。
3. 加入 `OutputSpec`，实现文本、JSON Schema 两种模式和四层校验。
4. 把 `deadline`、取消信号和错误分类贯穿到 HTTP 客户端。
5. 用 SSE 把 `ModelEvent` 转发给前端，同时持久化 `requestId + sequence`。
6. 再加入第二个适配器，用契约测试验证同一请求的行为一致。
7. 最后把路由、配额、成本和灰度迁移到 `ModelGateway`。

契约测试不要只断言“返回了 200”。至少覆盖：空消息、超长消息、Schema 不支持、拒答、截断、限流、流中断、取消和模型降级。每个适配器都应该通过同一套测试，才能确认统一接口真的统一。

## 今天的实践任务

实现一个 `ModelClient` 的内存版本，不调用真实模型也可以：

- 支持 `TEXT` 和 `JSON_SCHEMA` 两种输出模式。
- 支持完整响应和带序号的流事件。
- 模拟 503、限流、拒答、截断和半包 JSON 五种结果。
- 验证重试不会超过总截止时间，流重连不会重复序号。
- 保存一条包含模型、Prompt、Schema、token 和耗时的调用记录。

提交物包括接口定义、一个供应商适配器、错误分类表和 10 条契约测试。明天可以在这个边界上继续增加 Tool Calling，而不是把工具逻辑直接写进 HTTP 调用代码。

## 近期面试题整理（检索日期：2026-10-29）

以下题目来自近期公开面经或题库页面，页面多数标注原始来源为牛客网；聚合站的答案经过整理，适合用来练习答题结构，不能替代你对真实代码的验证。

### 1. 结构化 JSON 输出不稳定，应该怎样逐层解决？

**方向：** Prompt 与结构化输出；**难度：** 中。

先使用模型原生的 Structured Outputs、JSON Schema 或严格的 Function Calling，而不是只在 Prompt 里写“请输出 JSON”；再用清晰的字段描述、枚举和正反例约束模型；服务端做容错解析、Schema 校验和业务校验；解析失败只允许有限次重试，最终返回结构化错误或转人工。解析失败次数和类型要埋点，否则无法证明改 Prompt 后真的变好。

**追问：** JSON mode 和 Structured Outputs 有什么差别？

JSON mode 主要保证结果是合法 JSON，不能保证字段符合业务 Schema；Structured Outputs 还约束 Schema，但仍需处理拒答、截断、供应商不支持和业务校验失败。

来源：[恒生电子 AI 面试：闭包、缓存三兄弟与 LangGraph 选型](https://mj.mianlingai.com/interview/hundsun-ai-interview-2916445/)（页面标注时间 2026-09、来源为牛客网）。

### 2. 流式 JSON 能不能每收到一个 delta 就直接 `JSON.parse`？

**方向：** 流式响应与前端交互；**难度：** 中高。

不能。流式片段可能停在字符串、转义符或嵌套对象中间。文本通道可以增量渲染 Markdown；结构化通道应使用增量解析器或先缓冲到完整帧，完成后再做 Schema 和业务校验。前端显示骨架和状态，完整合法结果到达后再挂载交互组件，并为组件保留稳定 key。

**追问：** 流中断重连时如何避免重复渲染？

服务端为每个事件保存 `requestId + sequence`，客户端携带最后序号重连，服务端只补发缺失事件；如果存在序号缺口，明确返回失败态和重试入口。

来源：[字节跳动 AI Agent 开发面经：动态 UI 渲染、MCP 与 Skill 设计](https://mj.mianlingai.com/interview/bytedance-ai-agent-development-07-940390952902914048/)（页面标注面试时间 2026-10-13、来源为公开面经整理）。

### 3. 工具或模型调用失败时，为什么不能一律重试？

**方向：** 模型服务可靠性；**难度：** 中。

网络超时、限流和短暂 5xx 可以指数退避并限制次数；参数非法应把结构化错误回填给模型修正；权限不足、资源不存在和 Schema 不支持重试没有意义；空结果还要区分“业务上确实为空”和接口异常。达到重试上限后要有降级或明确失败态，并记录 `retry_count`、错误码和成本。

**追问：** 发生超时但下游结果未知怎么办？

先用 requestId 或业务幂等键查询执行状态；确认未执行才重放。对有副作用的写操作，不能因为客户端没收到响应就直接发第二次请求。

来源：[快手 Agent 开发一面：工具兜底、多 Agent 与流式解析](https://mj.mianlingai.com/interview/kuaishou-agent-first-round-931679347587444736/)（页面标注时间 2026-09、来源为牛客网）。

### 4. Prompt、模型和 Schema 为什么要联合版本管理？

**方向：** 模型工程与可观测性；**难度：** 中高。

一次结果由 Prompt、模型版本、采样参数、Schema、上下文和下游数据共同决定。只记录最终文本，无法判断回归来自哪一项。应记录 `prompt_id/version`、`model/version`、`schema_version`、请求参数、输入输出 token、耗时、错误和评测结果；发布前做离线回归，线上按版本灰度，出现问题按组合回滚。

**追问：** Prompt 改一行也要新版本吗？

只要可能改变输出或安全边界，就应生成新版本；可以通过内容哈希自动识别，并在评测通过后把版本标记为 released。

来源：[agent 面经：Prompt 工程与结构化输出面试问答](https://www.nowcoder.com/discuss/916877196034048000?sourceSSR=post&weFlow=true)（页面标注为近期公开牛客题库，检索日期 2026-10-29）。

### 5. 流式输出已经开始后，服务重启或连接断开怎么恢复？

**方向：** Agent Runtime 与流式服务；**难度：** 中高。

把正在生成的消息当成任务状态的一部分持久化，保存 `task_id`、`request_id`、序号、已发送片段和最终状态。客户端重连时先补发断点后的事件；如果无法确认模型是否仍在生成，先查询请求状态或把这次调用标记为不确定，再决定重试。最终结果必须重新做完整解析和业务校验，不能把半句话当成成功。

**追问：** 为什么不直接让前端重新请求一次？

前端重试可能产生重复 token、重复事件和不一致的最终答案；服务端保存请求身份和序号，才能去重、统计成本并在 Runtime 中继续正确的任务状态。

来源：[作业帮 Agent 开发一面：评测体系与 Trace 闭环](https://mj.mianlingai.com/interview/zuoyebang-agent-dev-first-round-2916240/)（页面标注时间 2026-09、来源为牛客网）。

## 今日资料

- [OpenAI Structured Outputs 官方指南](https://developers.openai.com/api/docs/guides/structured-outputs)：结构化输出、JSON mode、Schema 限制和流式解析边界。
- [OpenAI Responses API 官方参考](https://developers.openai.com/api/reference/resources/responses)：响应事件、文本增量、工具事件与 usage 字段。
- [Day 2：Agent Runtime 怎么设计](/articles/AI-Agent-Runtime-State-Machine.html)：任务状态、版本控制、幂等和恢复。

明天继续把这个模型调用边界接到 Tool Calling：工具 Schema 怎么定义、调用前后如何做权限校验，以及为什么模型输出的工具参数仍然不能直接执行。
