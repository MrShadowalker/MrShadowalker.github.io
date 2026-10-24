---
layout: post
title: "超级账本——面向企业的分布式账本"
date: 2018-09-07 13:54:26.000
updated: 2018-09-07 13:54:26.000
permalink: /articles/Blockchain-Hyperledger.html
comments: true
description: "Valar Morghulis"
categories:
  - "区块链"
tags:
  - "Blockchain"
  - "Fabric"
  - "Hyperledger"
---

<p>超级账本（Hyperledger）项目是首个面向企业应用场景的开源分布式账本平台。</p>
<p>本文将简单介绍超级账本项目的发展历史和社区组织，以及旗下的多个顶级开源项目的情况，还将展示开源社区提供的多个高效开发工具。</p>
<!--more-->

<h1 id="超级账本项目简介"><a href="#超级账本项目简介" class="headerlink" title="超级账本项目简介"></a>超级账本项目简介</h1><p>2015 年 12 月，由 Linux 基金会牵头，30 家初始成员，包括 IBM、Intel、Cisco、SWIFT 等，共同宣布了 Hyperledger 联合项目成立。超级账本项目为透明、公开、去中心化的企业级分布式账本技术提供开源参考实现，并推动区块链和分布式账本相关协议、规范和标准的发展。项目官网为 <a href="hyperledger.org">hyperledger.org</a></p>
<p>作为一个联合项目，超级账本由面向不同目的和场景的子项目构成。目前包括 Fabric、Sawtooth、Iroha、Blockchain Explorer、Cello、Indy、Composer、Burrow 等 8 大顶级项目，所有项目都遵守 Apache v2 许可，并约定共同遵守如下的基本原则：</p>
<ul>
<li>重视模块化设计：包括交易、合同、一致性、身份、存储等技术场景；</li>
<li>重视代码可读性：保障新功能和模块都可以很容易添加和扩展；</li>
<li>可持续的演化路线：随着需求的深入和更多的应用场景，不断增加和演化新的项目。</li>
</ul>
<p><strong>如果说以比特币为代表的数字货币提供了区块链技术应用的原型，以太坊为代表的智能合约平台延伸了区块链技术的功能，那么进一步引入权限控制和安全保障的超级账本项目则开拓了区块链技术的全新领域。</strong>超级账本首次将区块链技术引入到了分布式联盟账本的应用场景，这就为未来基于区块链技术打造高效的商业网络打下了坚实的基础。</p>
<p>超级账本项目的出现，实际上宣布区块链技术已经不仅局限在单一应用场景中，也不仅局限在完全开放的公有链模式下，区块链技术已经正式被主流企业市场认可并在实践中采用。同时，超级账本项目中提出和实现了许多创新的设计和理念，包括完备的权限和审查管理、细粒度隐私保护，以及可拔插、可扩展的实现框架，对于区块链相关技术和产业的发展都将产生深远的影响。</p>
<h1 id="社区组织结构"><a href="#社区组织结构" class="headerlink" title="社区组织结构"></a>社区组织结构</h1><h2 id="基本结构"><a href="#基本结构" class="headerlink" title="基本结构"></a>基本结构</h2><p>超级账本社区目前主要是三驾马车领导的结构：</p>
<ul>
<li>技术委员会（TSC）：负责技术相关的工作，下设多个工作组，具体带动各个项目和方向的发展；</li>
<li>管理董事会：负责社区组织的整体决策，由超级账本会员中推选出代表；</li>
<li>Linux 基金会（LF）：负责基金管理，协助 Hyperledger 社区在 Linux 基金会的支持下发展。</li>
</ul>
<h2 id="大中华区技术工作组"><a href="#大中华区技术工作组" class="headerlink" title="大中华区技术工作组"></a>大中华区技术工作组</h2><p>技术工作组的主要职责包括：</p>
<ul>
<li>带领和引导大中华区的技术相关活动，包括贡献代码、指南文档、项目提案等；</li>
<li>推动技术相关的交流，促进会员企业之间的合作和实践案例的落地；</li>
<li>通过邮件列表、RocketChat、论坛等方式促进社区开发者们的技术交流；</li>
<li>协助举办社区活动，包括 Meetuo、黑客松、Hackfest、技术分享、培训等。</li>
</ul>
<p>目前，工作组由来自 IBM、万达、华为等超级账本成员企业的数十名技术专家组成，并得到了社区众多志愿者的支持。工作组的各项会议和活动内容都是开放的，可以在 <a target="_blank" rel="noopener" href="https://wiki.hyperledger.org/groups/tsc/technical-working-group-china">Wiki</a> 首页上找到相关参与方式。</p>
<h1 id="顶级项目介绍"><a href="#顶级项目介绍" class="headerlink" title="顶级项目介绍"></a>顶级项目介绍</h1><p>超级账本（Hyperledger）所有项目代码托管在 Gerrit 和 Github（只读，自动从 Gerrit 上同步）上。</p>
<p>目前，主要包括如下顶级项目：</p>
<ul>
<li>Fabric：包括 Fabric、Fabric CA、Fabric SDK（包括 Node.js、Python 和 Java 等语言）和 fabric-api 等，目标是区块链的基础核心平台，支持 PBFT 等新的共识机制，支持权限管理，最早由 IBM 和 DAH 发起；</li>
<li>Sawtooth：包括 arcade、core、dev-tools、validator、mktplace等，是 Intel 主要发起和贡献的区块链平台，支持全新的基于硬件芯片的共识机制 Proof of Elapsed Time（PoET）；</li>
<li>Iroha：账本平台项目，基于 C++ 实现，带有不少面向 Web 和 Mobile 的特性，主要由 Soramitsu 发起和贡献；</li>
<li>Blockchain Explorer：提供 Web 操作界面，通过界面快速查看查询绑定区块链的状态（区块个数、交易历史）信息等，由 DTCC、IBM、Intel 等开发支持；</li>
<li>Cello：提供区块链平台的部署和运行时管理功能。使用 Cello，管理员可以轻松部署和管理多条区块链；应用开发者可以无需关心如何搭建和维护区块链，由 IBM 团队发起；</li>
<li>Indy：根据基于分布式账本技术的数字身份管理机制，由 Sovrin 基金会发起；</li>
<li>Composer：提供面向链码（链码的概念参见后面介绍）开发的高级语言支持，自动生成链码等，由 IBM 团队发起并维护；</li>
<li>Burrow：提供以太坊虚拟机的支持，实现支持高效交易的带权限的区块链平台，由 Monax 公司发起支持。</li>
</ul>
<p>这些顶级项目相互协作，构成了完善的生态系统。</p>
<p>所有项目一般都需要经历提案（Proposal）、孵化（Incubation）、活跃（Active）、退出（Deprecated）。终结（End of Life）等 5 个生命周期。</p>
<p>任何希望加入到 Hyperledger 社区中的项目，必须首先由发起人编写提案。描述项目的目的、范围和开发计划等重要信息，并由技术委员会来进行评审投票，评审通过则可以进入到社区内进行孵化。项目成熟后可以申请进入到活跃状态，发布正式的版本，最后从社区中退出并结束。</p>
<h2 id="Fabric-项目"><a href="#Fabric-项目" class="headerlink" title="Fabric 项目"></a>Fabric 项目</h2><p>Fabric 是最早加入到超级账本项目中的顶级项目，由 IBM、DAH 等企业于 2015 年底提交到社区。<a target="_blank" rel="noopener" href="https://github.com/hyperledger/fabric">项目地址</a></p>
<p>该项目的定位是面向企业的分布式账本平台，创新地引入了权限管理支持，设计上支持可拔插、可扩展，是首个面向联盟链场景的开源项目。</p>
<p>Fabric 基于 Go 语言实现，目前提交次数已超过 5000 次，核心代码超过 8 万行。</p>
<p>Fabric 项目目前处于活跃状态，已发布 1.3 正式版本，同时包括 Fabric CA、Fabric SDK 等多个相关的子项目。</p>
<h2 id="Sawtooth-项目"><a href="#Sawtooth-项目" class="headerlink" title="Sawtooth 项目"></a>Sawtooth 项目</h2><p>Sawtooth 项目由 Intel 等企业于 2016 年 4 月提交到社区。核心代码的<a target="_blank" rel="noopener" href="https://github.com/hyperledger/sawtooth-core">项目地址</a></p>
<p>该项目的定位也是分布式账本平台，基于 Python 语言实现，目前提交次数已经超过 3000 次。</p>
<p>Sawtooth 项目利用 Intel 芯片的专属功能，实现了低功耗的 Proof of Elasped Time（PoET）共识机制，并支持交易族（Transaction Family），方便用户使用它来快速开发应用。</p>
<h2 id="Iroha-项目"><a href="#Iroha-项目" class="headerlink" title="Iroha 项目"></a>Iroha 项目</h2><p>Iroha 项目由 Soramitsu 等企业于 2016 年 10 月提交到社区。核心代码的<a target="_blank" rel="noopener" href="https://github.com/hyperledger/iroha">项目地址</a></p>
<p>该项目的定位是分布式账本平台框架，基于 C++ 语言实现，目前提交辞树已经超过 2000 次。</p>
<p>Iroha 项目在设计上类似 Fabric，同时提供了基于 C++ 的区块链开发环境，并考虑了移动端和 Web 端的一些需求。</p>
<h2 id="Blockchain-Explorer-项目"><a href="#Blockchain-Explorer-项目" class="headerlink" title="Blockchain Explorer 项目"></a>Blockchain Explorer 项目</h2><p>Blockchain Explorer 项目由 Intel、DTCC、IBM 等企业于 2016 年 8 月提交到社区。核心代码的<a target="_blank" rel="noopener" href="https://github.com/hyperledger/blockchain-explorer">项目地址</a></p>
<p>该项目的定位是区块链平台的浏览器，基于 Node.js 语言实现，提供 Web 操作界面。用户可以使用它来快速查看底层区块链平台的运行信息，如区块个数、交易情况。网络状况等。</p>
<h2 id="Cello-项目"><a href="#Cello-项目" class="headerlink" title="Cello 项目"></a>Cello 项目</h2><p>Cello 项目由 IBM 技术团队于 2017 年 1 月贡献到社区。<a target="_blank" rel="noopener" href="https://github.com/hyperledger/cello">核心代码</a> &amp; <a target="_blank" rel="noopener" href="https://github.com/hyperledger/cello-analytics">数据分析</a></p>
<p>该项目的定位为区块链管理平台，同时提供区块链即服务（Blockchain-as-a-Service），实现区块链环境的快速部署，以及对区块链平台的运行时管理。使用 Cello，可以让区块链应用人员专注到应用开发，而无需关心底层平台的管理和维护。</p>
<p>Cello 的主要开发语言为 Python 和 JavaScript 等，底层支持包括裸机、虚拟机、容器云（包括 Swarm、Kubernetes）等多种基础架构。</p>
<h2 id="Indy-项目"><a href="#Indy-项目" class="headerlink" title="Indy 项目"></a>Indy 项目</h2><p>Indy 项目由 Sovrin 基金会牵头进行开发，致力于打造一个基于区块链和分布式账本技术的数字中心管理平台。该平台支持去中心化，支持跨区块链和跨应用的操作，可实现全球化的身份管理。Indy 项目于 2017 年 3 月底正式加入到超级账本项目。</p>
<p>该项目主要由 Python 语言开发，包括服务节点、客户端和通用库等，目前已有超过 1000 次提交。</p>
<h2 id="Composer-项目"><a href="#Composer-项目" class="headerlink" title="Composer 项目"></a>Composer 项目</h2><p>Composer 项目由 IBM 团队于 2017 年 3 月底贡献到社区，试图提供一个 Hyperledger Fabric 的开发辅助框架。使用 Composer，开发人员可以使用 JavaScript 语言定义应用逻辑，再加上资源、参与者、交易等模型和访问规则，生成 Hyperledger Fabric 支持的链码。</p>
<p>该项目主要由 Node.js 语言开发，目前已经超过 4000 次提交。</p>
<h2 id="Burrow-项目"><a href="#Burrow-项目" class="headerlink" title="Burrow 项目"></a>Burrow 项目</h2><p>Burrow 项目由 Monax、Intel 等企业于 2017 年4 月提交到社区。核心代码的<a target="_blank" rel="noopener" href="https://github.com/hyperledger/burrow">项目地址</a></p>
<p>该项目的前身为 eris-db，基于 Go 语言实现，目前提交次数已经超过 1000 次。</p>
<p>Burrow 项目提供了支持以太坊虚拟机的智能合约区块链平台，并支持 Proof-of-Stake 共识机制和权限管理，可以提供快速的区块链交易。</p>
<h1 id="开发必备工具"><a href="#开发必备工具" class="headerlink" title="开发必备工具"></a>开发必备工具</h1><h2 id="Linux-Foundation-ID"><a href="#Linux-Foundation-ID" class="headerlink" title="Linux Foundation ID"></a>Linux Foundation ID</h2><p><a target="_blank" rel="noopener" href="https://identity.linuxfoundation.org/">注册地址</a></p>
<p>用户使用该 ID 即可访问到包括 Jira、Gerrit、RocketChat 等社区的开发工具。</p>
<h2 id="Jira——任务和进度管理"><a href="#Jira——任务和进度管理" class="headerlink" title="Jira——任务和进度管理"></a>Jira——任务和进度管理</h2><p>Jira 是 Atlassian 公司开发的一套任务管理和事项跟踪的追踪平台，提供 Web 操作界面，使用十分方便。</p>
<p><a href="jira.hyperledger.org">社区地址</a>，作为所有项目开发计划和任务追踪的入口。</p>
<h2 id="Gerrit——代码仓库和-Review-管理"><a href="#Gerrit——代码仓库和-Review-管理" class="headerlink" title="Gerrit——代码仓库和 Review 管理"></a>Gerrit——代码仓库和 Review 管理</h2><p>Gerrit 是一个负责代码协同的开源项目，很多企业和团队都使用它负责代码仓库管理和代码的审阅工作，同样提供了 Web 操作界面。</p>
<p><a href="gerrit.hyperledger.org">社区地址</a>，作为官方的代码仓库，并实时同步代码到 github.com&#x2F;hyperledger 作为只读镜像。</p>
<h2 id="RocketChat——在线沟通"><a href="#RocketChat——在线沟通" class="headerlink" title="RocketChat——在线沟通"></a>RocketChat——在线沟通</h2><p><a href="chat.hyperledger.org">社区服务器</a>，包含 Web 版和 Client 版。</p>
<h1 id="贡献代码"><a href="#贡献代码" class="headerlink" title="贡献代码"></a>贡献代码</h1><p>超级账本的各个子项目都提供了十分丰富的开发和提交代码的指南和文档，一般可以在代码的 docs 目录下找到。大部分项目贡献代码的流程都是相似的，此处以 Fabric 项目为例进行讲解。</p>
<h2 id="安装环境"><a href="#安装环境" class="headerlink" title="安装环境"></a>安装环境</h2><p>推荐在 Linux 或 MacOS 环境中开发 Hyperledger 项目代码。</p>
<p>不同项目会依赖不同的环境，均可从项目文档中找到。以 Fabric 为例，开发需要安装以下依赖：</p>
<ul>
<li>Git：获取代码并进行版本管理</li>
<li>Golang：安装并配置 $GOPATH 环境变量</li>
<li>Docker：用来支持容器环境</li>
</ul>
<h2 id="获取代码"><a href="#获取代码" class="headerlink" title="获取代码"></a>获取代码</h2><figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br></pre></td><td class="code"><pre><span class="line">$ <span class="built_in">mkdir</span> <span class="variable">$GOPATH</span>/src/github.com/hyperledger</span><br><span class="line">$ <span class="built_in">cd</span> <span class="variable">$GOPATH</span>/src/github.com/hyperledger</span><br><span class="line">$ git <span class="built_in">clone</span> http://gerrit.hyperledger.org/r/fabric</span><br></pre></td></tr></table></figure>
<p>关于 Git 的 SSH、用户名、邮箱等设置，此处就不讲了。</p>
<h2 id="编译和测试"><a href="#编译和测试" class="headerlink" title="编译和测试"></a>编译和测试</h2><p>大部分编译和安装过程都可以用 Makefile 来执行，具体以项目代码为准。</p>
<p>以 Fabric 项目为例，常见操作如下：</p>
<ul>
<li>安装 go tools</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">$ make gotools</span><br></pre></td></tr></table></figure>

