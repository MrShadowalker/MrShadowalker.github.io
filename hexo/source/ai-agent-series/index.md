---
layout: page
title: "AI 全栈开发 180 天成长系列"
permalink: ai-agent-series/index.html
comments: true
---

# AI 全栈开发 180 天成长系列

这是一条面向有 Java/后端基础、希望转向 AI 全栈开发的学习与实践路线。每天一篇文章，配套面试题、资料和一个可提交的项目任务；每七天复盘一次，每三十天交付一个阶段项目。

总目标是完成一个企业级 Agent 平台最小实现：它能处理有状态任务，按权限检索知识，调用受控工具，等待人工审批，返回带证据的结果，并能通过评测、trace、成本和审计数据持续运营。

## 每日交付格式

1. 主文章：概念、架构、代码或伪代码、常见坑和实践任务。
2. 面试题：3-5 道，标注方向、难度、参考答案和追问。
3. 资料：优先官方文档、论文、公司技术博客和可核验的公开题目，记录检索日期。
4. 项目提交：代码、测试、架构图、评测样本或复盘记录。

## 六个月路线

| 阶段 | 天数 | 主线 | 阶段产物 |
| --- | ---: | --- | --- |
| 第 1 月 | 1-30 | 模型工程、上下文、Token、Prompt、结构化输出、模型 API、流式与重试 | 统一 `ModelClient` 与最小对话服务 |
| 第 2 月 | 31-60 | Tool Calling、ReAct、Planner、Workflow、Agent Runtime、状态机、记忆、MCP、Pi、Claude Code、ChatGPT Agent | 可恢复的任务型 Agent |
| 第 3 月 | 61-90 | 文档解析、切分、混合检索、重排、权限过滤、引用、知识版本、SQL 与多模态 RAG | 带引用的企业知识助手 |
| 第 4 月 | 91-120 | 模型注册与路由、限流、成本、工具注册中心、租户身份、Prompt 版本、队列、异步、微服务与 K8s | 企业 AI 平台骨架与架构文档 |
| 第 5 月 | 121-150 | 评测集、LLM-as-judge、回归、提示词注入、越权、审批、审计、Trace、灰度、降级、SLA | 评测流水线、安全测试集与监控面板 |
| 第 6 月 | 151-180 | React/Next.js、SSE/WebSocket、后端工程、数据库、缓存、部署、系统设计、项目复盘与模拟面试 | 一个可演示的企业级 Agent 项目 |

## 已完成文章

### 总览

- **Day 1｜[企业级 Agent 全栈开发路线图：从模型调用到可运营平台的 180 天](/articles/AI-Agent-Fullstack-180-Day-Roadmap.html)**
- **Day 2｜[Agent Runtime 怎么设计：状态机、可恢复执行与幂等](/articles/AI-Agent-Runtime-State-Machine.html)**
- **Day 3｜[统一 ModelClient 怎么设计：消息、结构化输出、流式与重试的边界](/articles/AI-ModelClient-Structured-Output-Streaming.html)**
- **Day 4｜[Token 与上下文预算怎么做：从 Prompt 版本、压缩到成本可控](/articles/AI-Token-Context-Budget-Prompt-Version.html)**
- **Day 5｜[Prompt 改一行如何安全上线：Golden Set、回归门槛与灰度](/articles/AI-Prompt-Regression-Golden-Set.html)**

### 已有相关文章

这些文章作为系列的预备材料，分别覆盖架构、平台、工具安全和运营评测：

- [企业级 Agent 不是聊天机器人：从任务闭环设计架构](/articles/Enterprise-Agent-Architecture.html)
- [企业 AI 平台怎么搭：从模型接入到业务闭环的分层设计](/articles/Enterprise-AI-Platform-Layers.html)
- [Agent 工具调用怎么做才安全：权限、审批与审计](/articles/Agent-Tool-Calling-Security.html)
- [Agent 上线前评测什么：从离线样本到线上运维](/articles/Agent-Evaluation-and-Operations.html)
- [知识库能搜到，为什么还是答不准？](/articles/AI-Knowledge-Evidence.html)
- [给 AI 问答做测试：先把错误分清楚](/articles/AI-QA-Evaluation.html)

