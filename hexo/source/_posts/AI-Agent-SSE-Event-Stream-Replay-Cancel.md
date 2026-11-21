---
layout: post
title: "Agent 流式输出怎样可恢复：SSE 事件、断点续传与取消边界"
date: 2026-11-14 09:00:00.000
updated: 2026-11-21 09:00:00.000
permalink: /articles/AI-Agent-SSE-Event-Stream-Replay-Cancel.html
comments: true
description: "AI 全栈开发第 19 天：把 Agent 输出建成可持久化事件流，讲清 SSE 游标、Last-Event-ID、跨租户授权、断线重放和任务取消，并附三道有来源的面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "SSE"
  - "Agent"
  - "任务系统"
  - "面试"
---

补刊说明：本文补齐原定第 19 天学习内容；资料与题目于 2026-11-21 检索核验。

前四天已经有服务契约、任务 API、租户数据模型和可恢复 Worker。现在要让用户看见执行过程。这里最容易犯的错，是把供应商返回的 Token 分片直接写给浏览器，却没有给“任务已完成”“工具失败”“断线后从哪继续”定义稳定语义。

本文把流式输出当作**任务事件的一个读取视图**。断开连接只影响读取；是否继续执行或取消任务，由后端状态机决定。
<!--more-->

## 一、先分清三种流

| 流 | 生产者 | 保存什么 | 能否作为恢复依据 |
| --- | --- | --- | --- |
| 供应商原始流 | 模型服务 | 厂商特有的增量事件、用量与错误 | 不直接交给业务前端；保留必要原始证据供对账 |
| 任务事件流 | 我们的 Worker | 状态变化、可展示增量、引用、失败原因 | 可以；按任务与租户持久化、有序读取 |
| SSE 连接 | API 服务 | 从任务事件表读出的投递帧 | 连接本身不是持久化存储 |

建议先定义小而稳定的事件集合：<code>task_started</code>、<code>model_delta</code>、<code>tool_started</code>、<code>tool_completed</code>、<code>citation_added</code>、<code>task_succeeded</code>、<code>task_failed</code>、<code>task_cancelled</code>。提供商可能有自己的事件名和字段，网关适配层负责归一化；原始思考内容、密钥、工具认证头和内部异常栈不进入用户事件。

第 17 天定义的 <code>ai_event</code> 表至少有 <code>tenant_id</code>、<code>task_id</code>、<code>seq</code>、<code>event_type</code>、<code>payload</code>、<code>created_at</code>。<code>(tenant_id, task_id, seq)</code> 唯一；对同一任务分配序号时使用任务行锁或等价的原子方式，避免两个 Worker 产生相同序号。状态变更和对应的终态事件在同一数据库事务提交。消息队列只负责唤醒执行或流式推送，数据库中的任务与事件才是恢复依据。

## 二、SSE 协议只负责“从哪里继续读”

沿用第 16 天的 <code>GET /v1/tasks/{task_id}/events</code>，以 <code>text/event-stream</code> 持续投递 SSE。API 从服务端认证上下文获取租户和用户，先检查其对任务的读取权限，再查事件；不能信任 URL 或前端传来的租户 ID。长连接还要在投递期间复核权限或监听 ACL 纪元变化，权限撤销后停止发送。JSON 状态快照由 <code>GET /v1/tasks/{task_id}</code> 提供。

一个可投递的帧长这样：

~~~text
id: 42
event: model_delta
data: {"task_id":"task-7","seq":42,"text":"报销上限为"}

~~~

