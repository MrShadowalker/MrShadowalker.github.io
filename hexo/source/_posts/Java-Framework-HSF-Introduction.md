---
layout: post
title: "HSF 框架简介"
date: 2021-07-22 15:12:57.000
updated: 2021-07-22 15:12:57.000
permalink: /articles/Java-Framework-HSF-Introduction.html
comments: true
description: "阿里内部使用的框架 HSF。"
categories:
  - "Java"
tags:
  - "Java"
  - "框架"
  - "阿里"
---

<p>HSF 框架，全称 High Speed Framework，是 Alibaba 内部使用的 RPC 框架，最初于 Dubbo 进行内部竞争，由于多方面的原因最终选择了 HSF。</p>
<p>HSF 作为阿里内部高性能的 RPC 框架，其优点是轻量，高性能，运维成本低的特性，为大规模集群的应用提供了好的基础。</p>
<p>入职前需要掌握的一个框架，HSF，自学的同时也分享给大家。</p>
<!--more-->

<h1 id="HSF-框架简介"><a href="#HSF-框架简介" class="headerlink" title="HSF 框架简介"></a>HSF 框架简介</h1><h2 id="概述"><a href="#概述" class="headerlink" title="概述"></a>概述</h2><p>HSF 连通不同的业务系统，解耦系统间的实现依赖。HSF 从分布式应用的层面，统一了服务的发布与调用方式，从而帮助用户更加方便、快速地开发分布式应用，以及提供或使用公共功能模块。HSF 为用户屏蔽了分布式领域中的各种复杂技术细节，如远程通讯、序列化实现、性能损耗、同步与异步调用方式的实现等。</p>
<h2 id="HSF-架构"><a href="#HSF-架构" class="headerlink" title="HSF 架构"></a>HSF 架构</h2><p>HSF 作为一个纯客户端架构的 RPC 框架，没有服务端集群，所有 HSF 服务调用均是通过服务消费方（Consumer）与服务提供方（Provider）点对点进行。为了实现整套分布式服务体系，HSF 还需要依赖以下外部系统。</p>
<p><img src="/articles/Java-Framework-HSF-Introduction/p71175.png" alt="EDAS_HSF架构图"></p>
<ul>
<li><p>服务提供方</p>
<p>服务提供方绑定了 12200 端口，用于接受请求并提供服务，同时将地址信息发布到地址注册中心。</p>
</li>
<li><p>服务消费方</p>
<p>服务消费者通过地址注册中心订阅服务，根据订阅到的地址信息发起调用，地址注册中心不参与调用。</p>
</li>
<li><p>EDAS 地址注册中心</p>
<p>HSF 依赖注册中心进行服务发现，如果没有注册中心，HSF 只能完成简单的点对点调用。</p>
<p>服务提供端无法将服务信息对外暴露，服务消费端可能已经明确了待调用的服务，但是无法获取该服务。因此注册中心是服务信息的中介，为服务提供了注册与发现的功能。</p>
</li>
<li><p>EDAS 持久化配置中心</p>
<p>持久化的配置中心用于存储HSF服务的各种治理规则，HSF 客户端在启动的过程中向持久化配置中心订阅服务治理规则，如路由规则、归组规则、权重规则等，从而根据规则对调用过程的选址逻辑进行干预。</p>
</li>
<li><p>EDAS 元数据存储中心</p>
<p>元数据指 HSF 服务对应的方法列表以及参数结构等信息。元数据对 HSF 的调用过程不会产生影响，因此元数据存储中心是可选的。由于服务运维的便捷性，HSF 客户端在启动时会将元数据上报到元数据存储中心，方便服务运维。</p>
</li>
<li><p>EDAS 控制台</p>
<p>EDAS 控制台打通了服务地址注册中心、持久化配置中心、元数据存储中心等，为用户提供了服务运维功能，包括服务查询、服务治理规则管理等，提高HSF服务研发的效率、运维的便捷性。</p>
</li>
</ul>
<h2 id="功能"><a href="#功能" class="headerlink" title="功能"></a>功能</h2><p>HSF 作为分布式 RPC 服务框架，支持多种服务的调用方式。</p>
<ul>
<li><p>同步调用</p>
<p>HSF 客户端默认以同步调用的方式消费服务，客户端代码需要同步等待返回结果。</p>
</li>
<li><p>异步调用</p>
<p>对于服务调用的客户端，并非所有 HSF 服务都需要同步等待返回结果。HSF 提供异步调用，帮助客户端无需同步阻塞在 HSF 调用上。HSF 的异步调用，有 Future 调用和 Callback 调用两种。</p>
<ul>
<li><p>Future 调用</p>
<p>客户端在需要获取调用的返回结果时，通过 <code>HSFResponseFuture.getResponse(int timeout)</code> 主动获取结果。</p>
</li>
<li><p>Callback 调用</p>
<p>Callback 调用利用 HSF 内部提供的回调机制，在指定 HSF 服务消费完毕拿到返回结果时，HSF 框架会回调用户实现的<code>HSFResponseCallback</code>接口，客户端通过回调通知的方式获取结果。</p>
</li>
</ul>
</li>
<li><p>泛化调用</p>
<p>对于一般的 HSF 调用来说，HSF 客户端需要依赖服务的二方包，通过依赖二方包中的 API 进行编程调用，获取返回结果。但是泛化调用不需要依赖服务的二方包，可以发起 HSF 调用、获取返回结果。在平台型的产品中，泛化调用的方式可以有效减少平台型产品的二方包依赖，实现系统的轻量级运行。</p>
</li>
<li><p>调用链路 Filter 扩展</p>
<p>HSF 内部设计了调用过滤器，能够主动发现用户的调用过滤器扩展点，将其集成到 HSF 调用链路中，便于扩展方对 HSF 的请求进行扩展处理。</p>
</li>
</ul>
<h2 id="应用开发方式"><a href="#应用开发方式" class="headerlink" title="应用开发方式"></a>应用开发方式</h2><p>使用 HSF 框架开发应用有 Ali-Tomcat 和 Pandora Boot 两种方式。</p>
<ul>
<li>Ali-Tomcat：依赖 Ali-Tomcat 和 Pandora，提供了完整的 HSF 功能，包括服务注册与发现、隐式传参、异步调用、泛化调用和调用链路 Filter 扩展。应用程序须以 WAR 包方式部署。</li>
<li>Pandora Boot：依赖 Pandora，提供了比较完整的 HSF 功能，包括服务注册与发现、异步调用。应用程序编译为可运行的 JAR 包并部署即可。</li>
</ul>