### 后续目录

后续文章会按下面的顺序追加；每天发布后把当天链接补到对应阶段。

#### 第 1 月：模型工程和服务基础

- Day 2：Agent Runtime 的状态机、可恢复执行与幂等（提前建立后续 Agent 文章的共同状态模型）
- Day 3：[统一 ModelClient、消息、结构化输出、流式与重试的边界](/articles/AI-ModelClient-Structured-Output-Streaming.html)
- Day 4：[Token 与上下文预算、Prompt 版本、压缩、缓存与成本控制](/articles/AI-Token-Context-Budget-Prompt-Version.html)
- Day 5：[Prompt 回归测试、Golden Set、评测门槛与灰度](/articles/AI-Prompt-Regression-Golden-Set.html)
- Day 6：Token 计量与上下文压缩实验
- Day 7：首周复盘与小测
- Day 8-14：Embedding、模型路由、缓存和成本统计
- Day 15-21：Python/TypeScript 服务、异步任务、数据库模型和 API 设计
- Day 22-30：最小对话服务、回归样本、阶段项目一：模型网关

#### 第 2 月：Agent 核心与运行时

- Day 31-37：Tool Calling 与工具契约
- Day 38-44：ReAct、Planner、Workflow 与 Agent 的边界
- Day 45-51：任务状态机、暂停、取消、重试和可恢复执行
- Day 52-56：短期记忆、长期记忆和上下文压缩
- Day 57-60：MCP、Pi、Claude Code、ChatGPT Agent 对照实践与阶段项目二

#### 第 3 月：RAG 与企业数据

- Day 61-67：文档解析、切分、元数据和知识版本
- Day 68-74：向量检索、关键词检索、混合检索与重排
- Day 75-81：租户隔离、权限过滤、引用和证据链
- Day 82-88：SQL、结构化数据和多模态 RAG
- Day 89-90：知识助手发布、回归集和阶段项目三复盘

#### 第 4 月：企业 AI 平台

- Day 91-97：模型注册、路由、限流、配额和成本
- Day 98-104：Agent Runtime、工具注册中心和配置管理
- Day 105-111：租户、身份、权限、Prompt 与策略版本
- Day 112-118：队列、异步执行、微服务与 Kubernetes
- Day 119-120：平台骨架演示和阶段项目四复盘

#### 第 5 月：质量、安全与运营

- Day 121-127：评测集、指标分层和人工标尺
- Day 128-134：LLM-as-judge、回归和线上失败样本
- Day 135-141：提示词注入、越权、敏感数据与工具安全
- Day 142-147：审批、幂等、审计、Trace 和可观测性
- Day 148-150：灰度、降级、SLA、成本面板和阶段项目五复盘

#### 第 6 月：全栈交付与面试

- Day 151-157：React/Next.js、任务列表、流式输出和引用交互
- Day 158-164：SSE/WebSocket、数据库、缓存和前后端错误处理
- Day 165-171：容器、CI/CD、部署、压测和故障演练
- Day 172-176：系统设计、项目讲解、简历要点和行为面试
- Day 177-179：国内大厂专题题库与模拟面试
- Day 180：最终演示、项目复盘和下一阶段计划

## 复习标签

后续面试题统一使用这些标签，便于按主题回顾：`模型基础`、`Prompt`、`结构化输出`、`RAG`、`Agent`、`Tool Calling`、`MCP`、`AI 平台`、`安全`、`评测`、`可观测性`、`系统设计`、`前端与部署`。

## 项目验收标准

- 任务有明确状态，支持暂停、取消、重试和恢复。
- 模型、检索、工具和策略版本可追踪。
- 工具调用经过身份、权限、schema、审批和幂等校验。
- 答案中的关键事实能关联到证据和知识版本。
- 线上运行能看到成功率、延迟、token、工具成本、拒绝和人工接管。
- 每次重要改动都有回归样本和失败案例记录。
