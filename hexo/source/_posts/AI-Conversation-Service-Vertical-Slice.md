---
layout: post
title: "最小对话服务怎样贯通：会话、消息、任务与 ModelClient"
date: 2026-11-17 09:00:00.000
updated: 2026-11-21 09:00:00.000
permalink: /articles/AI-Conversation-Service-Vertical-Slice.html
comments: true
description: "AI 全栈开发第 22 天：把会话消息、任务状态、持久化事件和统一 ModelClient 接成最小纵向链路，解决重复提交、版本固定、上下文构建与租户隔离。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "对话服务"
  - "ModelClient"
  - "多租户"
  - "面试"
---

补刊说明：本文补齐原定第 22 天学习内容；资料与题目于 2026-11-21 检索核验。

第三周已经有了 HTTP 入口、任务 API、数据库模型、Worker、SSE 和前端状态。现在把它们连成一个用户能实际操作的最小对话服务：创建会话，发送一条消息，看到任务执行和最终回答，刷新后还能找回同一轮。

对话服务的关键不在聊天框，而在**分清会话历史、一次执行任务、传给模型的上下文**。三者生命周期不同，不能放进一个可变数组里。
<!--more-->

## 一、四类对象各管一件事

| 对象 | 保存的事实 | 生命周期与边界 |
| --- | --- | --- |
| <code>conversation</code> | 租户、所有者、标题、最近活动时间、版本 | 跨多轮，按权限读取 |
| <code>message</code> | 用户原文或已确认的助手回答、创建顺序、来源任务 | 长期会话记录；失败草稿不冒充已完成回答 |
| <code>task</code> | 本轮目标、状态、幂等键、预算、配置快照、截止时间 | 一次执行；可失败、取消、重试或恢复 |
| <code>ai_event</code> | 递增事件序号、进度、公开增量和终态 | 给 UI 重放与审计；不等于完整会话历史 |

本轮发给模型的 <code>model_context</code> 则是**派生输入**：从授权的历史消息中按上下文预算选取，再加入系统指令、必要知识、工具结果和版本信息。它不是把整个会话表无条件复制给模型。上下文构建策略变更后，同一历史会形成不同输入，因此任务里要保存 <code>context_policy_version</code> 及实际引用的消息 ID；需要精确回放时还应保存脱敏且受控的模型输入摘要。

关系键必须含租户范围。至少建立 <code>(tenant_id, conversation_id)</code>、<code>(tenant_id, task_id)</code> 的读取索引，用户消息用 <code>(tenant_id, conversation_id, client_message_id)</code> 唯一约束，助手最终消息用 <code>task_id</code> 唯一约束。同一用户也可能有多会话，不能把 <code>user_id</code> 当会话 ID。

## 二、从“发消息”到“可恢复的任务”

~~~text
POST /v1/conversations
→ 201 { "conversation_id": "conv-1" }

POST /v1/conversations/conv-1/messages
Idempotency-Key: turn-8c0f
{ "client_message_id": "msg-client-17", "text": "本月住宿上限是多少？" }
→ 202 { "message_id": "msg-31", "task_id": "task-7",
        "status": "QUEUED", "events": "/v1/tasks/task-7/events" }

GET /v1/conversations/conv-1/messages
→ 200 { "items": [ ... ], "next_cursor": null }
~~~

这个“发送消息”入口是第 16 天 <code>POST /v1/tasks</code> 契约的**会话业务封装**：它创建用户消息，同时返回同一种 <code>task_id</code>；查询、取消和 SSE 继续使用任务 API。服务端从认证主体确定 <code>tenant_id</code>，检查会话成员权限，再处理幂等；重放旧请求时也要重新检查当前主体能否读取原任务。创建用户消息、任务、固定配置版本和 outbox 触发记录应在**同一事务**提交；202 只表示已受理，不能返回“回答成功”。PostgreSQL 唯一约束和 <code>ON CONFLICT</code> 可帮助处理并发首次提交；跨数据库与消息队列的提交要通过 outbox 或等价机制补偿，不能依赖“先写库，再尽力发 MQ”。[PostgreSQL INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html)、[RFC 9110 对 202 的定义](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3)（检索日期：2026-11-21）

