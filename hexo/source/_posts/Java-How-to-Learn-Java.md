---
layout: post
title: "巅峰之旅（一）如何学习 Java"
date: 2021-07-15 15:58:56.000
updated: 2021-07-15 15:58:56.000
permalink: /articles/Java-How-to-Learn-Java.html
comments: true
description: "Java 学习之旅"
categories:
  - "Java"
tags:
  - "Java"
  - "面试"
---

<p>学习是为了什么？</p>
<blockquote>
<p>面向面试学习</p>
<p>面向大厂学习</p>
<p>面向薪资学习</p>
<p>面向提升学习</p>
</blockquote>
<p>我不否认上面的任何一点。尽管从境界，或者说价值观层面，显得越来越高大上，打工人终归还是要恰饭的嘛。</p>
<p>要想恰好饭，就要进大厂；要想更好提升，就要进大厂。</p>
<p>所以不论是提升个人价值、还是创造个人价值的角度，进大厂无疑是所有程序员的梦想。</p>
<p>很多人在工作几年之后，固然日常开发和解决问题的能力都很强，但是从前学习的东西要么忘了、要么没有经过深入的研究。</p>
<p>在大厂面试的时候哪怕心里知道，嘴上也支支吾吾。</p>
<p>更别说很多非八股文的、需要深入理解某些知识，才能在其间游刃有余谈吐自若。</p>
<p>然后再到场景设计编程实现、或者直接丢过来两道没刷过的算法题，当场凉凉。</p>
<!--more-->

