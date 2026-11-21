---
layout: post
title: "做一个能恢复的 AI 对话页面：React、SSE、引用与取消"
date: 2026-11-20 09:00:00.000
updated: 2026-11-21 20:50:00.000
permalink: /articles/AI-Chat-UI-React-SSE-Citations-Cancel.html
comments: true
description: "AI 全栈开发第 25 天，围绕最小对话服务设计 React 页面：稳定的 SSE 事件、断线续读、引用校验、取消、重试和可访问状态。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "React"
  - "TypeScript"
  - "SSE"
  - "前端"
  - "面试"
---

补刊说明：本文补齐原定学习日；资料与题目于 2026-11-21 检索核验。

后端能返回流，不代表用户得到可靠的对话体验。浏览器可能刷新，网络可能断开，模型也可能在写出半句后失败。今天用 React 和 TypeScript 给最小对话服务做一个前端契约：用户能看到生成进度、授权引用、取消结果和明确的失败状态。
<!--more-->

## 一、先分开“创建任务”和“订阅事件”

沿用第 22 天纵向链路：一轮对话消息创建一个 <code>task_id</code>，前端以任务 ID 订阅事件。用户点击停止时调用任务取消 API，随后继续接收终结事件，不能只在浏览器关闭连接。

~~~text
POST /v1/conversations/conv-1/messages
Idempotency-Key: turn-8c0f
→ 202 {message_id, task_id: "task-7", status: "QUEUED"}
GET  /v1/tasks/task-7/events?after=40 → text/event-stream
POST /v1/tasks/task-7/cancel          → 202 {status: "CANCEL_REQUESTED"}
GET  /v1/tasks/task-7                 → 200 {status, last_seq, result?}
~~~

浏览器原生 <code>EventSource</code> 适合单向服务端事件，自动重连时会带上 <code>Last-Event-ID</code>；但它的构造参数只有 URL 和凭据模式，没有任意自定义请求头入口。因此这个示例采用同站点会话 Cookie，鉴权由服务端负责；取消接口另做 CSRF 防护。不能把 API Key 或租户 ID 放在 URL 查询串里。[WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)（检索日期：2026-11-21）

## 二、事件协议要能去重与重放

后端每条**已持久化**事件给一个在 <code>task_id</code> 内严格递增的 <code>seq</code>。SSE 的 <code>id</code> 与 JSON 中的 <code>seq</code> 一致，事件名沿用第 19 天的任务事件：

~~~text
id: 41
event: model_delta
data: {"task_id":"task-7","seq":41,"text":"住宿"}

id: 42
event: citation_added
data: {"task_id":"task-7","seq":42,"evidence_id":"policy-17","label":"差旅政策第 4 条"}

id: 43
event: task_succeeded
data: {"task_id":"task-7","seq":43}

~~~

服务端收到 <code>Last-Event-ID: 41</code> 时，只重放 42 之后的事件，再接实时流。若 41 已过保留期，按第 19 天的约定发 <code>resync_required</code>，让前端拉取任务快照；不能伪装成无缝续传。SSE 的 <code>id</code>、重连和 <code>Last-Event-ID</code> 来自 HTML 标准；“持久化再重放”是本服务为满足可靠续读提出的工程设计。[WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)（检索日期：2026-11-21）

## 三、React 只消费内部事件，不解析供应商流

下面的代码是连接骨架。先从 <code>GET /v1/tasks/{id}</code> 取得 <code>last_seq</code>，再订阅；<code>applyTaskEvent</code> 是纯函数，只接收当前任务、严格递增的事件，终结状态一旦写入就不再接受后续文本。网络 JSON 的 TypeScript 类型断言不能完成运行时校验，因此入口先检查字段。

~~~tsx
const kinds = [
  "model_delta", "citation_added", "task_succeeded",
  "task_failed", "task_cancelled"
] as const;
type Kind = (typeof kinds)[number];
type TaskEvent = {
  task_id: string;
  seq: number;
  kind: Kind;
  text?: string;
  evidence_id?: string;
  label?: string;
};

function parseTaskEvent(kind: Kind, data: string): TaskEvent | null {
  let value: unknown;
  try { value = JSON.parse(data); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.task_id !== "string" ||
      !Number.isSafeInteger(row.seq) || (row.seq as number) < 1) return null;
  if (kind === "model_delta" && typeof row.text !== "string") return null;
  if (kind === "citation_added" &&
      (typeof row.evidence_id !== "string" || typeof row.label !== "string")) {
    return null;
  }
  return {
    task_id: row.task_id, seq: row.seq as number, kind,
    text: typeof row.text === "string" ? row.text : undefined,
    evidence_id: typeof row.evidence_id === "string" ? row.evidence_id : undefined,
    label: typeof row.label === "string" ? row.label : undefined
  };
}

useEffect(() => {
  if (!taskId) return;
  const url = "/v1/tasks/" + encodeURIComponent(taskId) +
    "/events?after=" + initialSeq;
  const stream = new EventSource(url, { withCredentials: true });
  for (const kind of kinds) {
    stream.addEventListener(kind, (message) => {
      const event = parseTaskEvent(kind, (message as MessageEvent).data);
      if (!event || event.task_id !== taskId) {
        stream.close();
        setView((old) => ({ ...old, connection: "PROTOCOL_ERROR" }));
        return;
      }
      setView((old) => applyTaskEvent(old, event)); // 去重、缺口与终态校验
      if (kind.startsWith("task_")) stream.close();
    });
  }
  stream.addEventListener("resync_required", () => {
    void reloadTaskSnapshot(taskId);
  });
  stream.onerror = () => {
    setView((old) => ({ ...old, connection: "RECONNECTING" }));
  };
  return () => stream.close();
}, [taskId, initialSeq]);
~~~

