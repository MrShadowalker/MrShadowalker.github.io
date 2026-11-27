---
layout: post
title: "工具 Schema 怎么升级：注册、发现、版本快照与兼容性"
date: 2026-11-27 09:00:00.000
updated: 2026-11-27 09:00:00.000
permalink: /articles/AI-Agent-Tool-Schema-Registry-Version-Compatibility.html
comments: true
description: "AI 全栈开发第 32 天：让 Agent 工具定义可发布、可发现和可回滚，用政策查询 v1/v2 讲清严格 Schema、任务快照、候选工具筛选与选择回归，附有来源的面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "Agent"
  - "Tool Calling"
  - "工具注册表"
  - "Schema"
  - "版本治理"
  - "面试"
---

[第 31 天](/articles/AI-Agent-Tool-Calling-Proposal-Execution-Contract.html)把一次工具调用拆成“模型提议、服务端执行、结果回填”。今天往前推进一步：**工具定义更新时，模型看见哪一版，执行器运行哪一版，正在执行的任务怎样不漂移？** 工具 `name` 和 JSON Schema 并不是整份契约；描述、权限、实现与输出形状都会影响最终答案。

本文沿用只读 `lookup_policy_v1`，加入“按日期查历史政策”的 v2。下面的注册表与报告是练习设计，尚未代表 Day 30 模型网关项目有可运行实现。
<!--more-->

## 一、工具定义分成模型可见层和服务端执行层

| 字段 | 模型是否可见 | 作用 |
| --- | --- | --- |
| 名称、描述、输入 Schema | 是 | 帮模型判断何时选择、怎样填参数 |
| 输出 Schema 或结果说明 | 可选择暴露摘要 | 让调用方知道返回结构；服务端仍要实际校验 |
| 租户准入、资源权限、风险级别 | 否 | 由服务端用受信身份决定，不由模型自证 |
| 超时、并发上限、实现版本、审计与脱敏策略 | 否 | 控制真实执行、故障与运维边界 |

内部记录可以叫 `ToolDescriptor`，至少固定 `tool_name + business_version + input_schema_hash + description_hash + output_schema_hash + implementation_digest + policy_version`。这些字段是**项目级工程建议**，并非 JSON Schema 或供应商 API 强制的版本格式。Java 可以把它们做成不可变记录，发布后只新增版本，不原地改正在被任务引用的定义。

~~~java
record ToolDescriptor(
    String name, String businessVersion,
    String inputSchemaHash, String outputSchemaHash,
    String descriptionHash, String implementationDigest,
    String policyVersion, boolean readOnly
) {}
~~~

