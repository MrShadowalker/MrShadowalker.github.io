---
layout: post
title: "AI 服务第一层怎么写：用 FastAPI 跑通租户、检索、路由与 Trace"
date: 2026-11-10 09:00:00.000
updated: 2026-11-21 09:00:00.000
permalink: /articles/AI-Fullstack-FastAPI-Service-Contract.html
comments: true
description: "AI 全栈开发第 15 天：用一个可运行的 FastAPI 夹具，把认证租户、知识检索、模型能力路由、预算准入和 Trace 串成后端请求链。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "FastAPI"
  - "多租户"
  - "模型网关"
  - "面试"
---

补刊说明：本文补齐原定学习日；资料与题目于 2026-11-21 检索核验。

前两周分别定义了 Runtime、ModelClient、检索、路由、预算和模型注册表。第 15 天把这些契约放进一个真的 HTTP 入口。目标不是再画一张“平台分层图”，而是让两个租户用同一句问题请求服务时，能看见各自的证据与 trace，并且无权访问另一方数据。

本文的代码使用本地假模型和假检索器，不需要 API Key；它验证的是**服务控制流**。真正的身份系统、并发预算和持久化任务会在接下来的文章补上。
<!--more-->

## 一、先确定一条请求的责任边界

~~~text
HTTP 请求
  → 认证依赖：从受信凭据得到 principal / tenant_id
  → 业务用例：验证任务与权限
  → Retriever：只读当前租户可见证据
  → Registry / Router：检查能力，选择模型条目
  → Budget：决定能否发起一次调用
  → ModelClient：生成或在本地夹具中返回固定结果
  → Verifier：引用必须来自授权证据
  → Trace：记录各层决策和版本，不记录明文密钥
~~~

熟悉 Spring Boot 的读者可以把 FastAPI 的依赖函数理解为请求级注入入口，把 Pydantic 请求模型理解为 DTO，把业务用例保留在路由函数外。FastAPI 官方文档说明请求体可由 Pydantic 模型验证，依赖函数可复用请求上下文；这两点是本文选择它做短练习的依据。[FastAPI Request Body](https://fastapi.tiangolo.com/tutorial/body/)、[Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)（检索日期：2026-11-21）

**租户 ID 不从请求体读取。** 请求体里的 <code>tenant_id</code> 是用户可改的输入；生产服务应从认证票据和授权服务得到租户范围，并在检索、缓存、预算、日志查询中传递同一上下文。

## 二、一个可以本地运行的最小服务

将下面内容保存为 <code>app.py</code>，在 Python 3.11+ 环境安装 <code>fastapi</code> 与 <code>uvicorn</code>，运行 <code>uvicorn app:app --reload</code>。这段代码故意只演示内存夹具，不能直接部署到生产。

~~~python
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="AI fullstack Day 15 fixture")

TOKENS = {"demo-a": "tenant-a", "demo-b": "tenant-b"}
DOCS = [
    {"tenant_id": "tenant-a", "id": "a-policy-v3",
     "text": "A 租户住宿上限为 600 元。"},
    {"tenant_id": "tenant-b", "id": "b-policy-v2",
     "text": "B 租户住宿上限为 450 元。"},
]
REGISTRY = {
    "fixture-model-v1": {
        "structured_output": True,
        "tenants": {"tenant-a", "tenant-b"},
    }
}
BUDGET_MINOR = {"tenant-a": 30, "tenant-b": 30}
TRACE = []  # 夹具 trace；生产环境应落脱敏 span

class Principal(BaseModel):
    tenant_id: str

class Ask(BaseModel):
    question: str = Field(min_length=1, max_length=500)

class Answer(BaseModel):
    answer: str
    citation_ids: list[str]
    model_id: str
    trace_id: str

def principal(
    authorization: Annotated[Optional[str], Header()] = None,
) -> Principal:
    token = authorization.removeprefix("Bearer ") if authorization else ""
    tenant_id = TOKENS.get(token)
    if tenant_id is None:
        raise HTTPException(status_code=401, detail="UNAUTHENTICATED")
    return Principal(tenant_id=tenant_id)

def retrieve(tenant_id: str) -> list[dict]:
    return [d for d in DOCS if d["tenant_id"] == tenant_id]

def route(tenant_id: str, required: str) -> str:
    for model_id, caps in REGISTRY.items():
        if caps.get(required) and tenant_id in caps["tenants"]:
            return model_id
    raise HTTPException(status_code=503, detail="NO_CAPABLE_MODEL")

def reserve(tenant_id: str, estimated_minor: int) -> None:
    if BUDGET_MINOR[tenant_id] < estimated_minor:
        raise HTTPException(status_code=429, detail="BUDGET_EXCEEDED")
    BUDGET_MINOR[tenant_id] -= estimated_minor

@app.post("/v1/answers", response_model=Answer)
def answer(body: Ask, user: Annotated[Principal, Depends(principal)]):
    trace_id = uuid4().hex
    evidence = retrieve(user.tenant_id)
    if not evidence:
        raise HTTPException(status_code=404, detail="NO_AUTHORIZED_EVIDENCE")
    model_id = route(user.tenant_id, "structured_output")
    estimated_minor = 5  # 夹具价格，不是真实供应商计费
    reserve(user.tenant_id, estimated_minor)
    # FakeModelClient：只回显本租户的授权证据。
    chosen = evidence[0]
    TRACE.append({
        "trace_id": trace_id, "tenant_id": user.tenant_id,
        "model_id": model_id, "evidence_id": chosen["id"],
    })
    return Answer(
        answer=chosen["text"], citation_ids=[chosen["id"]],
        model_id=model_id, trace_id=trace_id,
    )
