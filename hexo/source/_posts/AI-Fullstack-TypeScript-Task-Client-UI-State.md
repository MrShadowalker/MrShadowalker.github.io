---
layout: post
title: "AI 全栈前端怎样接任务：TypeScript 状态机、SSE 去重与权限边界"
date: 2026-11-15 09:00:00.000
updated: 2026-11-21 09:00:00.000
permalink: /articles/AI-Fullstack-TypeScript-Task-Client-UI-State.html
comments: true
description: "AI 全栈开发第 20 天：用 TypeScript 和 React 为异步任务建状态机，处理 SSE 去重、断线恢复、提交超时、身份权限和流式渲染，附三道有来源的面试题。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "TypeScript"
  - "React"
  - "SSE"
  - "面试"
---

补刊说明：本文补齐原定第 20 天学习内容；资料与题目于 2026-11-21 检索核验。

第 19 天已经让后端输出有序事件。前端不能只写一个“正在生成”的布尔值：提交请求可能超时但任务已创建，SSE 可能断开后重复投递，用户也可能在权限被撤销时还停留在旧页面。

今天把这些情况写成一个**可检查的 TypeScript 状态机**。熟悉 Java 后端的读者，可以把它看成前端版的任务状态 DTO 与合法迁移表。
<!--more-->

## 一、页面只保存必要状态

界面分为 <code>idle</code>、<code>submitting</code>、<code>running</code>、<code>resyncing</code>、<code>succeeded</code>、<code>failed</code>、<code>forbidden</code>。其中 <code>running</code> 保存 <code>taskId</code>、最后确认的事件序号与尚未完成的展示文本；成功后显示后端确认的最终答案与引用。

~~~typescript
type TaskView =
  | { kind: "idle" }
  | { kind: "submitting"; requestKey: string }
  | { kind: "running"; taskId: string; lastSeq: number; draft: string }
  | { kind: "resyncing"; taskId: string; lastSeq: number }
  | { kind: "succeeded"; taskId: string; answer: string; citations: string[] }
  | { kind: "failed"; taskId: string; code: string; partialDraft: string }
  | { kind: "forbidden"; taskId?: string };
~~~

<code>kind</code> 是判别字段；TypeScript 在分支里能收窄可访问字段。它能防止“已成功但还显示错误提示”之类的非法组合，但**运行时来自网络的 JSON 仍要校验**，静态类型不能替代解析和授权。[TypeScript Handbook：Discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)、[React：Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)（检索日期：2026-11-21）

不要在组件里另存一份可从 <code>TaskView</code> 算出的 <code>isLoading</code>、<code>canCancel</code> 或“当前答案”。否则两个状态更新的先后差异会制造不可能的界面。把状态放在拥有该任务卡片的组件或一个明确的共享 store 中，页面切换时用任务 ID 恢复。

## 二、提交超时不能当成“没创建”

提交请求使用客户端生成的稳定 <code>Idempotency-Key</code>。按钮防抖只减少重复点击，无法处理请求已经到达服务端、响应却丢失的情况。

~~~text
POST /v1/tasks
Idempotency-Key: 0f7b...
→ 202 { "task_id": "task-7", "status": "QUEUED" }

POST /v1/tasks
Idempotency-Key: 0f7b...  （同一请求体重发）
→ 202 { "task_id": "task-7", "status": "RUNNING" }
~~~

若 <code>fetch</code> 超时或用户主动中断，用同一键和同一请求体重发 <code>POST /v1/tasks</code>；服务端返回原任务而不重复创建。服务端应对“同键不同载荷”返回冲突。浏览器的 <code>AbortController</code> 只取消本地请求等待，不能证明服务器回滚了创建任务的数据库事务。[MDN AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)（检索日期：2026-11-21）

## 三、SSE 增量只在序号连续时合并

页面首次进入或刷新时，先读取 <code>GET /v1/tasks/{id}</code> 快照：<code>last_seq</code>、任务状态、当前可展示文本与引用。之后订阅 <code>/events?after=last_seq</code>。重连可能重放，所以按 <code>taskId</code> 和 <code>seq</code> 去重；若发现序号跳跃，停止拼接，重新读快照。

~~~typescript
type UiEvent =
  | { type: "model_delta"; taskId: string; seq: number; text: string }
  | { type: "task_succeeded"; taskId: string; seq: number }
  | { type: "task_failed"; taskId: string; seq: number; code: string };

function applyEvent(view: Extract<TaskView, { kind: "running" }>, ev: UiEvent): TaskView {
  if (ev.taskId !== view.taskId || ev.seq <= view.lastSeq) return view;
  if (ev.seq !== view.lastSeq + 1) {
    return { kind: "resyncing", taskId: view.taskId, lastSeq: view.lastSeq };
  }
  if (ev.type === "model_delta") {
    return { ...view, lastSeq: ev.seq, draft: view.draft + ev.text };
  }
  if (ev.type === "task_failed") {
    return { kind: "failed", taskId: view.taskId, code: ev.code, partialDraft: view.draft };
  }
  // 收到成功事件后拉取权威任务快照，不能仅凭已拼接的分片标记成功。
  return { kind: "resyncing", taskId: view.taskId, lastSeq: ev.seq };
}
~~~

