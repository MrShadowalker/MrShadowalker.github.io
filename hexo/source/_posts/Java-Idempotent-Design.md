---
layout: post
title: "Java 幂等设计"
date: 2021-07-26 09:39:55.000
updated: 2021-07-26 09:39:55.000
permalink: /articles/Java-Idempotent-Design.html
comments: true
description: "Java 幂等设计，很重要的一项基本功和意识。"
categories:
  - "Java"
tags:
  - "Java"
  - "高并发"
---

<p>小伙伴们有没有遇到过<strong>生产环境经常出现过重复的数据？</strong>在排查问题的时候，数据又是正常的。这个是何解呢？<strong>怎么会出现这种情况，而且还很难排查问题</strong>。</p>
<p>今天给大家分享一下这里的原因，以及解决方案。</p>
<!--more-->

<h1 id="罪魁祸首"><a href="#罪魁祸首" class="headerlink" title="罪魁祸首"></a>罪魁祸首</h1><p>产生<strong>重复数据或数据不一致</strong>（假定程序业务代码没问题），绝大部分就是发生了<strong>重复的请求</strong>，<strong>重复请求是指同一个请求因为某些原因被多次提交</strong>。导致这个情况会有<strong>几种场景</strong>：</p>
<p>1）<strong>微服务场景</strong>，在我们传统应用架构中调用接口，要么成功，要么失败。但是<strong>在微服务架构下，会有第三个情况【未知】，也就是超时</strong>。如果超时了，<strong>微服务框架会进行重试。</strong></p>
<p>2）用户<strong>交互的时候多次点击</strong>。如：快速点击按钮多次。</p>
<p>3）MQ 消息中间件，<strong>消息重复消费</strong>。</p>
<p>4）第三方平台的接口（如：支付成功回调接口），因为异常也会导致多次异步回调。</p>
<p>5）其他中间件&#x2F;应用服务根据自身的特性，也有可能进行重试。</p>
<p>我们知道了发生的原因，<strong>本质就是多次请求了，那如何解决呢？</strong></p>
<h1 id="幂等性"><a href="#幂等性" class="headerlink" title="幂等性"></a><strong>幂等性</strong></h1><p>有些小伙伴们会想到<strong>幂等</strong>这个词，是的，就是我们在设计某些接口时，要考虑如何保证接口幂等，<strong>那什么是接口幂等呢？</strong></p>
<blockquote>
<p>网上是这样介绍的【接口的幂等性实际上就是<strong>接口可重复调用</strong>,在调用方多次调用的情况下，接口<strong>最终得到的结果是一致的</strong>】</p>
</blockquote>
<p>网上的说法定义，有点不是太正确，我们看下怎么不正确</p>
<blockquote>
<p>如<strong>一个线程请求用户列表接口</strong>：select * from user，返回用户表中的数据，而<strong>另一个线程往用户表插入数据</strong>。那请求用户列表的线程返回的数据每次都不一样，那按照上面的说法，<strong>查询用户列表的接口就不是幂等的，</strong>这显然是不正确的。</p>
</blockquote>
<p>我的理解应该是<strong>多次调用对系统的产生的影响是一样的，即对资源的作用是一样的，但是返回值允许不同。</strong></p>
<h1 id="幂等场景"><a href="#幂等场景" class="headerlink" title="幂等场景"></a><strong>幂等场景</strong></h1><p>我们来看一下 SQL 相关业务<strong>是否幂等？</strong></p>
<p>一. <strong>查询</strong>，select * from user where xxx，不会对数据产生任何变化，<strong>具备幂等性</strong>。</p>
<p>二. <strong>新增</strong>，insert into user(userid,name) values(1,’a’)</p>
<blockquote>
<p>如 <strong>userid 为唯一主键</strong>，即重复操作上面的业务，只会插入一条用户数据，<strong>具备幂等性</strong>。</p>
<p>如 <strong>userid 不是主键</strong>，可以重复，那上面业务多次操作，数据都会新增多条，<strong>不具备幂等性</strong>。</p>
</blockquote>
<p>三. <strong>修改</strong>，区分直接赋值和计算赋值。</p>
<blockquote>
<p>1、<strong>直接赋值</strong>，update user set point &#x3D; 20 where userid&#x3D;1，不管执行多少次，point 都一样，<strong>具备幂等性</strong>。</p>
<p>2、<strong>计算赋值</strong>，update user set point &#x3D; point + 20 where userid&#x3D;1，每次操作 point 数据都不一样，<strong>不具备幂等性</strong>。</p>
</blockquote>
<p>四. <strong>删除</strong>，delete from user where userid&#x3D;1，多次操作，结果一样，<strong>具备幂等性。</strong></p>
<blockquote>
<p>上面场景中，我们发现新增没有唯一主键约束的数据，和修改计算赋值型操作都不具备幂等性</p>
</blockquote>
<p><strong>那怎么去解决呢？</strong></p>
<blockquote>
<p>网上介绍很多，但介绍得太简单了，且关键点都没有介绍到。</p>
<p>这里只介绍常用的方案.</p>
</blockquote>
<h1 id="token-机制"><a href="#token-机制" class="headerlink" title="token 机制"></a>token 机制</h1><p>token 方式的流程，上一张图，比较清晰</p>
<p><img src="/articles/Java-Idempotent-Design/token%20%E6%9C%BA%E5%88%B6.png" alt="何为幂等？如何设计？"></p>
<p>上图就是 <strong>token + Redis 的幂等方案</strong>，适用绝大部分场景。</p>
<p>主要思想：</p>
<blockquote>
<p>1、服务端<strong>提供了发送 token 的接口</strong>。我们在分析业务的时候，<strong>哪些业务是存在幂等问题的</strong>，就<strong>必须在执行业务前，先去获取 token</strong>，服务器会把 <strong>token 保存到 Redis</strong> 中。（微服务肯定是分布式了，如果单机就适用 JVM 缓存）。</p>
<p>2、然后<strong>调用业务接口请求时，把 token 携带过去</strong>，一般放在请求头部。</p>
<p>3、服务器<strong>判断 token 是否存在 Redis</strong> 中，<strong>存在表示第一次请求</strong>，可以继续执行业务，执行业务完成后，<strong>最后需要把 Redis 中的 token 删除</strong>。</p>
<p>4、如果<strong>判断 token 不存在 Redis</strong> 中，就表示是<strong>重复操作，直接返回重复标记给 client</strong>，这样就保证了业务代码，不被重复执行。</p>
</blockquote>
<p>这种方案是比较常用的方案，也是网上经常介绍的，但是有一点不同的地方：</p>
<blockquote>
<p>网上方案：检验 token 存在（表示第一次请求）后，<strong>就立刻删除 token，再进行业务处理</strong></p>
<p>上面方案：检验 token 存在（表示第一次请求）后，<strong>先进行业务处理，再删除 token</strong></p>
</blockquote>
<p><strong>关键点就是 先删除 token，还是后删除 token。</strong></p>
<p><strong>一、网上方案缺点</strong></p>
<blockquote>
<p>我们看下网上方案，<strong>先删除 token</strong>，这是出现系统问题导致<strong>业务处理出现异常</strong>，业务处理没有成功，接口调用方也没有获取到明确的结果，然后<strong>进行重试，但 token 已经删除掉了</strong>，服务端判断 token 不存在，<strong>认为是重复请求，就直接返回了</strong>，无法进行业务处理了。</p>
</blockquote>
<p><strong>二、上面方案缺点</strong></p>
<blockquote>
<p><strong>后删除 token</strong> 也是会存在问题的，如果进行业务处理成功后，删除 Redis 中的 token 失败了，这样就导致了有可能会发生重复请求，因为 token 没有被删除</p>
</blockquote>
<p>小伙伴们有没有发现，其实上面的问题就是<strong>数据库和缓存 Redis 数据不一致</strong>的问题。</p>
<p>之前在秒杀场景系列中整理了一篇文章，里面详细介绍了<strong>如何解决数据库和缓存 Redis 数据不一致的问题</strong>，小伙伴们可自行查阅。</p>
<blockquote>
<p>其实根据这个场景的业务，可以有个简单的处理方式。<strong>笔者推荐是网上方案先删除 token</strong>，先保证不会因为重复请求，业务数据出现问题。顶多再让用户处理一次。</p>
</blockquote>
<p>出现业务异常，可以让调用方配合处理一下，<strong>重新获取新的 token，再次由业务调用方发起重试请求就 OjbK 了</strong>。</p>
<h2 id="token机制缺点"><a href="#token机制缺点" class="headerlink" title="token机制缺点"></a>token机制缺点</h2><p>小伙伴们有没有发现，<strong>业务请求每次请求，都会有额外的请求（一次获取 token 请求、判断 token 是否存在的业务）</strong>。其实真实的生产环境中，<strong>1 万请求也许只会存在 10 个左右的请求会发生重试</strong>，为了这 10 个请求，我们让 <strong>9990 个请求都发生了额外的请求</strong>。（当然 Redis 性能很好，耗时不会太明显）</p>
<h1 id="乐观锁机制"><a href="#乐观锁机制" class="headerlink" title="乐观锁机制"></a>乐观锁机制</h1><p>关于乐观锁之前也讲过，大家可以去查阅。<strong>乐观锁这里解决了计算赋值型的修改场景</strong>。我们对之前的 SQL 语句进行修改。</p>
<figure class="highlight plaintext"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">update user set point = point + 20, version = version + 1 where userid=1 and version=1</span><br></pre></td></tr></table></figure>