<p>从前没有章法，什么都学，但也不知道重点，应该在哪里深入，在去年的几轮面试中折戟……</p>
<p>但无妨，我记录并整理了面经进行复盘，也作为这一系列教程的核心框架。</p>
<ul>
<li>八股文——背就完事儿了，但是要抓重点。</li>
<li>项目及应用——一定要深入你所负责或者熟悉的项目模块，把各个角度都理解透彻（这本身也对工作有益）；如果实在是没有什么拿得出手的项目，就基于之前的项目进行场景扩展，把自己当成一个负责人来思考各种情况。</li>
<li>算法——有技巧地做题，而非瞎几把刷题。</li>
</ul>
<p>今年，在经历了几个公司（均为大厂或独角兽）三十多轮的技术面试之后，终于成功起飞。</p>
<p>接下来的系列知识盘点，一部分我会按照正经的知识体系梳理；但是更多的，我会解构知识体系，通过模拟面试场景，站在面试官的角度去将零碎的知识串成一棵多叉树，希望亲爱的读者你，可以像拎葡萄一样，“<strong>拎起一根，带起一串</strong>”。</p>
<h1 id="学习准备"><a href="#学习准备" class="headerlink" title="学习准备"></a>学习准备</h1><h2 id="思想准备"><a href="#思想准备" class="headerlink" title="思想准备"></a>思想准备</h2><p>这是一段艰苦的旅程。</p>
<p>我真心体会过从深渊向巅峰仰望时的绝望，一次次被打击到，无数个闷在房间内听课、看文档、看书、总结、刷题的深夜，只有我的小猫咪是唯一的慰藉。</p>
<p>告别了生活，告别了娱乐，告别了兴趣爱好……</p>
<p>你要坚信你的付出是值得的，你失去的，总有一天生活会回报给你更好的。</p>
<p>而在此期间，你的成长也是无与伦比的。</p>
<p>希望你看看我在学习期间的<a href="http://chenzihao.me/articles/Essay-Personal-Development.html">个人成长总结</a>。</p>
<h2 id="工具准备"><a href="#工具准备" class="headerlink" title="工具准备"></a>工具准备</h2><h3 id="绘图工具"><a href="#绘图工具" class="headerlink" title="绘图工具"></a>绘图工具</h3><p>首推 ProcessOn，建议买会员，解锁更多使用姿势。</p>
<p>另外，欢迎大家关注我的 <a target="_blank" rel="noopener" href="https://www.processon.com/u/599247d8e4b0b83fa25f1298/profile#pc">ProcessOn</a>，这里分享了很多我整理的东西。</p>
<p><img src="/articles/Java-How-to-Learn-Java/image-20210717113425389.png" alt="image-20210717113425389"></p>
<h3 id="思维导图"><a href="#思维导图" class="headerlink" title="思维导图"></a>思维导图</h3><p>Xmind 足够了</p>
<h3 id="IDE"><a href="#IDE" class="headerlink" title="IDE"></a>IDE</h3><p>推荐 JetBrains 家的 IDEA。</p>
<p>关于激活或者无限期试用，请关注 <a href="http://chenzihao.me/articles/Tool-best-Mac.html">如何打造宇宙最强 Macbook</a> 中的 <code>JetBrains</code> 部分。</p>
<h2 id="资料准备"><a href="#资料准备" class="headerlink" title="资料准备"></a>资料准备</h2><p>知识框架，我已经整理在 <a target="_blank" rel="noopener" href="https://www.processon.com/view/60c854291efad418c90823f7?fromnew=1#map">ProcessOn</a> 了，请大家关注、收藏。</p>
<p>我已经将需要用到的资料整理到公众号内了，请小伙伴们关注微信公众号 <code>等把深夜熬熟</code>，并发送“博客资料”获取。</p>
<p>微信公众号二维码：</p>
<p><img src="/articles/Java-How-to-Learn-Java/%E5%BE%AE%E4%BF%A1%E5%85%AC%E4%BC%97%E5%8F%B7.jpg" alt="微信公众号"></p>
<h1 id="学习路线"><a href="#学习路线" class="headerlink" title="学习路线"></a>学习路线</h1><p>我假设你已经有了一定的基础和两年左右的工作经验，默认你了解一些概念性的基础知识，具备一定的开发实战经验。</p>
<h2 id="Java-基础"><a href="#Java-基础" class="headerlink" title="Java 基础"></a>Java 基础</h2><ul>
<li>Java 简介</li>
<li>Java 语法基础</li>
<li>Java 数据类型</li>
<li>运算符</li>
<li>程序结构</li>
<li>方法和函数</li>
<li>数组</li>
<li>面向对象</li>
<li>异常</li>
<li>集合</li>
<li>泛型</li>
<li>IO 流</li>
<li>网络编程</li>
<li>反射</li>
<li>Java 8 新特性</li>
</ul>
<h2 id="JVM"><a href="#JVM" class="headerlink" title="JVM"></a>JVM</h2><ul>
<li>Java 虚拟机</li>
<li>Java 内存结构</li>
<li>Java 内存模型</li>
<li>Java 类加载</li>
<li>GC</li>
<li>JVM 调优</li>
</ul>
<h2 id="并发编程"><a href="#并发编程" class="headerlink" title="并发编程"></a>并发编程</h2><h2 id="MySQL"><a href="#MySQL" class="headerlink" title="MySQL"></a>MySQL</h2><h2 id="Redis"><a href="#Redis" class="headerlink" title="Redis"></a>Redis</h2><h2 id="消息中间件"><a href="#消息中间件" class="headerlink" title="消息中间件"></a>消息中间件</h2><h3 id="RocketMQ"><a href="#RocketMQ" class="headerlink" title="RocketMQ"></a>RocketMQ</h3><h2 id="框架"><a href="#框架" class="headerlink" title="框架"></a>框架</h2><h3 id="Spring"><a href="#Spring" class="headerlink" title="Spring"></a>Spring</h3><h3 id="MyBatis"><a href="#MyBatis" class="headerlink" title="MyBatis"></a>MyBatis</h3><h2 id="网络协议"><a href="#网络协议" class="headerlink" title="网络协议"></a>网络协议</h2><h2 id="分布式锁"><a href="#分布式锁" class="headerlink" title="分布式锁"></a>分布式锁</h2><h2 id="分布式事务"><a href="#分布式事务" class="headerlink" title="分布式事务"></a>分布式事务</h2><h2 id="设计模式"><a href="#设计模式" class="headerlink" title="设计模式"></a>设计模式</h2><h2 id="架构设计"><a href="#架构设计" class="headerlink" title="架构设计"></a>架构设计</h2><h2 id="场景设计"><a href="#场景设计" class="headerlink" title="场景设计"></a>场景设计</h2><h2 id="数据结构与算法"><a href="#数据结构与算法" class="headerlink" title="数据结构与算法"></a>数据结构与算法</h2><p><strong>小板凳搬好，我们准备开始啦~</strong></p>