~~~python
# 用例伪代码，展示事务和边界；不是完整可运行的路由。
def submit_turn(principal, conversation_id, client_message_id, text, idem_key):
    with db.transaction() as tx:
        conversation = tx.require_conversation_for_write(
            principal.tenant_id, principal.user_id, conversation_id
        )
        prior = tx.find_turn(principal.tenant_id, conversation.id, idem_key)
        if prior:
            if prior.request_hash != hash_request(client_message_id, text):
                raise Conflict("IDEMPOTENCY_MISMATCH")
            tx.require_task_readable(principal, prior.task_id)
            return prior.accepted_response
        user_message = tx.insert_user_message(
            principal.tenant_id, conversation.id, client_message_id, text
        )
        task = tx.insert_task(
            tenant_id=principal.tenant_id,
            conversation_id=conversation.id,
            input_message_id=user_message.id,
            prompt_version=config.prompt_version,
            route_release=config.route_release,
            context_policy_version=config.context_policy_version,
            knowledge_snapshot=config.knowledge_snapshot,
        )
        tx.insert_outbox("TASK_READY", task.id)
        return accepted(task, user_message)
~~~

这里还要处理同键并发竞争：由数据库唯一约束选出唯一记录；失败的请求读取已提交任务，不能在普通 <code>SELECT</code> 后无约束地再插入。<code>client_message_id</code> 与 HTTP 幂等键服务不同：前者标识用户消息，后者标识一次提交意图。若请求体变化，同键应返回冲突。

## 三、Worker 怎样完成这一轮

Worker 领取任务后，用任务里固定的配置版本构建输入：查询授权历史消息、按 Token 预算裁剪、检索当前任务固定的知识快照、经模型注册表与预算准入选择模型，再通过统一 <code>ModelClient</code> 调用。<code>ModelClient</code> 的消息、结构化输出、流式与重试边界见 [第 3 天文章](/articles/AI-ModelClient-Structured-Output-Streaming.html)。

模型增量写入 <code>ai_event</code>，供 SSE 展示。只有最终输出通过格式和证据校验后，才在同一事务里写入一条助手最终消息、将任务置为 <code>SUCCEEDED</code> 并追加终态事件。任务失败时保存稳定错误码与必要诊断，不把流式草稿写成正式助手回答。每次实际供应商调用仍按 attempt 结算；客户端掉线不会导致重新计费。

~~~text
QUEUED
  → RUNNING
  → [ModelClient attempt 1, attempt 2 ...]
  → OUTPUT_VALIDATED
  → assistant message + SUCCEEDED + terminal event（同一事务）
~~~

并发的两条用户消息可能要求明确顺序。最小实现可以**限制同一会话同时只有一条 RUNNING 任务**，第二条返回 409 或排队；若允许并发，就必须记录读取的会话版本、消息顺序和合并规则。不要让后一条任务悄悄读取到前一条尚未确认的流式草稿。

## 四、前端和接口的最小交付

页面只需要会话列表、消息列表、输入框、当前任务状态、可识别的未完成草稿和引用。提交后保存 <code>task_id</code>；刷新先查询消息与任务快照，再续订事件。用户点击“取消”调用任务取消 API，不靠关闭 SSE。权限错误要清除旧会话内容；答案中的引用只显示本租户当前可授权的证据 ID。

本地用 <code>FakeModelClient</code> 跑六个 Case，交付 <code>conversation.jsonl</code>、<code>task_events.jsonl</code> 与逐 Case 报告：正常双轮；同键重试仅一条用户消息/任务；同会话第二轮并发冲突或明确排队；失败半包不生成正式助手消息；权限撤销后旧会话不可读；模型版本热更新后在途任务仍用创建时版本。验收时数清消息、任务、attempt 和终态事件，不能只看页面截图。

