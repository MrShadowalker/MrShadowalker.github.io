---
layout: post
title: "todoList"
date: 2017-10-27 12:48:32.000
updated: 2017-10-27 12:48:32.000
permalink: /articles/todoList.html
comments: true
description: "Valar Morghulis"
categories:
  - "编程开发"
tags:
  - "Plan"
---

<h1 id="Github-Hexo-搭建个人博客，主题配置"><a href="#Github-Hexo-搭建个人博客，主题配置" class="headerlink" title="Github + Hexo 搭建个人博客，主题配置"></a>Github + Hexo 搭建个人博客，主题配置</h1><p><a target="_blank" rel="noopener" href="http://baixin.io/2015/08/HEXO%E6%90%AD%E5%BB%BA%E4%B8%AA%E4%BA%BA%E5%8D%9A%E5%AE%A2/">参考链接</a> </p>
<!--more-->

<h2 id="清理工作"><a href="#清理工作" class="headerlink" title="清理工作"></a>清理工作</h2><p>之前既然搭建失败了，那么删掉 Github 项目和本地文件夹。然后从0开始，重新搭建。</p>
<h2 id="本地环境搭建"><a href="#本地环境搭建" class="headerlink" title="本地环境搭建"></a>本地环境搭建</h2><h3 id="Node"><a href="#Node" class="headerlink" title="Node"></a>Node</h3><p>检测方式，查看版本号：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">node -v</span><br></pre></td></tr></table></figure>



<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">npm -v</span><br></pre></td></tr></table></figure>

<h3 id="Git"><a href="#Git" class="headerlink" title="Git"></a>Git</h3><figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">git --version</span><br></pre></td></tr></table></figure>



<h2 id="本地文件夹"><a href="#本地文件夹" class="headerlink" title="本地文件夹"></a>本地文件夹</h2><p>新创建一个本地文件夹，我是命名成 myBlog，符合命名规则，看起来舒服一点。之后进入文件夹，操作都在文件夹中。</p>
<h2 id="Hexo-配置"><a href="#Hexo-配置" class="headerlink" title="Hexo 配置"></a>Hexo 配置</h2><p>安装</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">sudo</span> npm install -g hexo</span><br></pre></td></tr></table></figure>

<p>初始化</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo init</span><br></pre></td></tr></table></figure>

<p>部署过程，生成静态页面</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo generate</span><br></pre></td></tr></table></figure>

<p>或简写：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo g</span><br></pre></td></tr></table></figure>

<p>本地启动服务器</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo server</span><br></pre></td></tr></table></figure>

<p>浏览器进入<br><a target="_blank" rel="noopener" href="http://localhost:4000/">http://localhost:4000/</a></p>
<h2 id="Github-配置"><a href="#Github-配置" class="headerlink" title="Github 配置"></a>Github 配置</h2><p>新建仓库，命名为：<br>username.github.io</p>
<p>去<strong>站点配置文件</strong>_config.yml中：</p>
<figure class="highlight yml"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line"><span class="attr">deploy:</span></span><br><span class="line">  <span class="attr">type:</span> <span class="string">git</span></span><br><span class="line">  <span class="attr">repo:</span> <span class="string">https://github.com/username/username.github.io.git</span></span><br><span class="line">  <span class="attr">branch:</span> <span class="string">master</span></span><br></pre></td></tr></table></figure>

<p>然后安装提交插件：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">npm install hexo-deployer-git --save</span><br></pre></td></tr></table></figure>

<p>进行第一次提交：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo deploy</span><br></pre></td></tr></table></figure>

<p>或者简写：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo d</span><br></pre></td></tr></table></figure>

<p>这时候访问你的主页就好</p>
<p><a target="_blank" rel="noopener" href="http://username.github.io/">http://username.github.io</a></p>
<p><strong>以下是部署常用命令</strong></p>
<p>hexo clean 清除原配置</p>
<p>hexo generate 部署</p>
<p>hexo deploy 提交</p>
<h2 id="主题配置"><a href="#主题配置" class="headerlink" title="主题配置"></a>主题配置</h2><p>选择自己喜欢的主题，然后阅读 README.md 文档，因为不同的主题有各自不同的安装配置方法，并不是通用的。</p>
<h2 id="其他配置"><a href="#其他配置" class="headerlink" title="其他配置"></a>其他配置</h2><p>头像、图标等配置，页面语言、风格等配置，自己参照之前的网址。</p>
<h2 id="创作"><a href="#创作" class="headerlink" title="创作"></a>创作</h2><p>常用命令自己看吧，都不难。</p>
<h1 id="Kali-Win10-虚拟机"><a href="#Kali-Win10-虚拟机" class="headerlink" title="Kali + Win10 虚拟机"></a>Kali + Win10 虚拟机</h1><h1 id="SQL-注入攻击"><a href="#SQL-注入攻击" class="headerlink" title="SQL 注入攻击"></a>SQL 注入攻击</h1><h1 id="PHP-黑魔法"><a href="#PHP-黑魔法" class="headerlink" title="PHP 黑魔法"></a>PHP 黑魔法</h1><h1 id="Python-脚本"><a href="#Python-脚本" class="headerlink" title="Python 脚本"></a>Python 脚本</h1><h1 id="大数据"><a href="#大数据" class="headerlink" title="大数据"></a>大数据</h1><h2 id="理论基础"><a href="#理论基础" class="headerlink" title="理论基础"></a>理论基础</h2><h2 id="技术层面"><a href="#技术层面" class="headerlink" title="技术层面"></a>技术层面</h2><h3 id="云计算"><a href="#云计算" class="headerlink" title="云计算"></a>云计算</h3><h3 id="分布式处理技术"><a href="#分布式处理技术" class="headerlink" title="分布式处理技术"></a>分布式处理技术</h3><h3 id="存储技术"><a href="#存储技术" class="headerlink" title="存储技术"></a>存储技术</h3><h3 id="感知技术"><a href="#感知技术" class="headerlink" title="感知技术"></a>感知技术</h3><h2 id="实践"><a href="#实践" class="headerlink" title="实践"></a>实践</h2><h3 id="互联网大数据"><a href="#互联网大数据" class="headerlink" title="互联网大数据"></a>互联网大数据</h3><h3 id="政府大数据"><a href="#政府大数据" class="headerlink" title="政府大数据"></a>政府大数据</h3><h3 id="企业大数据"><a href="#企业大数据" class="headerlink" title="企业大数据"></a>企业大数据</h3><h3 id="个人大数据"><a href="#个人大数据" class="headerlink" title="个人大数据"></a>个人大数据</h3><h2 id="发展方向"><a href="#发展方向" class="headerlink" title="发展方向"></a>发展方向</h2><h3 id="机器学习-人工智能"><a href="#机器学习-人工智能" class="headerlink" title="机器学习-&gt;人工智能"></a>机器学习-&gt;人工智能</h3><h1 id="未来研究方向，车载系统安全漏洞"><a href="#未来研究方向，车载系统安全漏洞" class="headerlink" title="未来研究方向，车载系统安全漏洞"></a>未来研究方向，车载系统安全漏洞</h1><ul>
<li><p>远程控制网络（39%）</p>
</li>
<li><p>本地网络软件（17%）</p>
</li>
<li><p>车载蜂窝网络（16%）</p>
</li>
<li><p>CAN网络总线（10%）</p>
</li>
<li><p>USB（通用串行总线）设备（13%）</p>
</li>
<li><p>车载网络系统串口复制软件Serial（5%）</p>
</li>
<li><p>……</p>
</li>
</ul>