React 官方说明，Effect 的清理会在依赖变化和组件卸载时执行，开发环境 Strict Mode 还会额外跑一次 setup 与 cleanup。因此创建连接与关闭连接必须对称，不要因组件重渲染产生两条订阅。[React useEffect](https://react.dev/reference/react/useEffect)（检索日期：2026-11-21）

<code>applyTaskEvent</code> 的核心条件是 <code>event.seq &gt; view.lastSeq</code>，否则忽略重复事件。事件序号出现缺口时不要直接拼接；标记 <code>SYNCING</code> 并获取服务端快照或重新订阅。<code>task_succeeded</code> 到来后再读权威结果与正式引用。重试生成则创建新 <code>task_id</code>，保留旧回答的“失败/不完整”状态，不在同一气泡内悄悄覆盖。

## 四、引用、取消与无障碍状态

引用只能由服务端返回已授权的 <code>evidence_id</code>，前端用内部文档接口生成链接；不要把模型生成的任意 URL 原样放进 <code>href</code>。流中展示的引用可以先标为“待验证”，只有任务完成且服务端通过证据校验后才显示为正式引用。<code>task_failed</code> 时保留已生成文字，但标注“未完成”，避免用户误当完整答案。

用户点击“停止生成”时，前端先禁用重复点击并展示“正在停止”，发送取消命令；只有收到 <code>task_cancelled</code> 或查询到对应终态才显示“已停止”。关闭 <code>EventSource</code> 只断开浏览器订阅，不能证明上游模型已经停止或停止计费。

用 <code>role="status"</code> 向辅助技术播报“排队中、正在生成、重连中、已完成、已停止”等**低频状态**。不要把每个 Token 都放进 live region，否则读屏会不断被打断。W3C 对 status 消息的说明支持这种状态提示方式。[W3C ARIA status 技术](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)（检索日期：2026-11-21）

### 今天动手的验收

用本地 Fake SSE 服务制造四个场景：先发 1、2 再断线并重放 2、3；第 3 条引用无权限；用户在第 4 条点击停止；服务端在已输出文本后发失败。验收时检查：无重复文本、无越权链接、取消前不宣称已停止、失败有可见标记、键盘可操作且状态可被读屏感知。页面截图只能证明界面出现，事件日志与断线重放记录才证明协议正确。

## 五、今日面试题

以下题面来自公开牛客面经与社区题库，检索日期均为 **2026-11-21**。企业归属只按发帖者自述，未获企业官方核验；社区题库不应冒充大厂原题。参考答案是本文的工程归纳。

### 1. 为何选择基于 Fetch 的 SSE，而不是原生 EventSource 或 WebSocket？

- **方向 / 难度**：前端流式协议选型，中级。
- **参考答案**：仅需服务端推送且能用同站点 Cookie 鉴权时，原生 EventSource 的重连与事件 ID 更省实现；需要自定义请求头、POST 请求体或更细的中止控制时可用 Fetch 流，但必须自己正确解析 SSE 帧并处理重连；频繁双向通信才考虑 WebSocket。本篇的创建任务与订阅分离，所以采用 EventSource。
- **追问**：若企业只接受 Bearer Header，能否把 Token 放入 EventSource URL？不应在 URL 暴露长期令牌；考虑受控 Fetch 流或服务端签发短期、限任务的流凭证，并评估日志泄露。
- **来源**：[牛客“百度前端一面二面”用户自述](https://www.nowcoder.com/feed/main/detail/6211d5f22c8d4904ae220fb82aa29b76)，正文直接提问基于 Fetch 的 SSE 与原生 SSE、WebSocket 取舍；企业归属未经官方确认。

### 2. 模型流把 Markdown 代码块截在半路，页面怎样渲染？

- **方向 / 难度**：AI 对话渲染，中级。
- **参考答案**：流式草稿允许不完整语法，可先显示纯文本或使用容忍未闭合块的增量渲染器，按小时间窗口合并更新；终态后再解析和净化完整 Markdown。代码块、引用链接不能直接拼进 <code>innerHTML</code>。
- **追问**：每个 Token 都重新解析整篇 Markdown，长会话卡顿怎么办？分块缓存已稳定部分、节流渲染并对历史消息做虚拟列表或分页。
- **来源**：[牛客“得物 AI 应用开发二面”用户自述](https://www.nowcoder.com/feed/main/detail/6765348450b3418b98cf3c8d47509ee2?toCommentId=22484113)，正文直接提问未闭合 Markdown 与长聊天滚动；企业归属未经官方确认。

### 3. 用户点击“停止生成”，怎样避免后端继续耗费模型资源？

- **方向 / 难度**：取消语义，较难。
- **参考答案**：取消是任务命令，服务端标记 <code>CANCEL_REQUESTED</code> 并尝试取消上游请求、清理连接和配额；以终态事件确认结果，已产生的 usage 仍入账。浏览器关闭 SSE 不是取消命令。
- **追问**：供应商不支持取消或在取消前已完成，前端怎么表示？展示实际终态与已产生成本，不伪称“零消耗已停止”。
- **来源**：[牛客《80 道 Agent 开发面试题》流式输出题单](https://www.nowcoder.com/feed/main/detail/141ac7489bcc4bfe9f0b979da2eac42a?urlSource=home-api)，公开转发页可直接核对题面；社区整理，非可核验企业原题。

## 资料

- [WHATWG HTML Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [React useEffect](https://react.dev/reference/react/useEffect)
- [W3C ARIA22 status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)

下一篇用前后端、模型网关与任务链路做阶段项目预检，逐个注入失败并保留证据。
