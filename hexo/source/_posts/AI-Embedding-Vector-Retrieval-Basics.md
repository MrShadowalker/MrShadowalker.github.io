---
layout: post
title: "Embedding 不只是相似度：向量检索的输入、召回与评测基础"
date: 2026-11-03 09:00:00.000
updated: 2026-11-03 09:00:00.000
permalink: /articles/AI-Embedding-Vector-Retrieval-Basics.html
comments: true
description: "AI 全栈开发第 8 天，从 Embedding 契约、结构化切片、向量与 BM25 混合召回、RRF、重排到 Recall@K 和端到端评测，搭一条能排错、能迁移、能面试的检索链路。"
categories:
  - "AI工程"
tags:
  - "AI全栈"
  - "Embedding"
  - "RAG"
  - "向量检索"
  - "面试"
---

第 7 天把模型调用、任务状态、预算和评测接成了闭环。今天进入第 1 月的第二段：Embedding、模型路由、缓存和成本统计。先把最容易被一句“算余弦相似度”带过的部分讲清楚：Embedding 是检索系统的输入契约，向量库只是执行近邻搜索的基础设施，最终是否答对要由证据和评测证明。

本文只做向量检索的基础，不把它冒充完整 RAG 项目。第 3 月会继续补文档版本、权限、引用、SQL 和多模态数据；今天先交付一条可以在本地重放和定位问题的检索链路。
<!--more-->

## 1. 先建立一个判断：相似不等于正确

Embedding 模型把一段文本映射成固定维度的向量。向量距离可以帮助我们找到语义相近的候选，但它不能直接回答下面这些问题：

- 文档是否属于当前租户，当前用户是否有权限看到？
- 条款是否已经生效，版本是否比当前索引更新？
- 一段文本是否在切分时丢了标题、否定词、表头或代码上下文？
- 候选证据是否真的支持答案，而不是“看起来相似”？
- 结果是否值得付出额外的检索延迟和上下文 Token？

所以，生产中的检索记录至少要能回答：

~~~text
这次查询使用了哪个 embedding 模型、哪一版索引、哪种距离？
召回前做了什么租户/权限/版本过滤？
候选来自 dense、BM25 还是两者融合？
重排前后哪些文档发生了位置变化？
最终送进模型的证据有哪些，为什么被截断？
这次命中、拒答、引用错误和延迟分别是多少？
~~~

