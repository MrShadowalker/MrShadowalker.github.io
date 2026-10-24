---
layout: post
title: "浅谈 jar、war、ear 包的作用与区别"
date: 2017-12-07 17:20:14.000
updated: 2017-12-07 17:20:14.000
permalink: /articles/Java-jar-war-ear.html
comments: true
description: "Valar Morghulis"
categories:
  - "编程开发"
tags:
  - "Java"
---

<h1 id="介绍"><a href="#介绍" class="headerlink" title="介绍"></a>介绍</h1><table>
<thead>
<tr>
<th align="center"></th>
<th align="center">jar</th>
<th align="center">war</th>
<th align="center">ear</th>
</tr>
</thead>
<tbody><tr>
<td align="center">英文</td>
<td align="center">Java Archive file</td>
<td align="center">Web Archive file</td>
<td align="center">Enterprise Archive file</td>
</tr>
<tr>
<td align="center">包含内容</td>
<td align="center">class、properties文件，是文件封装的最小单元；包含Java类的普通库、资源（resources）、辅助文件（auxiliary files）等</td>
<td align="center">Servlet、JSP页面、JSP标记库、jar库文件、Html&#x2F;XML文档和其他公用资源文件，如图片、音频文件等</td>
<td align="center">除了包含jar、war以外，还包括EJB组件</td>
</tr>
<tr>
<td align="center">部署文件</td>
<td align="center">application-client.xml</td>
<td align="center">web.xml</td>
<td align="center">application.xml</td>
</tr>
<tr>
<td align="center">容器</td>
<td align="center">应用服务器（application servers）</td>
<td align="center">小型服务程序容器（servlet containers）</td>
<td align="center">EJB容器（EJB containers）</td>
</tr>
<tr>
<td align="center">级别</td>
<td align="center">小</td>
<td align="center">中</td>
<td align="center">大</td>
</tr>
</tbody></table>
<!--more-->

<h2 id="war-文件的使用"><a href="#war-文件的使用" class="headerlink" title="war 文件的使用"></a>war 文件的使用</h2><ul>
<li>生成 war 包文件命令</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">jar -cvf web.war 被打包文件</span><br></pre></td></tr></table></figure>

<ul>
<li>查看 war 包内容命令</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">jar -tf web.war</span><br></pre></td></tr></table></figure>

<ul>
<li>解压 war 包文件命令</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">jar -xf web.war　　</span><br></pre></td></tr></table></figure>

<p>也可使用 winrar 软件选择 zip 压缩方式，并将压缩文件后缀名改为 war 即可压缩生成 war 文件。</p>
<p>同样使用 winrar 软件可以打开 war 文件，或者解压 war 文件。</p>
<p>使用 jar 命令与 winrar 软件的区别在于前者在压缩文件的同时会生成 META-INF 文件夹，内包含 MANIFEST.MF 文件。</p>
<h2 id="ear-文件的打包"><a href="#ear-文件的打包" class="headerlink" title="ear 文件的打包"></a>ear 文件的打包</h2><p>ear 文件包括整个 JSP 项目，内含多个 EJB Module（jar文件）和 Web Module（WAR文件）。</p>
<p>ear 文件的生成可以使用 winrar（windows平台上的软件）以 zip 压缩方式或者从命令行以 jar 命令来生成。</p>
<p>操作步骤：</p>
<ul>
<li><p>先打包成 war 和 jar，并写好 application.xml，放到 META-INF 目录下。</p>
</li>
<li><p>打包命令：（进入文件所在目录）</p>
</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">jar cf application.ear application.war application.jar META-INF\application.xml</span><br></pre></td></tr></table></figure>

<p>application.xml 是用来描述 ear 中包括的 war 和 jar 等包文件。</p>
<ul>
<li>解包命令</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">jar xf application.ear -C 目标路径</span><br></pre></td></tr></table></figure>