## 五、今日面试题（检索日期：2026-11-21）

以下题面来自可直接打开正文的牛客用户自述；企业归属和面试经历未获企业官方核验。答案与追问由本文工程化整理。

### 1. 会话历史、任务执行状态和本轮模型上下文分别保存什么？

- **方向 / 难度**：Agent 记忆、对话服务 / 难。
- **参考答案**：会话历史是用户和已确认助手消息的长期记录；任务状态保存本轮执行位置、版本、预算、错误及副作用回执；模型上下文是按权限、预算和策略从历史及证据派生的本轮输入。持久化历史与任务事实，保存上下文构建版本和引用消息 ID，避免原样无限累计。
- **追问**：模型已输出 500 字但任务失败，这 500 字进入下轮历史吗？默认作为可识别草稿而非已确认助手消息，是否进入下轮须有明确策略与标识。
- **来源**：[牛客“科大讯一面 11.12”用户自述](https://www.nowcoder.com/feed/main/detail/36f79403b25b4ae8afa08de37625bba5?sourceSSR=subject)，正文第 10 题；页面检索时显示“昨天”，企业归属未获官方核验。

### 2. AI 应用平台用了哪些模型，会话管理和数据结构怎样设计？

- **方向 / 难度**：AI 平台、会话建模 / 中高。
- **参考答案**：按场景列出实际模型 ID、端点、能力与配置版本，不把“用了大模型”当答案。会话表记录租户、成员、顺序和版本；消息表记录角色、内容与来源任务；任务与事件独立保存执行状态。短期缓存只做加速，持久化存储保存可恢复事实。
- **追问**：用户一年后继续一个缓存已过期的会话，从哪里恢复？先从授权的持久化消息读取，再按当前策略重建模型上下文。
- **来源**：[牛客“百度后端一面”用户自述](https://www.nowcoder.com/feed/main/detail/7eeffb48e3704250864b994adb9fc473?sourceSSR=enterprise)，正文第 11–12 题；作者注明 2026-09-17 面试。

### 3. 创建 AI 摘要任务的请求超时，但服务端已经入库，重试如何避免重复任务和扣费？

- **方向 / 难度**：对话提交、幂等与成本 / 难。
- **参考答案**：客户端重试同一业务意图保持同一幂等键，服务端以租户、创建者、接口和键建立唯一约束，并校验请求指纹与当前主体对原任务的读取权限；返回已有任务状态，不新建任务。供应商 attempt 另有唯一账本记录，外部副作用另用稳定动作键；不可用“先删除再创建”解决未知结果。
- **追问**：第一次任务已发出模型请求，但响应没收到，第二次提交能否直接再调模型？先找回任务和 attempt 结果，未知用量进入对账，不能盲目双调。
- **来源**：[牛客“小红书 AI Agent 开发岗面经”用户整理](https://www.nowcoder.com/discuss/939320406547103744?sourceSSR=post)，面经 01 第 5–7 题；整理页写明所述面试日期为 2026-09-17，真实性未获企业核验。

## 资料与下一步

- [PostgreSQL INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html)：唯一约束下的并发冲突处理。
- [RFC 9110 §15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3)：202 代表接收处理但结果尚未完成。
- [第 3 天 ModelClient 契约](/articles/AI-ModelClient-Structured-Output-Streaming.html)、[第 19 天 SSE 事件流](/articles/AI-Agent-SSE-Event-Stream-Replay-Cancel.html)：本服务复用的执行与展示边界。官方资料检索日期：2026-11-21。

第 23 天把 <code>ModelClient</code> 接上具体供应商适配器；第 24 天再为这条链路补版本化回归样本。当前先让两轮对话在断线、重复提交和权限变化下保持正确。