OpenAI 的 Embeddings 文档把向量用于语义检索，并说明归一化向量可以用余弦相似度或点积得到相同排序；同一文档还给出了通过 <code>dimensions</code> 缩短向量的成本与效果折中。[OpenAI Embeddings](https://developers.openai.com/api/docs/guides/embeddings)（检索日期：2026-11-03）

这不意味着“维度越大越好”。维度、模型版本、归一化方式和距离函数共同构成索引契约。换了其中任何一个，都要把它当成一次索引迁移来处理，而不是直接覆盖线上字段。

## 2. Embedding 契约：把隐含假设写成字段

建议给每个向量索引保存一份不可变配置：

~~~json
{
  "embedding_model": "text-embedding-3-small",
  "embedding_model_version": "2026-01",
  "dimensions": 1536,
  "metric": "cosine",
  "normalized": true,
  "language": ["zh", "en"],
  "max_input_tokens": 8191,
  "chunk_policy": "markdown-heading-v2",
  "index_version": "kb-policy-2026-11-03-v4"
}
~~~

每个 Chunk 记录自己的身份和过滤字段：

~~~json
{
  "chunk_id": "doc-017#p4#c02",
  "doc_id": "doc-017",
  "tenant_id": "tenant-a",
  "acl": ["finance", "manager"],
  "knowledge_version": "policy-2026-10",
  "title_path": ["退款政策", "审批条件"],
  "source_span": {"page": 4, "start": 120, "end": 338},
  "text": "金额超过 500 元时，需要二级审批……",
  "embedding_model": "text-embedding-3-small",
  "embedding_dimensions": 1536,
  "created_at": "2026-11-03T00:10:00Z"
}
~~~

这里有三个容易漏掉的边界：

1. <strong>模型和索引版本必须可追踪。</strong> 新模型上线时先双写到 <code>index-v5</code>，用固定查询集比较，再切读流量；出现回归可以切回旧索引。
2. <strong>权限过滤要和召回绑定。</strong> 先把不该看的文档送进模型，再靠 Prompt 让模型“别使用”，已经晚了。租户、角色、地域、数据密级和知识版本要在每一路召回前或召回过程中生效。
3. <strong>分数不能跨模型直接比较。</strong> 旧模型的 0.82 和新模型的 0.82 不是同一把尺子。迁移时比较的是同一批问题的命中和排序指标，不是原始分数大小。

## 3. 离线入库：切片质量决定候选上限

一个最小的离线流程如下：

~~~text
原始文件
  → 解析（PDF/Markdown/HTML/表格/代码）
  → 清洗（去导航、重复页眉、无意义空白）
  → 结构化切片（标题、段落、条款、函数、表格行）
  → 补充标题路径与来源位置
  → 生成 embedding
  → 写入向量索引与元数据
  → 记录 index_version、失败原因和重试次数
~~~

固定字符数切片可以快速做 Demo，但上线前至少要做一次结构化对照：

| 文档类型 | 优先边界 | 常见风险 |
| --- | --- | --- |
| 产品说明 | 标题、段落、步骤 | 一步被切到下一片，前置条件丢失 |
| 规章条款 | 条、款、例外条件 | “不得”“除非”等否定和例外分离 |
| 表格 | 表头 + 行，必要时复制关键列 | 只有单元格没有列名，语义不完整 |
| 代码 | 文件、类、函数、注释 | 函数体和调用约束被拆开 |
| 工单与日志 | 时间、服务、错误码、上下文窗口 | 只留错误行，丢掉前后因果 |

<code>chunk_size</code> 和 <code>overlap</code> 没有跨业务通用的答案。片段太小，会把实体、条件和动作拆开；片段太大，会让候选的主题密度变低，后面的重排和上下文预算也更难控制。可先用 256、512、1024 Token 三档做实验，再按问题类型看结果。重叠区只解决边界连续性，不能弥补错误的文档结构。

每个 Chunk 还应该保留 <code>source_span</code>。它让后续的引用、人工复核和坏案例回放有据可查；只保存一段无来源的文本，检索答对了也很难证明为什么答对。

## 4. 在线检索：过滤、召回、融合、重排、截断

在线链路建议明确分成五步：

~~~text
Query 规范化/改写
  → 身份、租户、ACL、知识版本过滤
  → dense 向量召回 + BM25/关键词召回
  → RRF 或加权融合
  → Cross-Encoder/规则重排
  → 去重、相邻片段扩展、按上下文预算截断
~~~

### 4.1 Query 不是一定要原样向量化

用户说“怎么退款”，文档可能写“取消订单并退回金额”；用户说“E1007”，文档里可能只出现错误码和服务名。可以记录原始 Query，再按风险和延迟预算选择：

- 补全实体、时间、产品名和约束；
- 将口语改写成更适合检索的短句；
- 对多个意图拆成多个子 Query；
- 对专业编号保留原词，不要被改写成泛化描述。

改写本身也是一次模型调用，要记录版本、耗时和失败情况。如果改写让精确术语消失，结果可能比原 Query 更差，所以必须把原 Query 和改写 Query 一起放进离线对照。

### 4.2 Dense 与 BM25 为什么要同时存在

Dense 检索擅长同义表达和语义相近，例如“手机”与“iPhone”；BM25 或其他稀疏检索擅长错误码、SKU、函数名、条款编号和专有名词。企业知识库常常同时包含自然语言和精确标识符，只用其中一路会放大另一类错误。

两路先各取较大的候选集，再融合。一个简单的 Reciprocal Rank Fusion（RRF）写法是：

~~~text
RRF(d) = Σ 1 / (k + rank_i(d))
~~~

其中 <code>rank_i(d)</code> 是文档在第 i 路结果中的名次，<code>k</code> 是平滑常数。RRF 使用排名而不是直接相加原始分数，避免不同检索器的分数尺度不可比。候选集太小，正确文档没有进入任何一路，融合和重排都找不回来；因此 <code>candidate_top_n</code> 应通过离线集测试，而不是拍一个固定数字。

OpenAI Retrieval 文档也把语义检索、属性过滤、分数阈值和 hybrid search 的权重作为独立配置；Milvus 的检索文档则将过滤、混合检索和重排列为提升召回与相关性的不同手段。[OpenAI Retrieval](https://developers.openai.com/api/docs/guides/retrieval)；[Milvus Basic Vector Search](https://milvus.io/docs/single-vector-search.md)（均检索于 2026-11-03）

### 4.3 重排不是“再算一次相似度”

Embedding 召回通常是双塔：Query 和文档分别编码，适合快速扫描大候选集。Cross-Encoder 会把 Query 和候选文本一起输入，能看更细的词序、条件和交互，通常更适合把 20～100 条候选精排成最终的 3～8 条，但它更慢、更贵。

所以要把重排当成一个有门槛的实验：

- 只对足够小的候选集批量调用；
- 比较重排前后的 Recall@K、MRR/nDCG、端到端答案正确率；
- 单独记录 P95 延迟、额外 Token 和模型费用；
- 对低风险闲聊或空检索结果，可以跳过重排；
- 重排不能替代权限过滤，也不能把候选集之外的证据“变出来”。

### 4.4 最后一步是上下文预算，不是无脑塞 Top-K

排序后还要做去重、相邻片段扩展、证据分组和长度预算。最终送给生成模型的内容应带上：

~~~text
chunk_id / title_path / knowledge_version / source_span / text
~~~

如果一条答案需要同一文档的前后两片，可以按 <code>doc_id</code> 合并或补邻居；如果多条候选几乎相同，可以用 MMR 或简单去重减少冗余。任何截断都要记录，方便解释“为什么召回到了但答案里没有用到”。

## 5. 评测拆开做：先问有没有证据，再问答案好不好

一个端到端“答对率”无法告诉你问题发生在哪一层。建议至少保留三层指标：

### 5.1 召回层

给每个 Query 标注一个或多个 gold <code>chunk_id</code>：

- <strong>Recall@K：</strong>前 K 个候选中是否包含至少一个正确证据，或命中的 gold 数量占比。
- <strong>Hit@K：</strong>常用于“首个关键证据是否进入前 K”。
- <strong>MRR：</strong>第一个正确证据排名越靠前，倒数排名越高。
- <strong>nDCG@K：</strong>适合有多级相关性标注的场景，例如“直接支持”“部分支持”“无关”。

### 5.2 证据与生成层

- 证据覆盖率：答案需要的事实有多少能在引用片段中找到。
- 引用一致性：答案里的条款号、日期、金额和结论是否被对应片段支持。
- 无证据拒答率：知识库没有答案时，系统是否明确说不知道。
- 端到端正确率：固定评分规则或人工标尺判断答案是否满足任务。

### 5.3 工程层

- P50/P95 检索与重排延迟；
- 每次查询的 embedding、重排和生成成本；
- 过滤拒绝、空召回、超阈值、超预算和降级比例；
- 索引版本命中率、增量更新延迟和删除后的旧结果残留时间。

OpenAI 的评测建议强调为真实任务建立代表性数据集、记录中间结果并持续回归；其检索示例也同时计算 Recall、Precision、MRR 和 MAP。[Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)；[PDF File Search evaluation example](https://developers.openai.com/cookbook/examples/file_search_responses)（检索日期：2026-11-03）

## 6. 一个 90 分钟的本地实验

不接真实业务数据，拿 30 条脱敏的“问题 → gold chunk”样本就够开始。每条样本记录：

~~~json
{
  "query_id": "q-017",
  "query": "金额超过 500 元需要谁审批？",
  "gold_chunk_ids": ["policy-v4#refund#approval-02"],
  "query_type": "条款+金额",
  "must_preserve": ["500", "审批"]
}
~~~

按下面的矩阵跑一轮：

| 实验变量 | 候选值 |
| --- | --- |
| 切片 | 256 / 512 / 1024 Token |
| 召回 | dense / BM25 / dense+BM25 |
| 融合 | RRF，或归一化后加权 |
| candidate_top_n | 20 / 50 / 100 |
| 重排 | 关闭 / Cross-Encoder |
| final_top_k | 3 / 5 / 8 |

每个组合至少保存：

~~~text
query_id
index_version
retriever_config
candidate_chunk_ids
final_chunk_ids
gold_hit
first_gold_rank
rerank_latency_ms
context_tokens
answer_score
failure_label
~~~

失败标签不要只写“答错”，建议区分：

- <code>PARSE_LOSS</code>：解析或清洗丢信息；
- <code>CHUNK_BREAK</code>：切片切断条件或标题；
- <code>EMBEDDING_MISS</code>：正确证据不在 dense 候选；
- <code>LEXICAL_MISS</code>：精确编号没被关键词路召回；
- <code>ACL_FILTER</code>：权限或租户过滤造成可解释的空结果；
- <code>RERANK_DROP</code>：正确候选在重排后掉出窗口；
- <code>CONTEXT_TRUNCATE</code>：证据被预算截断；
- <code>GENERATION_ERROR</code>：证据正确但模型回答错误。

先用一个固定矩阵找到最早偏差，再改一个变量。不要同时更换切片、Embedding、向量库和 Prompt，否则结果变好了也不知道哪一步起作用。

## 7. 面试题：把“会 RAG”说成可验证的工程能力

下面的题目来自牛客公开用户面经或题库整理，检索日期均为 **2026-11-03**。帖子内容是个人自报或社区汇总，**不是企业官方发布的题库**；公司和岗位标签应当在面试前再次核验。回答模板统一按“结论 → 机制 → 取舍 → 如何验证”组织。

### 题 1：为什么 BM25 和向量检索要一起用？如何融合？

- **方向：** RAG / Embedding / 检索架构
- **难度：** 中高
- **题面来源：** 牛客用户整理的字节 AI Agent 开发岗面经（帖子自报面试时间 2026-09-23）：[题面链接](https://www.nowcoder.com/discuss/940040254214389760?sourceSSR=dynamic&weFlow=true)
- **参考答案：** BM25 擅长错误码、编号、SKU、函数名等精确词，dense 擅长同义表达和语义近邻。两路并行扩大候选，再用 RRF 或经过校准的加权分数融合；不能直接把两路原始分数相加，因为尺度和分布不同。融合后再用 Cross-Encoder 对有限候选精排，最后按权限、证据和上下文预算截断。
- **追问：** <code>candidate_top_n</code> 和 RRF 的 <code>k</code> 怎么定？如何用 Recall@K、nDCG、P95 和端到端正确率证明 hybrid 值得上线？

### 题 2：RAG 召回不准，怎么排查？向量库怎么选？

- **方向：** RAG 评测 / 向量数据库 / 线上排障
- **难度：** 高
- **题面来源：** 牛客用户整理的阿里 AI 应用开发岗面经（帖子自报面试时间 2026-04-26）：[题面链接](https://www.nowcoder.com/discuss/923740158455730176?urlSource=home-api)
- **参考答案：** 先固定 Query、索引版本和评分规则，沿链路检查解析、切片、Embedding、租户过滤、候选召回、融合、重排、上下文截断和生成。区分“正确证据没有召回”和“证据召回了但模型没用好”。向量库按数据量、QPS/P95、过滤能力、持久化、扩展、备份和运维成本选；已有 PostgreSQL 可以先用 pgvector，规模和检索形态变化后再评估专用向量库。
- **追问：** 如何做索引双写、固定查询回放和回滚？删除文档后短时间还召回旧片段，怎样处理最终一致？

### 题 3：稠密和稀疏向量有什么区别？Chunk、距离和 Top-K 怎么取舍？

- **方向：** Embedding 基础 / 检索参数
- **难度：** 中高
- **题面来源：** 牛客用户整理的字节大模型算法岗面经（帖子自报面试时间 2026-04-01）：[题面链接](https://www.nowcoder.com/discuss/922308546966847488?sourceSSR=dynamic&weFlow=true)
- **参考答案：** 稠密向量更擅长表达语义相似，稀疏检索更擅长词项、编号和可解释匹配。切片要保护标题、条件、表头和代码边界，overlap 只是减少边界损失；归一化向量下 cosine 和 dot 的排序可以一致。Top-K 太小会漏证据，太大会引入噪声、增加重排延迟和生成 Token，应该在标注集上按问题类型分桶实验。
- **追问：** 如果正确证据没进 Top-50，应该先调重排还是先查切片和 Query？如何证明改动没有只修好一条样本？

### 题 4：RAG 答错了，要先换 Embedding 模型吗？

- **方向：** RAG 错误定位 / 评测闭环
- **难度：** 中高
- **题面来源：** 牛客用户发布的 Agent 面试练习帖，题目为“RAG 答错，先检查什么”（发布于 2026-10-28）：[题面链接](https://www.nowcoder.com/discuss/945054074511032320?sourceSSR=post)
- **参考答案：** 不要先换模型。先确认权威文档、适用日期和权限，再看解析是否漏内容、切片是否断开、正确证据是否进入候选、重排是否误杀、上下文是否被截断，最后才判断 Embedding 是否是根因。用同一问题集、同一索引和同一评分规则一次只改一个环节；同时记录中间候选和最终引用，才能把线索变成证据。
- **追问：** 如果把正确材料直接塞进 Prompt 就答对，能说明 Embedding 有问题吗？如何构造一个能区分“没召回”和“召回后生成错误”的 bad case？

## 8. 今天的提交物和明天的衔接

今天完成的最小提交物：

1. 一份 <code>embedding-contract.json</code>，锁定模型、版本、维度、归一化、距离、切片和索引版本。
2. 30 条问题—证据标注集，至少包含编号、同义表达、否定条件、无答案和越权样本。
3. 一份召回实验表，比较 dense、BM25、hybrid、RRF、重排和不同 Top-K。
4. 一份失败台账，能从 Query 追到候选、过滤、重排、上下文和最终答案。
5. 一段复盘：哪个指标变好，哪个成本上升，哪类问题仍然失败。

明天继续做模型路由：同一个任务为什么不能只靠“更强模型”，如何把能力、延迟、价格、上下文、结构化输出和降级策略写成可执行的路由规则。
