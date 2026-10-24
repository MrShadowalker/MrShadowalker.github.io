---
layout: post
title: "CTF干货系列——工具资源——Burp_Suite_Pro教程"
date: 2017-10-29 13:59:03.000
updated: 2017-10-29 13:59:03.000
permalink: /articles/Tool-Burp-Suite-Pro.html
comments: true
description: "Valar Morghulis"
categories:
  - "信息安全"
tags:
  - "工具"
  - "教程"
---

<h1 id="简介"><a href="#简介" class="headerlink" title="简介"></a>简介</h1><p>Burp Suite 是用于攻击 Web 应用程序的集成平台。它包含了很多工具，并为这些工具设计了许多接口，以促进加快攻击应用程序的过程。所有的工具都共享一个能处理并显示 HTTP 消息、持久性、认证、代理、日志、警报的一个强大的可扩展的框架。</p>
<!--more-->

<h1 id="资源"><a href="#资源" class="headerlink" title="资源"></a>资源</h1><p><a target="_blank" rel="noopener" href="http://pan.baidu.com/s/1gfnd5RH">Burp Suite Pro 1.7.17</a>，提取密码：0554</p>
<h1 id="教程"><a href="#教程" class="headerlink" title="教程"></a>教程</h1><h2 id="安装使用"><a href="#安装使用" class="headerlink" title="安装使用"></a>安装使用</h2><p>只需要在安装 JDK 的环境中运行 jar 包即可。</p>
<h3 id="Tips"><a href="#Tips" class="headerlink" title="Tips"></a>Tips</h3><p>推荐用 FireFox 浏览器，因为丰富的插件更方便在开发者模式下进行各种神奇的操作。</p>
<ul>
<li>首先安装一个插件，叫做 AutoProxy，相关配置如下：</li>
</ul>
<p>打开插件首选项，在代理服务器选择编辑代理服务器，名字随意，添加代理：</p>
<figure class="highlight apache"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="attribute">Burp</span> Suite    <span class="number">127.0.0.1</span>	<span class="number">8080</span>	http</span><br></pre></td></tr></table></figure>
<p>然后选择代理服务器，选择默认代理服务器为Burp Suite。</p>
<p>之后在浏览器工具栏，推荐选择全局代理模式。</p>
<ul>
<li>FireFox 浏览器选项中，连接设置中，选择手动配置代理，相关配置如下：</li>
</ul>
<p>HTTP 代理：127.0.0.1	端口：8080</p>
<p>在“为所有协议使用相同代理服务器”前打对勾。</p>
<h2 id="模块简介及相关设置"><a href="#模块简介及相关设置" class="headerlink" title="模块简介及相关设置"></a>模块简介及相关设置</h2><h3 id="Target——目标"><a href="#Target——目标" class="headerlink" title="Target——目标"></a>Target——目标</h3><p>现实目标目录结构的一个功能。</p>
<h4 id="Site-map"><a href="#Site-map" class="headerlink" title="Site map"></a>Site map</h4><h4 id="Scope"><a href="#Scope" class="headerlink" title="Scope"></a>Scope</h4><h3 id="Proxy——代理"><a href="#Proxy——代理" class="headerlink" title="Proxy——代理"></a>Proxy——代理</h3><p>拦截 HTTP&#x2F;S 的代理服务器，作为一个在浏览器和目标应用程序之间的中间人，允许拦截、查看、修改在两个方向上的原始数据流。</p>
<h4 id="Intercept"><a href="#Intercept" class="headerlink" title="Intercept"></a>Intercept</h4><h4 id="HTTP-history"><a href="#HTTP-history" class="headerlink" title="HTTP history"></a>HTTP history</h4><h4 id="WebSockets-history"><a href="#WebSockets-history" class="headerlink" title="WebSockets history"></a>WebSockets history</h4><h4 id="Options"><a href="#Options" class="headerlink" title="Options"></a>Options</h4><p>首先打开设置界面，设置代理监听。</p>
<p>缺省值为 127.0.0.1:8080。</p>
<p>需要注意的是，FireFox 浏览器有个大坑就是，这货需要证书认证，不然一直浏览器报错报错，在这里一开始浪费了我将近一小时来进行各种配置，烦得一匹，后来发现了这个问题，一分钟搞定。</p>
<p>进入浏览器 url 栏输入：127.0.0.1:8080，进入 Burp Suite 主页，点击右上角 CA Certificate 下载证书，然后在浏览器的安全选项中的证书，导入刚刚下载的证书即可。</p>
<h3 id="Spider——爬虫"><a href="#Spider——爬虫" class="headerlink" title="Spider——爬虫"></a>Spider——爬虫</h3><p>应用智能感应的网络爬虫，它能完整地枚举应用程序的内容和功能。</p>
<h4 id="Control"><a href="#Control" class="headerlink" title="Control"></a>Control</h4><h4 id="Options-1"><a href="#Options-1" class="headerlink" title="Options"></a>Options</h4><h3 id="Scanner——扫描器"><a href="#Scanner——扫描器" class="headerlink" title="Scanner——扫描器"></a>Scanner——扫描器</h3><p>高级工具，执行后，它能自动的发现 Web 应用程序的内容和功能。</p>
<h4 id="Issue-activity"><a href="#Issue-activity" class="headerlink" title="Issue activity"></a>Issue activity</h4><h4 id="Scan-queue"><a href="#Scan-queue" class="headerlink" title="Scan queue"></a>Scan queue</h4><h4 id="Live-scanning"><a href="#Live-scanning" class="headerlink" title="Live scanning"></a>Live scanning</h4><h4 id="Issue-definitions"><a href="#Issue-definitions" class="headerlink" title="Issue definitions"></a>Issue definitions</h4><h4 id="Options-2"><a href="#Options-2" class="headerlink" title="Options"></a>Options</h4><h3 id="Intruder——入侵"><a href="#Intruder——入侵" class="headerlink" title="Intruder——入侵"></a>Intruder——入侵</h3><p>一个定制的高度可配置的工具，对Web应用程序进行自动化攻击，如：枚举标识符，收集有用的数据，以及使用 fuzzing 技术探测常规漏洞。</p>
<h4 id="Target"><a href="#Target" class="headerlink" title="Target"></a>Target</h4><h4 id="Positions"><a href="#Positions" class="headerlink" title="Positions"></a>Positions</h4><h4 id="Payloads"><a href="#Payloads" class="headerlink" title="Payloads"></a>Payloads</h4><h4 id="Options-3"><a href="#Options-3" class="headerlink" title="Options"></a>Options</h4><h3 id="Repeater——中继器"><a href="#Repeater——中继器" class="headerlink" title="Repeater——中继器"></a>Repeater——中继器</h3><p>一个靠手动操作来触发单独的 HTTP 请求，并分析应用程序相应的工具。</p>
<h3 id="Sequencer——会话"><a href="#Sequencer——会话" class="headerlink" title="Sequencer——会话"></a>Sequencer——会话</h3><p>用来分析那些不可预知的应用程序会话令牌和重要数据项的随机性工具。</p>
<h4 id="Live-capture"><a href="#Live-capture" class="headerlink" title="Live capture"></a>Live capture</h4><h4 id="Manual-load"><a href="#Manual-load" class="headerlink" title="Manual load"></a>Manual load</h4><h4 id="Analysis-options"><a href="#Analysis-options" class="headerlink" title="Analysis options"></a>Analysis options</h4><h3 id="Decoder——解码器"><a href="#Decoder——解码器" class="headerlink" title="Decoder——解码器"></a>Decoder——解码器</h3><p>进行手动执行或对应用程序数据者智能编码的工具。</p>
<h3 id="Comparer——对比"><a href="#Comparer——对比" class="headerlink" title="Comparer——对比"></a>Comparer——对比</h3><p>通常是通过一些相关的请求和相应得到两项数据的一个可视化的“差异”。</p>
<h3 id="Extender——扩展"><a href="#Extender——扩展" class="headerlink" title="Extender——扩展"></a>Extender——扩展</h3><p>可以让用户加载 Burp Suite 的扩展，使用自己的或第三方代码来扩展 Burp Suite 的功能。</p>
<h4 id="Extensions"><a href="#Extensions" class="headerlink" title="Extensions"></a>Extensions</h4><h4 id="BApp-Store"><a href="#BApp-Store" class="headerlink" title="BApp Store"></a>BApp Store</h4><h4 id="APIs"><a href="#APIs" class="headerlink" title="APIs"></a>APIs</h4><h4 id="Options-4"><a href="#Options-4" class="headerlink" title="Options"></a>Options</h4><h3 id="Project-options——设置"><a href="#Project-options——设置" class="headerlink" title="Project options——设置"></a>Project options——设置</h3><p>对 Burp Suite 的一些设置。</p>
<h4 id="Connections"><a href="#Connections" class="headerlink" title="Connections"></a>Connections</h4><h4 id="HTTP"><a href="#HTTP" class="headerlink" title="HTTP"></a>HTTP</h4><h4 id="SSL"><a href="#SSL" class="headerlink" title="SSL"></a>SSL</h4><h4 id="Sessions"><a href="#Sessions" class="headerlink" title="Sessions"></a>Sessions</h4><h4 id="Misc"><a href="#Misc" class="headerlink" title="Misc"></a>Misc</h4><h3 id="User-options"><a href="#User-options" class="headerlink" title="User options"></a>User options</h3><p>对用户使用的一些设置。</p>
<h4 id="Connections-1"><a href="#Connections-1" class="headerlink" title="Connections"></a>Connections</h4><h4 id="SSL-1"><a href="#SSL-1" class="headerlink" title="SSL"></a>SSL</h4><h4 id="Display"><a href="#Display" class="headerlink" title="Display"></a>Display</h4><h4 id="Misc-1"><a href="#Misc-1" class="headerlink" title="Misc"></a>Misc</h4><h3 id="Alters"><a href="#Alters" class="headerlink" title="Alters"></a>Alters</h3><p>类似于日志的模块。</p>
<h2 id="使用教程"><a href="#使用教程" class="headerlink" title="使用教程"></a>使用教程</h2><h3 id="Target-1"><a href="#Target-1" class="headerlink" title="Target"></a>Target</h3><p>在 Proxy-Intercept 中设置”Intercept is on”，去浏览器打开页面，会发现页面一直在载入，因为我们拦截了发往服务器的请求；</p>
<p>点击 Forward 可以继续发往服务器，Drop 是放弃，Action 是更多操作。</p>
<p>在下面的信息栏，能看到数据包的内容；在这里，我们可以修改数据包，或者提取有用的信息，之后选择不同的操作。</p>
<p>进入 Proxy-HTTP history 就能看到之前的所有请求和相应的数据包。</p>
<p>Target 标签下的 Site map，会列出拦截的站点结构及信息。</p>
<p>Scope 添加过滤规则。回到 Site map 就能利用 Filter 对于想要的信息进行过滤，不显得杂乱无章。</p>
<h3 id="Spider"><a href="#Spider" class="headerlink" title="Spider"></a>Spider</h3><p>Burp Spider 是一个映射 Web 应用程序的工具。它使用多种智能技术对一个应用程序的内容和功能进行去那面的清查。</p>
<h4 id="启用和配置-Spider"><a href="#启用和配置-Spider" class="headerlink" title="启用和配置 Spider"></a>启用和配置 Spider</h4><p>在浏览器中访问一个网站，在 Target 的 Site map 中将目标添加到 Scope。右键目标，选择 Spider this host，就会自动爬下网站的所有内容。</p>
<p>在 Spider 的 Options 中，可以对 Spider 进行各种配置。</p>
<h4 id="Passive-spidering（被动扫描）"><a href="#Passive-spidering（被动扫描）" class="headerlink" title="Passive spidering（被动扫描）"></a>Passive spidering（被动扫描）</h4><h4 id="表单提交"><a href="#表单提交" class="headerlink" title="表单提交"></a>表单提交</h4><h3 id="Scanner"><a href="#Scanner" class="headerlink" title="Scanner"></a>Scanner</h3><h4 id="启动扫描"><a href="#启动扫描" class="headerlink" title="启动扫描"></a>启动扫描</h4><p>根据 Site map 中站点的 url、参数、cookie、表单等进行扫描，安全方面的检测。</p>
<h4 id="Active-scanning"><a href="#Active-scanning" class="headerlink" title="Active scanning"></a>Active scanning</h4><p>主动扫描根据每个路径，按照配置的规则，进行主动探测。相较而言，主动扫描要花费更多时间，但是也更加深入。 </p>
<h4 id="Passive-scanning"><a href="#Passive-scanning" class="headerlink" title="Passive scanning"></a>Passive scanning</h4>