<p><strong>加上了版本号后，就让此计算赋值型业务，具备了幂等性</strong>。</p>
<h2 id="乐观锁机制缺点"><a href="#乐观锁机制缺点" class="headerlink" title="乐观锁机制缺点"></a>乐观锁机制缺点</h2><p>就是在操作业务前，需要先查询出当前的 version 版本</p>
<h1 id="唯一主键机制"><a href="#唯一主键机制" class="headerlink" title="唯一主键机制"></a>唯一主键机制</h1><p>这个机制是<strong>利用了数据库的主键唯一约束的特性</strong>，解决了在 <strong>insert 场景</strong>时幂等问题。但主键的要求不是自增的主键，这样就需要业务<strong>生成全局唯一</strong>的主键，之前的文章也介绍过<strong>分布式唯一主键 ID</strong> 的生成，可自行查阅。</p>
<p>如果是<strong>分库分表场景下</strong>，<strong>路由规则要保证相同请求下</strong>，<strong>落地在同一个数据库和同一表中</strong>，要不然<strong>数据库主键约束就不起效果</strong>了，因为是不同的数据库和表主键不相关。</p>
<p>因为对主键有一定的要求，这个方案就跟业务有点耦合了，<strong>无法用自增主键了</strong>。</p>
<h1 id="去重表机制"><a href="#去重表机制" class="headerlink" title="去重表机制"></a>去重表机制</h1><p><strong>这个方案业务中要有唯一主键</strong>，这个去重表中只要一个字段就行，<strong>设置唯一主键约束</strong>，当然根据业务自行添加其他字段。</p>
<p>主要流程上图</p>
<p><img src="/articles/Java-Idempotent-Design/%E5%8E%BB%E9%87%8D%E8%A1%A8%E6%9C%BA%E5%88%B6.png" alt="何为幂等？如何设计？"></p>
<p>上面的主要流程就是 <strong>把唯一主键插入去重表，再进行业务操作，且他们在同一个事务中。</strong>这个保证了重复请求时，因为去重表有唯一约束，导致请求失败，<strong>避免了幂等问题</strong>。</p>
<blockquote>
<p>这里要注意的是，<strong>去重表和业务表应该在同一库中</strong>，这样就保证了在同一个事务，即使业务操作失败了，也会把去重表的数据回滚。<strong>这个很好的保证了数据一致性</strong>。</p>
</blockquote>
<p>这个方案也是比较常用的，<strong>去重表是跟业务无关的</strong>，很多业务可以共用同一个去重表，只要规划好唯一主键就行了。</p>
<h1 id="总结"><a href="#总结" class="headerlink" title="总结"></a>总结</h1><p>上面介绍了一些幂等方案，小伙伴们根据自身的业务进行选择，<strong>尽量不要让系统变的复杂</strong>，所以<strong>推荐唯一主键和乐观锁方式，因为实现比较简单</strong>。</p>
