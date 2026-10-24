---
layout: post
title: "秒杀系列（零）高并发设计"
date: 2021-07-26 11:02:55.000
updated: 2021-07-26 11:02:55.000
permalink: /articles/Java-SecKill-Distributed-Design.html
comments: true
description: "秒杀系列开篇文章，整理分布式微服务设计中，面对高并发场景的一系列潜在问题和处理思路。"
categories:
  - "Java"
tags:
  - "Java"
  - "分布式"
  - "数据一致性"
  - "高并发"
---

<p>秒杀系列开篇文章，整理分布式微服务设计中，面对高并发场景的一系列潜在问题和处理思路。</p>
<!--more-->

<h1 id="前言"><a href="#前言" class="headerlink" title="前言"></a>前言</h1><p>不论是日常工作还是大场面试中，分布式问题应该是每个程序猿要刻在基因里的意识。</p>
<p>在通过相关技术的学习和日常工作中的梳理之后，笔者希望以成体系的方式，把分布式微服务架构在面对高并发等场景下的各类问题和相关的处理思路，模拟并展现出来。希望能带给小伙伴们思考。</p>
<p>为了做这系列梳理，笔者采取了大家都熟悉的高并发场景：<strong>秒杀 + 积分</strong>，以此降低大家对于业务的理解门槛，更加专注于技术和问题本身的思考。</p>
<h1 id="业务场景描述"><a href="#业务场景描述" class="headerlink" title="业务场景描述"></a>业务场景描述</h1><p>万级用户参加一个商品秒杀活动，简化问题为：几件商品，库存 100 - 1000 不定，用户在几秒内参与抢购，不可超卖，但允许一定程度上卖不完。</p>
<p>成功秒杀下订单的用户，还可获取相应积分，1 元 &#x3D; 1 积分。</p>
<h2 id="需求拆解"><a href="#需求拆解" class="headerlink" title="需求拆解"></a>需求拆解</h2><ol>
<li>数据库设计</li>
<li>系统设计</li>
<li>接口设计</li>
<li>压力测试</li>
</ol>
<h3 id="系统设计"><a href="#系统设计" class="headerlink" title="系统设计"></a>系统设计</h3><p>库存系统、订单系统、积分系统</p>
<h3 id="接口设计"><a href="#接口设计" class="headerlink" title="接口设计"></a>接口设计</h3><p>查询、下订单、扣积分</p>
<h3 id="压力测试"><a href="#压力测试" class="headerlink" title="压力测试"></a>压力测试</h3><p>JMeter</p>
<h1 id="业务场景技术分析"><a href="#业务场景技术分析" class="headerlink" title="业务场景技术分析"></a>业务场景技术分析</h1><ul>
<li><p>QPS 较高，涉及<strong>高并发</strong>场景</p>
</li>
<li><p>分布式请求，涉及<strong>分布式锁</strong>的应用</p>
</li>
<li><p>多系统交互，涉及<strong>分布式数据一致性</strong>问题</p>
</li>
<li><p>数据库 <strong>MySQL</strong></p>
</li>
<li><p>缓存中间件 <strong>Redis</strong></p>
</li>
<li><p>消息中间件 <strong>RabbitMQ</strong></p>
</li>
</ul>
<h1 id="项目"><a href="#项目" class="headerlink" title="项目"></a>项目</h1><p>本项目已在 <a target="_blank" rel="noopener" href="https://github.com/MrShadowalker/secKill">Github</a> 上开源，项目中已有足够的注释和相关文档，欢迎 Star、Fork、Follow，为本项目做出贡献者，我会请您喝咖啡呀~~</p>
