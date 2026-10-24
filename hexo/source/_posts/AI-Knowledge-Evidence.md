---
layout: post
title: "知识库能搜到，为什么还是答不准？"
date: 2026-09-09 09:00:00.000
updated: 2026-09-09 09:00:00.000
permalink: /articles/AI-Knowledge-Evidence.html
comments: true
description: "从一个版本支持问题出发，拆开检索、证据和回答之间的关系。"
categories:
  - "AI工程"
tags:
  - "AI"
  - "RAG"
  - "工程实践"
  - "知识库"
---

<p>假设有人问：“我们正在用的这个版本，能不能处理扫描件？”</p>
<p>知识库搜到了三份材料：一份产品介绍、一份新版本说明，还有一份测试记录。模型读完以后回答：“支持，上传文件即可。”</p>
<p>听起来很顺。但再看一眼，产品介绍没有写版本，新版本说明说的是下个月准备发布的功能，测试记录只覆盖了一种文档。</p>
<p>问题出在哪里？材料确实找到了，可它们还不足以回答眼前这个问题。</p>
<!--more-->

<h2 id="先把“相关”和“能证明”分开"><a href="#先把“相关”和“能证明”分开" class="headerlink" title="先把“相关”和“能证明”分开"></a>先把“相关”和“能证明”分开</h2><p>向量检索擅长寻找语义相近的内容。“扫描件识别”和“图片文字提取”即使没有共同关键词，也有机会被放到一起。</p>
<p>但语义相近不代表条件相同。用户问的是当前版本，而搜索结果可能属于另一个版本；用户问能否投入使用，资料可能只是概念验证。</p>
<p>因此，一条候选材料至少要过两道判断：它是否在谈这个问题，它是否能证明这个问题下的具体结论。</p>
<p>第一道判断适合交给检索和重排。第二道判断还需要版本、环境、适用范围和材料状态。</p>
<h2 id="给知识补上使用条件"><a href="#给知识补上使用条件" class="headerlink" title="给知识补上使用条件"></a>给知识补上使用条件</h2><p>可以给文档或知识条目增加一些简单的字段：</p>
<figure class="highlight yaml"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br></pre></td><td class="code"><pre><span class="line"><span class="attr">product:</span> <span class="string">example-product</span></span><br><span class="line"><span class="attr">version:</span> <span class="string">&quot;2.3&quot;</span></span><br><span class="line"><span class="attr">environment:</span> <span class="string">self-hosted</span></span><br><span class="line"><span class="attr">status:</span> <span class="string">approved</span></span><br><span class="line"><span class="attr">source_type:</span> <span class="string">release-note</span></span><br><span class="line"><span class="attr">effective_from:</span> <span class="string">&quot;2026-08-01&quot;</span></span><br><span class="line"><span class="attr">source_url:</span> <span class="string">&quot;https://example.com/releases/2.3&quot;</span></span><br></pre></td></tr></table></figure>

<p>这只是示例结构，不是某个框架的固定配置。</p>
<p>其中 <code>status</code> 表示材料是否经过确认；它不能替代访问权限。访问范围应由服务端根据用户身份计算，并在检索前执行过滤，不能让模型自行决定哪些资料可以展示。</p>
<p>日期也有区别：文件上传日期、最近编辑日期和功能生效日期并不总是一回事。排序时只看“最近修改”，很容易让一篇刚修正错别字的旧文档压过新的发布说明。</p>
<h2 id="把问题也拆成条件"><a href="#把问题也拆成条件" class="headerlink" title="把问题也拆成条件"></a>把问题也拆成条件</h2><p>面对“这个版本支持吗”，系统首先要知道“这个版本”是什么。</p>
<p>如果会话里已经提供了版本，可以继续使用，并在答案中写明。如果没有上下文，就先问一句版本号；也可以给出明确标注条件的分支回答。</p>
<p>一个最小处理过程可以是：</p>
<figure class="highlight text"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br></pre></td><td class="code"><pre><span class="line">用户问题</span><br><span class="line">  → 提取产品、版本、部署方式和任务</span><br><span class="line">  → 按身份及已知条件筛选可用资料</span><br><span class="line">  → 检索并重排</span><br><span class="line">  → 检查每个结论是否有对应依据</span><br><span class="line">  → 回答，或补问缺少的条件</span><br></pre></td></tr></table></figure>

<p>遇到两份材料冲突时，不要单纯选得分高的一份。先核对适用条件和来源权威性；无法消除冲突，就把冲突和缺少的信息说清楚。</p>
<h2 id="引用应该跟着结论走"><a href="#引用应该跟着结论走" class="headerlink" title="引用应该跟着结论走"></a>引用应该跟着结论走</h2><p>“支持扫描件，最大 200 页，处理速度很快。[1]”这样的答案可能只有前半句能在引用里找到。</p>
<p>可以在内部先组织一个结论与证据的对应表：</p>
<table>
<thead>
<tr>
<th>待回答的内容</th>
<th>已有证据</th>
<th>合适的回答</th>
</tr>
</thead>
<tbody><tr>
<td>是否支持扫描件</td>
<td>对应版本的发布说明明确支持</td>
<td>在指定版本与部署方式下支持</td>
</tr>
<tr>
<td>最多多少页</td>
<td>没找到适用配置说明</td>
<td>暂不能确认上限</td>
</tr>
<tr>
<td>处理速度</td>
<td>只有一份样本测试记录</td>
<td>给出测试条件及结果，不扩展为通用承诺</td>
</tr>
</tbody></table>
<p>用户不一定需要看这张内部表，但最终答案应该保留这些边界。引用最好直接定位到相应章节，减少用户再次翻文档的成本。</p>
<h2 id="没找到依据时，也可以给出有用的回答"><a href="#没找到依据时，也可以给出有用的回答" class="headerlink" title="没找到依据时，也可以给出有用的回答"></a>没找到依据时，也可以给出有用的回答</h2><p>只有一句“无法回答”，帮助不大。更好的回答可以是：</p>
<blockquote>
<p>目前找到的说明适用于 2.3 版本，明确支持扫描件。你正在使用的版本还不清楚，因此暂时不能确认适用性。提供版本号后，可以继续核对。</p>
</blockquote>
<p>这段话交代了已知事实、未确定的条件和下一步。模型没有必要靠补全一个看似完整的答案来结束对话。</p>
<p>另一个容易忽略的问题是资料里的指令。检索到的文档可能包含“忽略之前的规则”之类文本；文档只能作为数据使用，不能覆盖系统指令或授予工具权限。OWASP 的 <a target="_blank" rel="noopener" href="https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html">RAG 安全指南</a> 对权限隔离和检索内容的信任边界有更系统的说明。</p>
<h2 id="从一个问题做起"><a href="#从一个问题做起" class="headerlink" title="从一个问题做起"></a>从一个问题做起</h2><p>刚开始不必收集几万份资料。选一个真实问题，把对应版本说明、可用证据、缺失条件和最终答案整理清楚，再检查另一个身份是否应该看到相同材料。</p>
<p>当这个过程可以重复，扩展资料范围才有意义。知识库的价值最终落在用户能否据此做出正确判断上，而不只是搜索结果里出现了多少段相关文字。</p>
