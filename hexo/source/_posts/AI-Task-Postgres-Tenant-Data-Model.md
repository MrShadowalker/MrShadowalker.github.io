---
layout: post
title: "Agent 任务表怎么建：PostgreSQL 租户隔离、事件与用量账本"
date: 2026-11-12 09:00:00.000
updated: 2026-11-21 09:00:00.000
permalink: /articles/AI-Task-Postgres-Tenant-Data-Model.html
comments: true
description: "AI 全栈开发第 17 天：用 PostgreSQL 设计租户级任务、调用尝试、事件和用量表，说明复合外键、RLS、事务与外部调用边界。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "PostgreSQL"
  - "多租户"
  - "Agent Runtime"
  - "面试"
---

补刊说明：本文补齐原定学习日；资料与题目于 2026-11-21 检索核验。

前一天定了任务 API：同键重试必须返回同一个任务，取消要有可查询状态。要兑现这些承诺，任务状态、每次模型调用、事件序号与成本不能只放在进程内存。第 17 天给它们建一套最小 PostgreSQL 数据模型，并把**一个事务能保证什么、不能保证什么**说清楚。
<!--more-->

## 一、四类事实，不要揉成一列 JSON

| 表 | 它回答的问题 | 关键约束 |
| --- | --- | --- |
| <code>ai_task</code> | 用户提交了什么任务，现在到哪一步 | 租户级幂等唯一、状态版本、固定发布版本 |
| <code>ai_attempt</code> | 第几次调用了哪个供应商与模型 | 同一任务 attempt 序号唯一、供应商请求 ID |
| <code>ai_event</code> | 状态如何变化，客户端补播到哪里 | 同一任务事件序号单调递增 |
| <code>ai_usage</code> | 哪次 attempt 消耗多少、是否待对账 | 原始用量保留，计费口径单独归一 |

<code>task_id</code> 是业务任务，<code>attempt_id</code> 是一次下游调用；重试应增加 attempt，不能覆盖前一次的错误和花费。大型原始文档、长 Prompt 与完整工具输出放受控对象存储或专用表，事件中只存脱敏摘要、引用和版本。

## 二、可迁移的最小 DDL

下面是练习用的 PostgreSQL 起点。生产迁移还应补充字段长度、保留期、索引容量规划和正式权限角色。

~~~sql
CREATE TABLE ai_task (
  tenant_id uuid NOT NULL,
  task_id uuid NOT NULL,
  created_by uuid NOT NULL,
  endpoint text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'QUEUED', 'RUNNING', 'RETRY_WAIT', 'CANCEL_REQUESTED',
    'CANCELLED', 'SUCCEEDED', 'FAILED', 'RECONCILING'
  )),
  status_version bigint NOT NULL DEFAULT 0,
  event_seq bigint NOT NULL DEFAULT 0,
  route_release text NOT NULL,
  knowledge_snapshot text NOT NULL,
  budget_reserved_minor bigint NOT NULL DEFAULT 0,
  lease_owner text,
  lease_until timestamptz,
  fence bigint NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, task_id),
  UNIQUE (tenant_id, created_by, endpoint, idempotency_key)
);

CREATE TABLE ai_attempt (
  tenant_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  task_id uuid NOT NULL,
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  provider text NOT NULL,
  requested_model_id text NOT NULL,
  provider_request_id text,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY (tenant_id, attempt_id),
  UNIQUE (tenant_id, task_id, attempt_no),
  FOREIGN KEY (tenant_id, task_id) REFERENCES ai_task (tenant_id, task_id)
);

CREATE TABLE ai_event (
  tenant_id uuid NOT NULL,
  task_id uuid NOT NULL,
  seq bigint NOT NULL CHECK (seq > 0),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, task_id, seq),
  FOREIGN KEY (tenant_id, task_id) REFERENCES ai_task (tenant_id, task_id)
);

CREATE TABLE ai_usage (
  tenant_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  provider_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_tokens bigint,
  output_tokens bigint,
  price_version text,
  cost_minor bigint,
  accounting_state text NOT NULL CHECK (
    accounting_state IN ('PENDING', 'FINAL', 'ESTIMATED')
  ),
  PRIMARY KEY (tenant_id, attempt_id),
  FOREIGN KEY (tenant_id, attempt_id)
    REFERENCES ai_attempt (tenant_id, attempt_id)
);

CREATE INDEX ix_ai_task_tenant_recent
  ON ai_task (tenant_id, created_at DESC);
CREATE INDEX ix_ai_task_due
  ON ai_task (next_run_at) WHERE status IN ('QUEUED', 'RETRY_WAIT');
~~~