<ul>
<li>语法格式检查</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">$ make linter</span><br></pre></td></tr></table></figure>

<ul>
<li>编译 peer</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br></pre></td><td class="code"><pre><span class="line">$ make peer</span><br><span class="line">会自动编译生成 Docker 镜像，并生成本地 peer 可执行文件。</span><br><span class="line">注意，有时候会因为获取安装包不稳定而报错，需要执行 make clean，然后再次执行。</span><br></pre></td></tr></table></figure>

<ul>
<li>生成 Docker 镜像</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">$ make image</span><br></pre></td></tr></table></figure>

<ul>
<li>执行所有的检查和测试</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">$ make checks</span><br></pre></td></tr></table></figure>

<ul>
<li>执行单元测试</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br></pre></td><td class="code"><pre><span class="line">$ make unit-test</span><br><span class="line">如果要运行某个特定单元测试，则可以通过类似如下格式：</span><br><span class="line">$ go <span class="built_in">test</span> -v -run=TestGetFoo</span><br></pre></td></tr></table></figure>

<ul>
<li>执行 BDD 测试</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line">需先生成本地 Docker 镜像。执行如下命令：</span><br><span class="line">$ nake behave</span><br></pre></td></tr></table></figure>

<h2 id="提交代码"><a href="#提交代码" class="headerlink" title="提交代码"></a>提交代码</h2><p>Git 常规操作，就不多 BB 了。</p>
<h2 id="评审代码"><a href="#评审代码" class="headerlink" title="评审代码"></a>评审代码</h2><h1 id="总结"><a href="#总结" class="headerlink" title="总结"></a>总结</h1><p>超级账本项目是 Linux 基金会近些年来重点支持的面向企业的分布式账本平台。它同时也是开源界和工业界技术力量颇有历史意义的携手合作，共同为分布式账本技术提供了在代码实现、协议和规范标准上的技术参考。</p>
<p>超级账本社区重视技术研发的同时，也十分重视应用的落地。目前基于超级账本相关技术，已经出现了大量的企业应用案例。</p>