末尾空行用于结束一个事件。浏览器 <code>EventSource</code> 会在连接中断后尝试重连，并把最近收到的 <code>id</code> 放入 <code>Last-Event-ID</code> 请求头；SSE 正文的媒体类型是 <code>text/event-stream</code>。这些是 [WHATWG HTML Standard 的 Server-sent events 规范](https://html.spec.whatwg.org/multipage/server-sent-events.html)定义的浏览器行为（检索日期：2026-11-21）。

服务器不能直接把收到的字符串拼进 SQL。把游标解析成有界整数，并检查它是否属于当前任务的有效保留范围；初次打开可用 <code>?after=42</code> 指定快照游标，自动重连则优先使用 <code>Last-Event-ID</code>。一次返回 <code>seq &gt; cursor</code> 的事件，每次最多 100 条，读完再等待新事件。恢复的是**事件投递**，不是重新发起模型调用。

~~~python
async def stream_events(principal, task_id, after, last_event_id):
    task = await tasks.require_readable(principal, task_id)
    cursor = parse_cursor(last_event_id or after or "0")
    while True:
        await tasks.require_readable(principal, task_id)
        batch = await events.list_after(task.tenant_id, task.id, cursor, limit=100)
        for item in batch:
            await tasks.require_readable(principal, task_id)
            yield encode_sse(item.seq, item.type, item.public_payload)
            cursor = item.seq
        if await tasks.is_terminal(task.id) and not batch:
            return
        await wakeup.wait(task.id, timeout_seconds=15)
        yield ": keepalive\n\n"
~~~

这段是接口伪代码：<code>wakeup</code> 可以由发布订阅通知驱动，但丢通知时仍要定期从持久化事件表补读。FastAPI 的 <code>StreamingResponse</code> 支持异步生成器；异步流要有可取消的等待点，并在连接结束时清理订阅资源。[FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)（检索日期：2026-11-21）

如果客户端的游标已经早于事件保留窗口，发送 <code>resync_required</code>，要求它读取 <code>GET /v1/tasks/{id}</code> 的当前快照后重建界面，再以快照的 <code>last_seq</code> 打开新流。事件保留期应与业务审计期分开；较短的用户流保留期不能删掉需要审计的任务事实。

## 三、断线、取消和失败是三件事

1. **浏览器刷新或网络断开**：SSE 连接消失，Worker 继续运行。重连按游标重放；前端对 <code>seq ≤ lastSeq</code> 的重复事件去重。
2. **用户主动取消**：前端调用 <code>POST /v1/tasks/{id}/cancel</code>。后端鉴权并把任务标为 <code>CANCEL_REQUESTED</code>；Worker 在安全检查点停止下一步，写入终态。已发出的有副作用工具调用要按其真实结果处理，不能因为用户点击取消就写“全部未执行”。
3. **模型流式半途出错**：写 <code>task_failed</code> 和可公开的错误码；已展示文本标为未完成，不直接拼接备用模型的输出。若用量回执缺失，账本进入待对账状态。

Python 协程取消在下一次可取消等待处生效，清理逻辑应放在 <code>finally</code>；这只是进程内的取消机制。业务任务取消还必须持久化状态，并由重启后的 Worker 继续遵守。[Python asyncio 任务取消文档](https://docs.python.org/3/library/asyncio-task.html#task-cancellation)（检索日期：2026-11-21）

### 本地验收

做一个不接真实模型的 <code>FakeModelClient</code>，按固定时钟产生十个增量事件、一次工具事件和终态事件。通过 4 个 Case 才算完成：第 5 个事件后断网重连无重算且无重复文字；两个租户同名任务仍相互不可读；取消在工具调用前生效；取消请求到达时工具已提交副作用，最终状态与审计能说明真实结果。保存事件表快照与浏览器实际接收序列，核对序号单调且无漏帧。

## 四、今日面试题（检索日期：2026-11-21）

下面题面来自可直接打开正文的牛客用户自述；公司和面试经历未获企业官方核验。答案与追问是本文的工程归纳，不是企业标准答案。

### 1. SSE 断线后，是重推全部内容还是从上次位置继续？

- **方向 / 难度**：Agent 流式服务、恢复 / 难。
- **参考答案**：先持久化任务事件与单调序号，再发送 SSE <code>id</code>；按 <code>Last-Event-ID</code> 或快照游标读取后续事件，前端按序号去重。重放投递不能重做模型或工具步骤。游标过期时读取状态快照并重新订阅。
- **追问**：事件已经入库，但推送前连接断了怎么办？重连从库里补读；同一终态事件须与任务终态一致。
- **来源**：[牛客“满帮 AI 全栈一面”用户自述](https://api-cdn.nowcoder.com/feed/main/detail/0dfa45a987bb4c19b6963af6bbeb5815?sourceSSR=enterprise)，正文第 8–9 题；页面显示 10-14 编辑。

### 2. SSE 用来做什么，如何处理心跳和客户端重连？

- **方向 / 难度**：前后端事件协议 / 中高。
- **参考答案**：SSE 单向推送执行进度与结果；事件类型、序号、任务 ID、公开错误码都要稳定。空闲时发注释心跳，连接断开后按任务事件游标重读。SSE 连接生命周期与任务生命周期分离。
- **追问**：浏览器关闭后 Worker 还要继续吗？由任务状态和取消 API 决定，关闭连接本身不等于取消。
- **来源**：[牛客“字节 Agent 一面”用户自述](https://api-cdn.nowcoder.com/feed/main/detail/612a1c20eea744a288b142f5b43f57e1?sourceSSR=post)，正文第 8–10 题；页面显示 09-07。

### 3. SSE 分片乱序、异常断开和恢复输出，前端怎样处理？

- **方向 / 难度**：AI 全栈、前端状态 / 难。
- **参考答案**：客户端按任务 ID 和递增 <code>seq</code> 处理，重复事件忽略；发现序号缺口时先拉任务快照再续流。区分增量文本、状态事件与终态，避免把供应商原始分片直接拼成业务答案。重连不重新提交任务。
- **追问**：前端已显示半个答案，后端最终失败时应该如何呈现？保留可识别的“未完成草稿”和失败提示，不能标为成功。
- **来源**：[牛客“小厂全栈面经”用户自述](https://www.nowcoder.com/feed/main/detail/b7a11a657f574ee6867f8752de0d52c7?sourceSSR=dynamic)，正文第 7–8 题；页面写明面试时间 2026-08-26。该来源不是大厂原题，用来补足前端恢复视角。

## 资料与下一步

- [WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)：事件帧、<code>id</code> 与浏览器重连规则。
- [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)：异步生成器流式响应与取消注意事项。
- [Python asyncio task cancellation](https://docs.python.org/3/library/asyncio-task.html#task-cancellation)：进程内任务取消和清理。以上官方资料检索日期：2026-11-21。

第 20 天给这套事件协议写 TypeScript 客户端与界面状态机，让刷新、重试、权限错误和半途失败都有确定的用户界面行为。
