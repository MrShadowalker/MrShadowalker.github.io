---
layout: post
title: "企业级分布式应用服务 EDAS 应用"
date: 2021-07-20 08:18:33.000
updated: 2021-07-20 08:18:33.000
permalink: /articles/Java-Framework-EDAS-Operation.html
comments: true
description: "EDAS 操作手册"
categories:
  - "Java"
tags:
  - "Java"
  - "框架"
---

<p>本篇为了帮助用户体验 EDAS，快速入门介绍如何将 Spring Cloud 和 Apache Dubbo（简称 Dubbo）微服务应用 Demo 快速部署到 EDAS 的不同环境中，每个部署场景均可在 30 分钟内完成。</p>
<p>EDAS 提供 1~5 个免费的按量付费应用实例。如果您开通了 EDAS 按量付费的标准版，并且部署的应用实例不超过 5 个的情况下，使用 EDAS 本身不会产生任何费用，但需要为创建的云服务器 ECS、负载均衡 SLB 而使用的阿里云资源支付费用，直到释放这些资源为止。</p>
<p>EDAS 提供的应用 Demo 中注册中心使用的是 Nacos，您也可以根据需求自建或使用 MSE 托管其它类型的注册中心，如 Eureka 或 ZooKeeper。只要保证注册中心与应用部署环境的网络互通，无需修改任何代码，即可将应用部署到 EDAS，使用 EDAS 提供的应用托管、微服务及云原生应用 PaaS 平台能力，详情请参见<a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/42934.htm#concept-2038209">什么是企业级分布式应用服务 EDAS</a>。</p>
<!--more-->

<p><img src="/articles/Java-Framework-EDAS-Operation/EDAS%20%E4%BD%BF%E7%94%A8%E6%B5%81%E7%A8%8B.png" alt="EDAS 使用流程"></p>
<p><strong>说明</strong></p>
<ul>
<li>默认环境：EDAS 提供的默认 VPC 和默认微服务空间中的默认 ECS 集群。目前 EDAS 仅为 ECS 集群提供了默认环境，K8s 无默认环境。</li>
<li>自定义环境：您创建的 ECS 集群或 K8s 集群。</li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/189758.html?spm=a2c4g.11186623.6.575.1f4833a3gvQqnc">如何选择合适的部署环境</a></li>
</ul>
<p><strong>链接</strong></p>
<ul>
<li><p><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/169358.html">平滑迁移微服务应用至 EDAS</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/157039.html">开发应用</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/181513.html">在 K8s 环境中部署微服务应用</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/184500.html?spm=a2c4g.11186623.6.579.20eb168arG1eh6">在 K8s 环境中通过镜像部署多语言微服务应用</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/134109.html">在默认 ECS 环境中部署微服务应用</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/135134.html">在自定义 ECS 环境中部署微服务应用</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/182309.html?spm=a2c4g.11186623.6.580.53675416tWJ8EQ">常见问题</a></p>
</li>
</ul>