<p>以下附上 Weblogic 自带的 petstore 的 application.xml 代码：</p>
<figure class="highlight xml"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br><span class="line">19</span><br><span class="line">20</span><br><span class="line">21</span><br><span class="line">22</span><br><span class="line">23</span><br><span class="line">24</span><br><span class="line">25</span><br><span class="line">26</span><br><span class="line">27</span><br><span class="line">28</span><br><span class="line">29</span><br><span class="line">30</span><br><span class="line">31</span><br><span class="line">32</span><br><span class="line">33</span><br><span class="line">34</span><br><span class="line">35</span><br><span class="line">36</span><br><span class="line">37</span><br><span class="line">38</span><br><span class="line">39</span><br><span class="line">40</span><br><span class="line">41</span><br><span class="line">42</span><br><span class="line">43</span><br></pre></td><td class="code"><pre><span class="line"><span class="meta">&lt;!DOCTYPE <span class="keyword">application</span> <span class="keyword">PUBLIC</span> <span class="string">&#x27;-//Sun Microsystems, Inc.//DTD J2EE Application 1.2//EN&#x27;</span> <span class="string">&#x27;http://java.sun.com/j2ee/dtds/application_1_2.dtd&#x27;</span>&gt;</span> </span><br><span class="line"> <span class="tag">&lt;<span class="name">application</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">display-name</span>&gt;</span>estore<span class="tag">&lt;/<span class="name">display-name</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">description</span>&gt;</span>Application description<span class="tag">&lt;/<span class="name">description</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">module</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">ejb</span>&gt;</span>customerEjb.jar<span class="tag">&lt;/<span class="name">ejb</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">module</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">module</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">ejb</span>&gt;</span>mailerEjb.jar<span class="tag">&lt;/<span class="name">ejb</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">module</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">module</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">web</span>&gt;</span> </span><br><span class="line">             <span class="tag">&lt;<span class="name">web-uri</span>&gt;</span>petstore.war<span class="tag">&lt;/<span class="name">web-uri</span>&gt;</span> </span><br><span class="line">             <span class="tag">&lt;<span class="name">context-root</span>&gt;</span>estore<span class="tag">&lt;/<span class="name">context-root</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;/<span class="name">web</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">module</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">module</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">ejb</span>&gt;</span>petstoreEjb.jar<span class="tag">&lt;/<span class="name">ejb</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">module</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">module</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">ejb</span>&gt;</span>signonEjb.jar<span class="tag">&lt;/<span class="name">ejb</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">module</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">module</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">ejb</span>&gt;</span>personalizationEjb.jar<span class="tag">&lt;/<span class="name">ejb</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">module</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">module</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">ejb</span>&gt;</span>inventoryEjb.jar<span class="tag">&lt;/<span class="name">ejb</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">module</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">module</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">ejb</span>&gt;</span>shoppingcartEjb.jar<span class="tag">&lt;/<span class="name">ejb</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">module</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">security-role</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">description</span>&gt;</span>the gold customer role<span class="tag">&lt;/<span class="name">description</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">role-name</span>&gt;</span>gold_customer<span class="tag">&lt;/<span class="name">role-name</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">security-role</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">security-role</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">description</span>&gt;</span>the customer role<span class="tag">&lt;/<span class="name">description</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">role-name</span>&gt;</span>customer<span class="tag">&lt;/<span class="name">role-name</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">security-role</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;<span class="name">security-role</span>&gt;</span> </span><br><span class="line">         <span class="tag">&lt;<span class="name">role-name</span>&gt;</span>administrator<span class="tag">&lt;/<span class="name">role-name</span>&gt;</span> </span><br><span class="line">     <span class="tag">&lt;/<span class="name">security-role</span>&gt;</span> </span><br><span class="line"> <span class="tag">&lt;/<span class="name">application</span>&gt;</span></span><br></pre></td></tr></table></figure>



<h1 id="区别与联系"><a href="#区别与联系" class="headerlink" title="区别与联系"></a>区别与联系</h1><h2 id="jar、war、ear-作用与区别"><a href="#jar、war、ear-作用与区别" class="headerlink" title="jar、war、ear 作用与区别"></a>jar、war、ear 作用与区别</h2><h3 id="jar"><a href="#jar" class="headerlink" title="jar"></a>jar</h3><p>把开发时要引用通用 Java 类及资源做封装，打成包后便于存放管理；</p>
<h3 id="war"><a href="#war" class="headerlink" title="war"></a>war</h3><p>一个(web)完整的应用，通常是网站或 WEB 平台，打成包部署到容器中；</p>
<h3 id="ear"><a href="#ear" class="headerlink" title="ear"></a>ear</h3><p>企业级应用，实际上 EAR 包中包含 WAR 包和几个企业级项目的配置文件而已，服务器中间件通常选择 WebSphere 等都会使用 EAR 包。</p>
<p>通常是 EJB 打成 ear 包。</p>
<h2 id="打包方式"><a href="#打包方式" class="headerlink" title="打包方式"></a>打包方式</h2><ul>
<li><p>所有的包都是用 jar 命令制作，只不过目标文件的扩展名不一样。</p>
</li>
<li><p>也可以用 Ant 来构建。</p>
</li>
<li><p>Windows 平台 winrar 命令。</p>
</li>
</ul>
<h2 id="何时使用-war-包"><a href="#何时使用-war-包" class="headerlink" title="何时使用 war 包"></a>何时使用 war 包</h2><p>在项目在没有完全开发完成时，不适合使用 war 文件，因为你的类会由于调试之类的经常被修改，来回创建 war 包很麻烦。</p>
<p>当项目完全开发完成后续无需修改时，可以创建 war 包。</p>
<p>这个时候 war 包文件就相当于一个 web 应用程序；而 jar 文件就是把类和一些相关的资源封装到一个包中，便于程序中引用。</p>