~~~

~~~bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install fastapi uvicorn
uvicorn app:app --reload
curl -s -H 'Authorization: Bearer demo-a' \
  -H 'Content-Type: application/json' \
  -d '{"question":"本月住宿上限是多少？"}' \
  http://127.0.0.1:8000/v1/answers
~~~

把 <code>demo-a</code> 换成 <code>demo-b</code>，应得到 <code>b-policy-v2</code>，而不是 <code>a-policy-v3</code>。去掉授权头应返回 401。<code>question</code> 暂时只触发输入校验；假模型没有语义理解能力，不能把这次演练称为真实 RAG 质量评测。

## 三、让夹具逐步变成服务

| 当前夹具 | 下一步生产边界 |
| --- | --- |
| 内存 token 映射 | 验签、失效与租户成员授权；不能让客户端声明租户 |
| 内存文档列表 | 文档 ACL、知识快照、检索前过滤与引用复核 |
| 只看一个能力标志 | 模型注册表、端点参数、账号可用性和发布版本 |
| 内存预算减法 | 数据库原子预留、每次 attempt 结算与对账 |
| 一个响应里的 trace_id | 可查询的脱敏 span、版本和错误分类 |

尤其不能把 Python 模块级字典当作跨进程的共享账本：多 worker 会有多份状态，进程重启会丢失预算，两个并发请求也可能同时通过余额检查。第 17 天会用数据库事务替换这一层。若服务要执行数十秒任务，入口应只提交任务并返回任务 ID；HTTP 202 的含义是“已接收但尚未完成”，并不保证后来一定成功。[RFC 9110 §15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3)（检索日期：2026-11-21）

## 四、今天的实践与验收

1. 跑通 A、B 两租户同 Query，记录响应中的引用 ID 和 trace ID。
2. 注入第三个没有凭据的请求，确认无检索或模型调用。
3. 把 A 的预算降到 0，确认拒绝发生在调用前；再写出为什么这个内存实现仍无法保证并发安全。
4. 画出 Java 版 Controller、Service、Repository 与 Python 版 API、用例、适配器的对应关系；指出哪个层负责授权、哪个层负责引用复核。

提交证据应包含请求与响应、至少一条跨租户拒绝夹具、以及一页“生产缺口”清单。不要只截 Swagger 页面。

## 五、今日面试题（检索日期：2026-11-21）

题面来自可直接查看正文的牛客公开内容。公司归属仅为发帖者自述，未获企业官方核验；下述答案和追问是本文的工程整理。

### 1. 一个 Query 从进入 Agent 服务到输出结果，完整链路怎样讲？

- **方向 / 难度**：AI 应用后端、系统设计 / 中高。
- **参考答案**：从认证身份和租户开始，依次说明意图与任务创建、授权检索、能力路由、预算和限流、模型或工具调用、输出校验、事件和 trace。每层给出输入、输出与失败状态，不能只罗列框架名。
- **追问**：模型输出了别的租户的证据 ID，在哪两层拦截？检索前授权和响应引用复核都要做。
- **来源**：[牛客“快手 AI 全栈开发一面”用户自述](https://www.nowcoder.com/discuss/942822898094428160?sourceSSR=dynamic&weFlow=true)，原帖直接列出该题；企业归属未获官方核验。

### 2. FastAPI 接口和数据库层如何分工？为何不能把同步数据库调用直接塞进 async 路由？

- **方向 / 难度**：Python 服务、数据库连接 / 中高。
- **参考答案**：API 解析和鉴权，业务层决定状态，用请求级数据库会话完成事务；同步驱动会阻塞事件循环，选同步路由配线程池，或全链路异步驱动与独立 AsyncSession。模型网络调用不应占着数据库事务。
- **追问**：多个并发子任务能共享一个 AsyncSession 吗？不能，共享有状态会话会让事务和连接使用混乱。
- **来源**：[牛客“美团 AI Agent 一面”社区模拟整理帖](https://www.nowcoder.com/discuss/950796586802479104?sourceSSR=post)，标题明确为“三年面试五年模拟”，**不是可核验的美团原题**。

### 3. 多 Agent 之间的上下文如何隔离？

- **方向 / 难度**：多租户 Agent、上下文安全 / 难。
- **参考答案**：为每次任务传显式 <code>tenant_id / principal_id / task_id</code>，子 Agent 仅拿完成当前步骤需要的授权证据与工具，持久化记录按租户和任务分区；缓存键带权限和版本，不能共享可变全局上下文。模型不能自行提升权限。
- **追问**：同一用户同时在两个租户工作，如何保证切换后旧任务仍按原租户审计？任务创建时固定授权上下文版本，并在敏感操作前重新验证。
- **来源**：[牛客“快手 AI 全栈一面”用户自述](https://www.nowcoder.com/discuss/947982288917110784?sourceSSR=enterprise)，正文列出“多 Agent 之间上下文怎么隔离”；企业归属未获官方核验。

## 资料与下一步

- [FastAPI 请求体](https://fastapi.tiangolo.com/tutorial/body/)与[依赖注入](https://fastapi.tiangolo.com/tutorial/dependencies/)：输入模型、请求级依赖。
- [RFC 9110 HTTP 202](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3)：异步任务接收语义。资料检索日期均为 2026-11-21。

第 16 天把这个同步夹具的入口收敛成可长期维护的任务 API：状态码、幂等键、错误契约和取消语义。