复合外键让一个 <code>tenant-a</code> 的 attempt 无法指向 <code>tenant-b</code> 的 task。幂等唯一键放在数据库里，才能在两个 API 实例同时提交时原子裁决；应用层“先查再插”仍有竞争窗口。PostgreSQL 官方说明唯一约束由唯一索引实施，<code>INSERT ... ON CONFLICT</code> 可处理冲突。[PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)、[INSERT](https://www.postgresql.org/docs/current/sql-insert.html)（检索日期：2026-11-21）

## 三、RLS 是第二道隔离层

API 查询仍要带可信 <code>tenant_id</code> 条件；在数据库上再加行级安全策略，防止某处漏写过滤条件。下面只展示 <code>ai_task</code>；同样的策略必须覆盖 attempt、event、usage，不能只保护主表。

~~~sql
ALTER TABLE ai_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_task FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_task_tenant_scope ON ai_task
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

BEGIN;
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-00000000000a', true);
SELECT task_id, status FROM ai_task
 WHERE tenant_id = '00000000-0000-0000-0000-00000000000a';
COMMIT;
~~~

<code>set_config(..., true)</code> 只在当前事务内生效，适合连接池复用；租户值必须来自已经验证的服务端身份，不能直接使用请求体。未设置变量时策略表达式得不到 true，应看不到行。数据库应用角色不能是 superuser、<code>BYPASSRLS</code> 角色或可随意拥有该表的高权限角色；表所有者通常会绕过 RLS，<code>FORCE ROW LEVEL SECURITY</code> 可改变表所有者的默认行为。唯一和外键约束也可能形成侧信道，所以跨租户“找不到”与“已存在”的错误不能直接暴露内部细节。[PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)、[System Administration Functions](https://www.postgresql.org/docs/current/functions-admin.html)（检索日期：2026-11-21）

RLS 是纵深防御，不能代替应用鉴权。尤其对超级管理员、迁移任务与后台 worker，要单独定义权限角色和审计。

## 四、事务要短，供应商调用留在事务外

提交事务：验证幂等键和请求指纹，创建 <code>ai_task</code> 与第一条 <code>ai_event</code>，固定知识快照和路由发布，再提交。若成本预留与任务共用一个数据库，可在这笔事务里一起完成；若成本账本位于另一个服务，就不能声称本地事务覆盖它，需预留协议与对账。

执行事务：worker 条件领取任务，增加 <code>fence</code>、设置租约，创建 <code>ai_attempt</code>，然后提交。**调用模型或工具时不要持有数据库事务。**网络调用结束后再开启短事务，校验当前 <code>fence</code> 与状态版本，写入 attempt 结果、原始 usage、任务状态和事件；回执不明则记录 <code>PENDING</code> 用量与 <code>RECONCILING</code>，不得编造零成本。

任务事件序号可在写事件的同一事务中执行：

~~~sql
UPDATE ai_task
   SET event_seq = event_seq + 1,
       status_version = status_version + 1
 WHERE tenant_id = :tenant_id AND task_id = :task_id
 RETURNING event_seq, status_version;
~~~

使用返回的 <code>event_seq</code> 插入事件，并在同一事务提交。两个并发 writer 会在同一 task 行上串行；若更新附带期望状态和版本条件，失败时重新读取，不能静默覆盖。

## 五、今天的练习与验收

在本地 PostgreSQL 跑 DDL，至少测：同租户并发同键只保留一条任务；不同租户可复用相同键；跨租户 attempt 外键失败；RLS 未设置租户时无行可见；两个并发更新同一任务时只有一个状态版本成功；模型调用失败仍留下 attempt 和待对账用量。报告要写出实际 SQL 结果和事务边界图，不用声称已做真实负载压测。

## 六、今日面试题（检索日期：2026-11-21）

题面可在牛客公开页面核对；企业名称来自发帖者或标题，未获企业官方验证。第三题是依据官方文档编写的经典追问，并非企业原题。

### 1. 数据库存储会不会出现先后写入、相互覆盖？

- **方向 / 难度**：Agent 状态存储、并发事务 / 难。
- **参考答案**：会。两个执行器读到同一旧版本后都写回，后写者可能覆盖先写者。按任务维护 <code>status_version</code>，使用条件更新或行锁；事件追加写，不能只保存最终 JSON。状态冲突要重新加载并按合法状态机判定。
- **追问**：worker 租约过期但旧 worker 仍返回成功，版本条件够吗？还要用递增 fencing token 阻止旧持有者提交。
- **来源**：[牛客“快手大模型 Agent 研发一面”用户自述](https://www.nowcoder.com/discuss/932315325276618752?sourceSSR=dynamic&weFlow=true)，正文列出存储覆盖与 Fencing Token；公司归属未获官方核验。

### 2. 同一会话同时收到两次请求，怎样防止状态覆盖？

- **方向 / 难度**：数据库模型、会话并发 / 中高。
- **参考答案**：会话状态用版本条件更新；对必须串行的会话，将消息按会话键进入同一分区或短事务行锁。新请求并非一定要拒绝，但不能让两个请求各自基于旧状态提交。跨租户和跨会话键必须独立。
- **追问**：乐观锁失败后能直接重放一次带外部副作用的工具吗？不能，先检查操作账本和下游回执。
- **来源**：[牛客“智象未来 Agent 开发一面”公开整理帖](https://www.nowcoder.com/discuss/912836825348116480?sourceSSR=home)，公开正文有该题；作者真实性和公司归属无法独立核验。

### 3. 开启 PostgreSQL RLS 后，表所有者或唯一约束会不会绕过隔离？

- **方向 / 难度**：多租户数据安全 / 难。
- **参考答案**：默认表所有者通常不受 RLS 限制，superuser 与 <code>BYPASSRLS</code> 角色也会绕过；可对表所有者启用 <code>FORCE ROW LEVEL SECURITY</code>，并让应用连接使用低权限非所有者角色。唯一键和外键完整性检查会绕过行策略，所以错误消息需要做应用层统一处理。
- **追问**：连接池上一请求设置的租户变量会泄漏到下一请求吗？使用事务局部设置并始终在事务内访问，做跨租户回归测试。
- **来源**：[PostgreSQL Row Security 官方文档](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)；**本系列自编经典题，不是已核验的大厂原题**。近期公开面经中未找到能直接核验该细节的企业题面，因此用官方规范构题。

## 资料与下一步

- [PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)：行级策略、角色例外和约束侧信道。
- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)：唯一冲突和返回结果。
- [PostgreSQL System Administration Functions](https://www.postgresql.org/docs/current/functions-admin.html)：事务局部 <code>set_config</code>。资料检索日期均为 2026-11-21。

第 18 天让 worker 从持久化任务中领取工作，处理消息重复、进程崩溃和“任务落库成功却没有发出消息”的窗口。