JSON Schema 里的 `$schema` 声明的是**Schema 方言**，例如该文档按哪一版 JSON Schema 规则解释；它不是 `lookup_policy` 的业务版本号。[JSON Schema：The `$schema` keyword](https://json-schema.org/understanding-json-schema/reference/schema)（检索日期：2026-11-27）

## 二、从 v1 到 v2：多一个字段也不自动兼容

v1 只有 `document_id`。v2 加 `effective_at`，用于回答“这份政策在 2025 年 5 月是否有效”。为避免旧模型回合突然换语义，发布新的模型可见名称 `lookup_policy_v2`，保留 v1 的定义与执行入口直到引用它的任务结束。

~~~json
{
  "type": "function",
  "name": "lookup_policy_v2",
  "description": "按文档 ID 和生效日期读取授权政策；effective_at 为 null 时使用任务创建时的日期；只读，不修改政策",
  "parameters": {
    "type": "object",
    "properties": {
      "document_id": {"type": "string"},
      "effective_at": {"type": ["string", "null"]}
    },
    "required": ["document_id", "effective_at"],
    "additionalProperties": false
  },
  "strict": true
}
~~~

这是 OpenAI 自定义函数的**示意 Schema**，日期格式和业务有效期由服务端继续校验。OpenAI `strict: true` 要求每层对象禁止额外属性并将所有属性列入 `required`；可用联合 `null` 表示可选语义。它只支持 JSON Schema 的子集，不能假定 `allOf`、`not`、`if/then/else` 等高级关键字都能直接传给模型 API。[OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)、[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)（检索日期：2026-11-27）

`effective_at: null` 在本项目有明确含义：使用**任务创建时**冻结的日期，而不是执行器重试时的“今天”。否则任务隔夜恢复，输入相同却可能读到另一版政策。Anthropic 的工具定义使用 `input_schema`，可给工具描述和输入示例；要把同一份内部契约投影到供应商支持的格式，并在真实 API 上验证，不要把 OpenAI 的 `strict` 字段原样交给它。[Anthropic Define Tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)（检索日期：2026-11-27）

| 变更 | 是否可以默认为兼容 | 处理方式 |
| --- | --- | --- |
| 给输入加必填字段 | 否 | 新工具版本；旧任务继续用旧参数契约 |
| 修改描述或示例 | 否，模型选工具的行为可能变 | 固定新版本，跑工具选择回归再灰度 |
| 改输出字段名或含义 | 否，下游模型/解析器可能依赖 | 新输出 Schema；回放最终答案和引用校验 |
| 只修改超时或实现 | 也不能无证据认定安全 | 记录实现与策略版本，做故障与延迟回归 |
| 从只读改为写入 | 明显破坏安全边界 | 新名称、新权限与审批，不原地升级 |

## 三、发现时给小而准的候选集，执行时仍重新授权

不是把注册表里的几百个 Schema 全送给模型。应用先用当前任务意图、租户权限、工具启用状态与模型能力筛出候选集；模型可见列表里保留明确的“无需工具”路径。对两个相似工具，描述要写出**使用条件和不使用条件**，例如“按已知 ID 读文档”和“按问题检索多个文档”应是不同能力。

~~~text
discover(task, authenticatedPrincipal):
  snapshot = registry.resolve(task.toolBundleVersion)
  candidates = snapshot.tools
      .filter(enabledFor(task.tenant, task.environment))
      .filter(visibleTo(authenticatedPrincipal, task.intent))
      .filter(withinModelAndBudgetCapability(task))
  return projectToProviderSchema(candidates, task.modelProvider)
~~~

这里的“可见”是减少误选与暴露面，**不是执行授权**。权限可能在模型思考期间撤销；调用到达时仍需用最新受信身份和资源状态重新判定。OpenAI 可用 `tool_choice` 或允许工具集合限制本轮候选；Anthropic 的定义强调名称、描述和参数示例对工具选择的影响。[OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)、[Anthropic Define Tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)（检索日期：2026-11-27）

MCP 的 `tools/list` 是工具发现协议，支持游标分页；可按当前请求的授权身份返回不同工具集合，但不能依赖连接的偶然状态或查询副作用来改变列表。规范建议稳定排序并可通知工具列表变化；通知不应成为唯一刷新机制，宿主仍需为新任务检查版本。MCP 还提供必需的 `inputSchema` 和可选的 `outputSchema`，工具服务仍负责校验输入、权限与限流。[MCP Tools 规范（2026-07-28）](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)（检索日期：2026-11-27）。这里只借用发现语义，完整 MCP 接入留到第 57–60 天。

## 四、任务固定工具快照，发布只影响新任务

任务启动时持久化 `tool_bundle_version`、各工具的名称/版本/Schema 与描述摘要，以及执行端版本。恢复 Worker 时先取任务快照，核对旧实现是否仍可调用；若旧版已下线，不能把旧参数直接发给新版工具。需要显式迁移时，重新校验输入、权限、业务状态和审批，记录迁移原因与新旧版本关联。

~~~text
T0：任务 A 固定 bundle-7，模型看到 lookup_policy_v1
T1：发布 bundle-8，新任务 B 可灰度看到 lookup_policy_v2
T2：任务 A 重试/恢复，仍按 bundle-7 解析和执行
T3：灰度失败，新任务回到 bundle-7；B 的在途步骤按其固定版本完成或受控迁移
~~~

不要把“回滚入口工具列表”误认为已经处理了在途任务；旧版本执行端的保留期应覆盖任务最长运行与恢复窗口。对可写工具还需核对副作用是否已发生，不能靠重新选择版本消除未知回执。

## 五、用回归集验证版本，而不是只看 Schema 校验

准备同一批历史任务，固定模型、Prompt、知识和工具实现，只改变工具定义版本。至少分六类：按已知 ID 读取、按自然语言检索、无需工具、文档已撤权、无效日期、v1 在途任务恢复。每条记录 `expected_tool`、预期参数与业务结果，并比较：

| 指标 | 发现什么问题 |
| --- | --- |
| 首步工具选择率与“不用工具”判断 | 描述变更是否让模型误选 |
| 完整参数有效率 | v2 字段是否被漏填或乱填 |
| 工具执行成功率及拒绝原因 | Schema 合法后是否仍被业务规则拒绝 |
| 任务最终正确率、引用与越权数 | 首步选对是否真的改善用户结果 |
| 每成功任务延迟和成本 | 候选集、重试是否扩大开销 |

上线前写定阈值和失败 Case；权限泄漏和越权执行为硬失败。若首步工具选择率上升而任务成功率下降，要沿调用轨迹看参数、工具返回和答案引用，不把“模型更爱调用 v2”误判为发布成功。

今天可交付 `tool-registry.yaml`、v1/v2 Schema 与描述哈希、`selection-fixtures.jsonl` 和一份对比报告模板。只有实际跑过的行才写 `PASS`，其余保留 `NOT_RUN`；本文的 v1/v2 示例不是已验证的生产注册表。第 33 天继续做执行器的超时、重复调用与错误分类。

## 六、今日面试题（检索日期：2026-11-27）

题面优先取自可直接打开正文的公开面经。企业、岗位与场次来自发帖者自述，未经官方核验；参考答案与追问是本文的工程归纳。

### 1. 参数符合 JSON Schema，但两个字段组合违反业务约束，怎样设计重试？

- **方向 / 难度**：工具参数校验、业务规则 / 中高。
- **参考答案**：先由结构 Schema 验字段，再由服务端验跨字段规则，例如 `start_time <= end_time`。把可安全修正的错误以结构化原因回传模型，限制修正次数与总截止时间；每次都重新完整校验。鉴权失败、取消或写操作结果未知不能当作普通参数错误盲重试，非法参数绝不执行工具。
- **追问**：模型连续三次仍给出 `start_time > end_time` 怎么办？停止自动循环，保留失败原因，向用户澄清输入或返回受控错误。
- **来源**：[牛客《科大讯一面 11.12》用户自述](https://www.nowcoder.com/feed/main/detail/36f79403b25b4ae8afa08de37625bba5?sourceSSR=subject)，页面发表于 11-19；公司与场次未获官方核验。

### 2. 改了一版工具描述，怎样用历史任务验证工具选择和任务完成率？

- **方向 / 难度**：工具定义版本、回归评测 / 难。
- **参考答案**：固定模型、Prompt、工具实现与样本，只切换描述/Schema 版本。成对回放按已知 ID 读取、自然语言检索、无需工具和越权场景，比较首步工具选择率、参数有效率、最终任务正确率、误调用与成本。写操作不能为了评测直接重放真实副作用，应使用隔离夹具或只做离线提议判分。
- **追问**：选择率提高但任务成功率下降，如何查？沿 trace 区分参数错误、执行拒绝、结果解释与最终引用错误，先保留旧版本并补失败样本。
- **来源**：[牛客《科大讯一面 11.12》用户自述](https://www.nowcoder.com/feed/main/detail/36f79403b25b4ae8afa08de37625bba5?sourceSSR=subject)，页面发表于 11-19；公司与场次未获官方核验。

### 3. Action 怎样声明输入、输出和底层 HTTP、JSF 调用映射？

- **方向 / 难度**：工具注册表、执行适配 / 中高。
- **参考答案**：为 Action 登记名称、版本、所有者、输入/输出 Schema 和明确的业务语义；由执行适配器把字段映射到 HTTP 或内部 RPC，请求中的租户身份仍由可信上下文注入。统一超时、错误码、脱敏回包与审计，发布前跑契约测试、权限测试和健康检查；接口非兼容变更发布新工具版本。
- **追问**：底层 JSF 新增必填字段，历史 Action 调用如何处理？保留旧适配器或显式迁移到新版本，不能静默给可能改变业务含义的默认值。
- **来源**：[牛客“得物 AI 应用 / Java 后端方向一面”用户自述](https://www.nowcoder.com/feed/main/detail/5e67a722498843c29f83c59493908aec?sourceSSR=dynamic)，页面发表于 11-17；公司、岗位与场次未获官方核验。

### 4. 动态加载工具时，如何保证一次 Agent 运行中的定义不漂移？

- **方向 / 难度**：工具发现、版本快照 / 难。
- **参考答案**：任务开始时固定可见工具集合、每个名称与版本、Schema/描述摘要和执行端路由；每一步按同一快照解析并执行，新版本只给新任务。恢复时核对旧执行端是否仍可用；若必须迁移，重新校验参数、身份、权限和副作用状态，记录版本转换。
- **追问**：旧执行端故障，新 Schema 又删掉旧参数，能直接用新版恢复吗？不能直接转发；先暂停或做显式迁移并重验，无法确定副作用时进入对账或人工接管。
- **来源**：[牛客“蔚来 AI Agent 开发一面”用户自述及题解](https://api-cdn.nowcoder.com/discuss/930173741886111744?sourceSSR=post)，页面发表于 09-17；这道较早的经典题直接覆盖在途版本漂移，近期可核验题源未见同等具体的独立原题；公司与场次未获官方核验。

## 资料

- [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)与[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)：严格 Schema 子集和工具选择控制。
- [Anthropic Define Tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)：描述、输入 Schema 和示例。
- [MCP Tools 规范（2026-07-28）](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)：工具发现、Schema 与服务端责任。
- [JSON Schema `$schema`](https://json-schema.org/understanding-json-schema/reference/schema)：Schema 方言与业务版本的区别。以上资料检索日期均为 2026-11-27。
