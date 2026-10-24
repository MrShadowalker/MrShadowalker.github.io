---
layout: post
title: "给 AI 问答做测试：先把错误分清楚"
date: 2026-09-09 09:10:00.000
updated: 2026-09-09 09:10:00.000
permalink: /articles/AI-QA-Evaluation.html
comments: true
description: "用一个小而可复现的评测集，区分检索、回答、引用与业务结果。"
categories:
  - "AI工程"
tags:
  - "AI"
  - "工程实践"
  - "测试"
  - "知识库"
---

<p>给知识库换了检索策略，测试分数从 80 变成 90，可以上线了吗？</p>
<p>先别急。这个分数到底在衡量什么？搜到了目标文档，答案写得像参考答案，还是用户真的得到了可以使用的结论？</p>
<p>同样一个问题，可能文档找对了、答案却用错了版本；也可能答案正确，引用却点不开。把它们压成一个总分，最需要修复的地方反而不容易看见。</p>
<!--more-->

<h2 id="一道测试题不应该只有一句问题"><a href="#一道测试题不应该只有一句问题" class="headerlink" title="一道测试题不应该只有一句问题"></a>一道测试题不应该只有一句问题</h2><p>假设要验证“2.3 版本能否处理扫描件”。测试样本可以这样记录：</p>
<figure class="highlight yaml"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br></pre></td><td class="code"><pre><span class="line"><span class="attr">id:</span> <span class="string">version-scanned-document-001</span></span><br><span class="line"><span class="attr">question:</span> <span class="string">&quot;2.3 自部署版支持扫描件吗？&quot;</span></span><br><span class="line"><span class="attr">identity_fixture:</span> <span class="string">reader-a</span></span><br><span class="line"><span class="attr">expected_behavior:</span> <span class="string">answer</span></span><br><span class="line"><span class="attr">required_claims:</span></span><br><span class="line">  <span class="bullet">-</span> <span class="string">&quot;结论仅适用于 2.3 自部署版&quot;</span></span><br><span class="line"><span class="attr">required_evidence:</span></span><br><span class="line">  <span class="bullet">-</span> <span class="string">&quot;release-note-2.3#scanned-document&quot;</span></span><br><span class="line"><span class="attr">forbidden_claims:</span></span><br><span class="line">  <span class="bullet">-</span> <span class="string">&quot;所有版本均支持&quot;</span></span><br><span class="line">  <span class="bullet">-</span> <span class="string">&quot;未有证据的速度或准确率承诺&quot;</span></span><br></pre></td></tr></table></figure>

<p>这里的编号和材料名称都是示例。实际测试还应固定知识快照、检索参数、提示词版本和模型标识，便于发现退步后复现问题。</p>
<p>如果把问题改成“这个版本支持吗”，而上下文没有版本号，预期行为就应该变成补问。测试不能要求模型在缺少条件时猜中一个标准答案。</p>
<h2 id="把整条链拆开看"><a href="#把整条链拆开看" class="headerlink" title="把整条链拆开看"></a>把整条链拆开看</h2><p>对每一道题，分别记录下面几件事：</p>
<table>
<thead>
<tr>
<th>环节</th>
<th>要检查什么</th>
<th>常见问题</th>
</tr>
</thead>
<tbody><tr>
<td>权限与范围</td>
<td>候选材料是否属于当前身份和版本</td>
<td>召回了不应访问的资料</td>
</tr>
<tr>
<td>检索</td>
<td>必要证据是否出现在候选结果中</td>
<td>正确文档没有进入结果集</td>
</tr>
<tr>
<td>结论</td>
<td>答案是否满足问题条件</td>
<td>拿其他版本的能力作答</td>
</tr>
<tr>
<td>引用</td>
<td>来源是否支持对应结论、能否访问</td>
<td>引用相关，但证明不了结论</td>
</tr>
<tr>
<td>使用结果</td>
<td>用户是否完成了原本的任务</td>
<td>答案完整，实际操作仍走不通</td>
</tr>
</tbody></table>
<p>前四项可以做较多自动化。最后一项往往需要真实用户反馈或业务系统中的结果，不能用“接口返回成功”直接代替。</p>
<h2 id="小样本也能有代表性"><a href="#小样本也能有代表性" class="headerlink" title="小样本也能有代表性"></a>小样本也能有代表性</h2><p>起步时可以先准备 20 道题：8 道明确可答、4 道需要补问、4 道无依据、2 道资料冲突、2 道权限边界。</p>
<p>这只是一个便于执行的起始分配，不是行业标准。重点是让不同失败类型都出现，而不是凑够数量。</p>
<p>每道题还可以保留一两个自然的改写。“是否支持扫描件”和“扫描出来的 PDF 能用吗”表达不同，用户意图却可能接近。改写题应该和原题放在同一组，避免同一个事实被重复统计，导致分数虚高。</p>
<p>权限测试需要分身份运行。管理员能回答，并不能证明普通用户也能安全使用。</p>
<h2 id="指标要写清分母"><a href="#指标要写清分母" class="headerlink" title="指标要写清分母"></a>指标要写清分母</h2><p>“引用准确率 95%”可能有几种解释：95% 的答案带了链接，95% 的链接能打开，或者95% 的引用真的支撑了结论。</p>
<p>如果需要定义一个简单的引用支持率，可以使用：</p>
<figure class="highlight text"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">引用支持率 = 有充分引用支持的事实性结论数 / 需要引用支持的事实性结论总数</span><br></pre></td></tr></table></figure>

<p>但还要另外检查必要事实有没有回答完整，否则模型少说几句就可能获得高分。类似地，“应该拒答却直接作答”和“应该回答却拒答”需要分别统计，避免靠一律拒答得到漂亮结果。</p>
<p>延迟也一样。记录从用户发出问题到最终可见答案的时间，并说明是否包含排队、检索、重排和工具调用。离线单请求耗时不能直接代表多人同时使用时的体验。</p>
<h2 id="用模型评分，也要保留人工标尺"><a href="#用模型评分，也要保留人工标尺" class="headerlink" title="用模型评分，也要保留人工标尺"></a>用模型评分，也要保留人工标尺</h2><p>模型可以协助检查答案是否遗漏条件、引用是否对应、表达是否清楚。不过评分器本身也可能出错，或者偏爱更长、更像自己的答案。</p>
<p>可以先人工标注一小组明显正确、明显错误和边界案例，再检查自动评分是否与人工判断一致。对权限泄露、相反结论、虚构能力等关键错误，保留明确规则和人工复核。</p>
<h2 id="每次只回答一个改动问题"><a href="#每次只回答一个改动问题" class="headerlink" title="每次只回答一个改动问题"></a>每次只回答一个改动问题</h2><p>如果同时换模型、提示词、切分策略和重排器，分数变化很难解释。</p>
<p>更容易推进的方式是：固定其余条件，只改一个主要变量；对同一批题比较结果；优先查看从正确变成错误的样本；必要时重复运行，区分偶然波动与稳定退步。</p>
<p>测试输出可以很简单：通过哪些题、退步哪些题、错误发生在哪一层、下一步改什么。等这些信息稳定以后，再扩展规模和统计方法。</p>
<p>一份评测报告真正有用的地方，是让下一次修改更有方向。它不应该只留下一个看起来不错的分数。</p>
