---
layout: post
title: "EDAS 服务治理"
date: 2021-07-22 08:52:42.000
updated: 2021-07-22 08:52:42.000
permalink: /articles/Java-Framework-EDAS-Service-Governance.html
comments: true
description: "Valar Morghulis"
categories:
  - "Java"
tags:
  - "Java"
  - "框架"
---

<p>服务治理是 EDAS 的重要功能之一。在 EDAS 中，用户可以对 Spring Cloud、Dubbo、HSF 和多语言服务应用进行治理，包括服务查询、调用链查询、离群实例摘除和服务鉴权等。</p>
<!--more-->

<h1 id="Spring-Cloud-服务治理"><a href="#Spring-Cloud-服务治理" class="headerlink" title="Spring Cloud 服务治理"></a>Spring Cloud 服务治理</h1><ul>
<li><p>金丝雀发布</p>
<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/199071.html?spm=a2c4g.11186623.6.870.610a45a6FWAcVH">金丝雀发布（K8s）</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/199076.html?spm=a2c4g.11186623.6.871.598352b0LS6SZo">金丝雀发布（ECS）</a></li>
</ul>
</li>
<li><p>部署和运维</p>
<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/132165.html?spm=a2c4g.11186623.6.868.372d42b2dpTxb6">无损下线 Spring Cloud 应用</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/155526.html?spm=a2c4g.11186623.6.872.fac87f2e6VEUFt">查询 Spring Cloud 服务</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/155530.html?spm=a2c4g.11186623.6.873.575f3c70GBT5uw">查询 Spring Cloud 服务调用链</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/175625.html?spm=a2c4g.11186623.6.876.d9e51f096M9U8X">查看 Spring Cloud 应用的服务契约及变更通知</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/178171.html?spm=a2c4g.11186623.6.883.3acc2704SznK71">为 Spring Cloud 服务配置标签路由</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/202837.html?spm=a2c4g.11186623.6.884.7ee32dedhNJZ4D">为 Spring Cloud 服务配置服务降级</a></li>
</ul>
</li>
<li><p>安全和可用性</p>
<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/145687.html?spm=a2c4g.11186623.6.874.17c71829c6xcw6">使用利群实例摘除保障 Spring Cloud 应用的可用性</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/155527.html?spm=a2c4g.11186623.6.875.16d1262cv2vB3u">使用服务鉴权实现 Spring Cloud 应用的访问控制</a></li>
</ul>
</li>
<li><p>服务测试</p>
<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/175622.html?spm=a2c4g.11186623.6.877.58a67b78loMcN0">测试 Spring Cloud 服务</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/197048.html?spm=a2c4g.11186623.6.878.2be31d364Gjuvi">压测 Spring Cloud 服务</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/197050.html?spm=a2c4g.11186623.6.879.739e137fFQDkdx">巡检 Spring Cloud 服务</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/197049.html?spm=a2c4g.11186623.6.880.11961d10AYLpBO">自动化回归 Spring Cloud 服务的测试用例</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/215554.html?spm=a2c4g.11186623.6.881.7dc3688aTYKTgW">自动化回归 Spring Cloud 服务的测试用例集</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/266714.html?spm=a2c4g.11186623.6.882.21bb369dHBsCrf">自动化回归 Spring Cloud 服务的脚本化编排</a></li>
</ul>
</li>
<li><p>全链路流量控制</p>
<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/207624.html?spm=a2c4g.11186623.6.886.41977f97hWNSWc">全链路流量控制简介</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/207756.html?spm=a2c4g.11186623.6.887.195b4482JssObx">使用全链路流量控制监控入口应用的流量</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/207757.html?spm=a2c4g.11186623.6.888.37be3e19EeTSfy">使用全链路流量控制将流量路由到目标应用</a></li>
</ul>
</li>
</ul>
<h1 id="Dubbo-服务治理"><a href="#Dubbo-服务治理" class="headerlink" title="Dubbo 服务治理"></a>Dubbo 服务治理</h1><ul>
<li>金丝雀发布<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/199078.html?spm=a2c4g.11186623.6.892.27cf2d054RwxEH">金丝雀发布（K8s）</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/199080.html?spm=a2c4g.11186623.6.893.24fb121cF1JKYI">金丝雀发布（ECS）</a></li>
</ul>
</li>
<li>部署和运维<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/131248.html?spm=a2c4g.11186623.6.890.4ef430dc4itVH2">无损下线 Dubbo 应用</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/155529.html?spm=a2c4g.11186623.6.894.52eb7f2eITZNoH">查询 Dubbo 服务</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/155532.html?spm=a2c4g.11186623.6.895.50b44e74dhhW8D">查询 Dubbo 服务调用链</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/178172.html?spm=a2c4g.11186623.6.904.12241a4dyU1DFX">为 Dubbo 服务配置标签路由</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/197980.html?spm=a2c4g.11186623.6.905.429b5723JTlH8q">为 Dubbo 服务动态配置超时时间</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/202838.html?spm=a2c4g.11186623.6.906.34a86c76ELPQOw">为 Dubbo 服务配置服务降级</a></li>
</ul>
</li>
<li>安全和可用性<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/141730.html?spm=a2c4g.11186623.6.896.47b17d74E4Pirh">使用离群实例摘除保障 Dubbo 应用的可用性</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/155528.html?spm=a2c4g.11186623.6.897.609d71ebVS5oXN">使用服务鉴权实现 Dubbo 应用的访问控制</a></li>
</ul>
</li>
<li>服务测试<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/175623.html?spm=a2c4g.11186623.6.898.6ded770ew4RPcZ">测试 Dubbo 服务</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/197053.html?spm=a2c4g.11186623.6.899.56813576WuKFyL">压测 Dubbo 服务</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/197052.html?spm=a2c4g.11186623.6.900.35ec1afc1V6Ylk">巡检 Dubbo 服务</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/197051.html?spm=a2c4g.11186623.6.901.15bc4bc16MACax">自动化回归 Dubbo 服务的测试用例</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/215555.html?spm=a2c4g.11186623.6.902.2ead3de3LiOmUJ">自动化回归 Dubbo 服务的测试用例集</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/266715.html?spm=a2c4g.11186623.6.903.39b77495sgBMMi">自动化回归 Dubbo 的服务脚本化编排</a></li>
</ul>
</li>
<li>全链路流量监控<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/207627.html?spm=a2c4g.11186623.6.908.278b18dbJ54ZEF">全链路流量控制简介</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/207758.html?spm=a2c4g.11186623.6.909.3b184482Mb1l1i">使用全链路流量控制监控入口应用的流量</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/207759.html?spm=a2c4g.11186623.6.910.5cfd3e19xwMj9X">使用全链路流量控制将流量路由到目标应用</a></li>
</ul>
</li>
</ul>
<h1 id="HSF-服务治理"><a href="#HSF-服务治理" class="headerlink" title="HSF 服务治理"></a>HSF 服务治理</h1><ul>
<li>部署和运维<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/145048.html?spm=a2c4g.11186623.6.915.5991689fWPuIZW">无损上线 HSF 应用</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/155531.html?spm=a2c4g.11186623.6.912.4bb930dcW5mF3D">查询 HSF 服务</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/155533.html?spm=a2c4g.11186623.6.913.3d774cd9Qendja">查询 HSF 服务调用链</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/102369.html?spm=a2c4g.11186623.6.916.46a73c2aTkXomh">查看 HSF 服务报表</a></li>
</ul>
</li>
<li>全链路流量控制<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/107944.html?spm=a2c4g.11186623.6.918.a318192b76sjZh">全链路流量控制简介</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/125778.html?spm=a2c4g.11186623.6.919.7bec44823M3lQM">如何通过全链路流控升级单个应用</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/131940.html?spm=a2c4g.11186623.6.920.290a440dwxPuZ9">如何使用全链路流量控制排查应用问题</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/107931.html?spm=a2c4g.11186623.6.921.65774fc7WnnBUx">单应用流量控制</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/107558.html?spm=a2c4g.11186623.6.922.717d630cLh2FDh">多应用创建流量控制环境</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/114314.html?spm=a2c4g.11186623.6.923.4ab56a12LrFmky">监控灰度流量</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/108899.html?spm=a2c4g.11186623.6.924.41fd2811p22qKr">全链路流量控制的约束限制</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/108686.html?spm=a2c4g.11186623.6.925.44841f70WcDQFL">全链路流量控制策略</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/110392.html?spm=a2c4g.11186623.6.926.41fd27d0NbckfU">流控规则参数说明</a></li>
</ul>
</li>
<li>安全和可用性<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/147122.html?spm=a2c4g.11186623.6.914.55e468f3bifzia">使用离群实例摘除保障 HSF 应用的可用性</a></li>
</ul>
</li>
</ul>
<h1 id="多语言服务治理"><a href="#多语言服务治理" class="headerlink" title="多语言服务治理"></a>多语言服务治理</h1><ul>
<li>金丝雀发布<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/189257.html?spm=a2c4g.11186623.6.929.60ee3e73BVXNyn">金丝雀发布多语言应用</a></li>
</ul>
</li>
<li>部署和运维<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/189256.html?spm=a2c4g.11186623.6.928.381855acPVgksY">查询多语言应用服务</a></li>
</ul>
</li>
<li>安全和可用性<ul>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/195673.html?spm=a2c4g.11186623.6.930.26b141efr8mh3m">使用服务鉴权实现多语言应用的访问控制</a></li>
<li><a target="_blank" rel="noopener" href="https://help.aliyun.com/document_detail/202261.html?spm=a2c4g.11186623.6.931.602d596bzuvkF7">使用离群实例摘除保障多语言应用的可用性</a></li>
</ul>
</li>
</ul>