浏览器原生 <code>EventSource</code> 的构造参数只有 URL 和 <code>withCredentials</code> 选项；若使用同源 HttpOnly 会话 Cookie，可按既有认证方式打开流。它不提供自定义 Authorization 请求头参数；Bearer Token 场景需采用受控 <code>fetch</code> 流解析与手动重连，或由后端签发短期、限任务的流凭证，并评估 URL、日志泄露风险。服务端每次连接都要重新鉴权。[WHATWG EventSource 接口](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)（检索日期：2026-11-21）

组件卸载时调用 <code>EventSource.close()</code> 释放连接；<code>error</code> 事件后先查询任务快照，区分暂时断网、任务终态和 <code>403</code>。权限失效时清除当前任务的草稿与引用，不能继续展示缓存的敏感结果。浏览器离开页面不触发任务取消；显式取消按钮才调用后端取消 API。

## 四、流式渲染要保住可读性

模型按 Token 送出的 Markdown 可能半个代码围栏还没闭合。展示草稿时可以按短时间窗口合并增量，先以纯文本或可处理未闭合块的渲染器显示，成功后再渲染经过净化的最终 Markdown。不要用原始模型文本直接填 <code>innerHTML</code>。渲染节流减少每个 Token 都触发全页更新；任务状态和引用仍应在权威事件到达时即时更新。

前端至少做六个可复现 Case：重复 <code>seq</code> 不重复文字；跳号后拉快照；提交超时后同键找回任务；SSE 断线但任务继续；取消后按钮状态正确；权限撤销后旧内容不可见。给每个 Case 保存输入事件、最终 UI 状态和网络调用次数。

## 五、今日面试题（检索日期：2026-11-21）

以下题面来自牛客用户自述，企业归属及面试经历未获官方核验。参考答案与追问为本文工程归纳。

### 1. AI 全栈项目的前后端交互和权限控制如何实现？绕过前端怎么办？

- **方向 / 难度**：前后端契约、权限 / 中高。
- **参考答案**：前端负责输入与状态展示；后端从认证会话确定用户和租户，对任务、会话、事件三类读取及写入逐一授权。前端隐藏按钮只是体验措施，不能作为访问控制。会话 Cookie 设 HttpOnly、Secure、SameSite，并按部署形态处理 CSRF；敏感身份不放在 URL。
- **追问**：用户打开任务页期间被移出租户，已有 SSE 连接如何处理？服务端重新校验或主动断开，前端收到拒绝后清除敏感缓存。
- **来源**：[牛客“字节 AI 全栈开发实习一面”用户自述](https://www.nowcoder.com/feed/main/detail/4d9c64a2a33c4711b22e7cd25970f414)，正文“项目深挖”和 Web 部分；页面显示 07-27。

### 2. React 多组件共享任务状态时，怎样避免状态不一致？

- **方向 / 难度**：React 状态管理 / 中等。
- **参考答案**：让任务卡片或共享 store 持有单一的 <code>TaskView</code>，将任务 ID、状态与游标作为事实；加载标志、可取消按钮等从状态派生。SSE 事件统一经 reducer 应用，按序号去重，组件销毁时关闭订阅。不同页面重新获取任务快照，不依赖旧组件内存。
- **追问**：两个组件同时收到同一 <code>model_delta</code> 时，如何保证文本只追加一次？将去重放在共享状态层。
- **来源**：[牛客“小厂全栈面经”用户自述](https://www.nowcoder.com/feed/main/detail/b7a11a657f574ee6867f8752de0d52c7?sourceSSR=dynamic)，正文第 2–4 题涉及 React 组件与共享状态；作者写明 2026-08-26 面试。**非大厂原题**，用于补足前端基础。

### 3. 用户在接收 SSE 时刷新页面，后端任务会怎样？前端如何恢复？

- **方向 / 难度**：AI 全栈流式交互 / 难。
- **参考答案**：刷新只中断连接，后端按任务状态继续。新页面先读任务快照，再从 <code>last_seq</code> 续订；重连重复事件去重，缺口回快照。最终成功或失败以任务状态为准，不以连接 <code>onerror</code> 判断。
- **追问**：刷新恰好发生在“任务已创建、POST 响应未收到”之间，前端如何找回？持久保存这次提交的请求键并以同键同体重发，让服务端返回原任务；不能生成新键盲目再提交。
- **来源**：[牛客“水滴 AI 全栈一面”用户自述](https://api-cdn.nowcoder.com/feed/main/detail/19a587c7a8ce418fb3b1ee733b05d867?sourceSSR=post)，正文列出刷新、断连、续传追问；页面显示 10-19。该帖列题较多，单场题量无法独立核实。

## 资料与下一步

- [TypeScript Handbook：Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)：判别联合与分支收窄。
- [React：Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)：避免冗余与矛盾状态。
- [WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)：浏览器 EventSource 的连接与重连语义。
- [MDN AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)：浏览器请求中止语义。以上资料检索日期：2026-11-21。

第 21 天做第三周复盘，把任务创建、数据库持久化、Worker、事件流和页面状态放进一场可回放的故障演练。
