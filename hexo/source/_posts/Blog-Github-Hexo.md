---
layout: post
title: "Github & Hexo 搭建个人博客"
date: 2017-10-26 09:23:31.000
updated: 2017-10-26 09:23:31.000
permalink: /articles/Blog-Github-Hexo.html
comments: true
description: "Valar Morghulis"
categories:
  - "编程开发"
tags:
  - "Github"
  - "Hexo"
---

<h1 id="忙……"><a href="#忙……" class="headerlink" title="忙……"></a>忙……</h1><p>最近真的是，各种事情缠在一起，虽然对于搭建博客满心欢喜，但是哦，这只在我的“重要但不紧急”的象限中，所以，以后会慢慢完善整个搭建，以及充实博客的内容。</p>
<!--more-->

<h2 id="Github-Hexo-简介"><a href="#Github-Hexo-简介" class="headerlink" title="Github + Hexo 简介"></a>Github + Hexo 简介</h2><p>刚刚利用 Github + Hexo 搭建好了个人博客，并绑定了域名 <a target="_blank" rel="noopener" href="http://www.chenzihao.me/">chenzihao.me</a>。</p>
<p>最近忙需求，没太多时间更新博客，暂时留个坑，以后会将搭建方式以及 NexT 主题配置完整展现在这里。</p>
<h2 id="What’s-more…"><a href="#What’s-more…" class="headerlink" title="What’s more…"></a>What’s more…</h2><p>当然，还会有一大堆东西，包括一些代码demo，信息安全相关内容包括CTF等，资源，随笔，杂谈，行摄……</p>
<h2 id="TODOList"><a href="#TODOList" class="headerlink" title="TODOList"></a>TODOList</h2><ul>
<li><del>公司两个需求，隐式转换优化，前端改动</del></li>
<li><del>CTF</del></li>
</ul>
<p><del>以上。</del></p>
<p><del>（逃~</del></p>
<p>好嘞，也算是忙完了 CTF，虽然又新接了两个需求，不过工作时间忙一下就算了，回来还是可以做自己想做的事情，学自己想玩的知识。</p>
<p>相信很多 Geek 和文艺青年，都希望拥有自己的博客，把自己的技术知识、文艺创作、生活经历和感想整理在上面，分享给大家。</p>
<p>一直纠结于在哪里写博客，小时候的 QQ 空间、新浪博客，曾经用过的豆瓣、乐乎、人人小站，技术博客中的 CSDN、CNBlogs，就连 Gitbook 也偶尔抽风……累觉不爱。再后来也通过自己搭建 WordPress，也弄过 Jekyll，蛋疼到极致。直到遇见了<a href="www.jianshu.com">简书</a>，可以使用 Markdown 语言，无需考虑乱七八糟的东西，专注于文字。只要你想写文章，插入各种各样的你想要的东西：代码段、图片、链接、引用……并使用各种格式，那么无疑简书是最好的地方。</p>
<p>但后来，不满足于那些博客网站千篇一律的外表，希望自定义页面风格，不想内容被审核所限制，动手能力强，有一定代码基础，想要拥有一个高大上的自定义域名，最终，多看了一眼 Hexo，这个逼格极高的程序猿写作方式，就连名字听起来都很 Geek&amp;Hack，最终选择了 Github + Hexo 搭建个人主页<del>.</del></p>
<p>Hexo 出自于台湾大学生<a href="">tommy351</a>之手，一个基于 Node.js 的静态博客程序，其编译上百篇文字只需要几秒。Hexo 生成的静态网页可以直接放到 Github Pages、BAE、SAE 等平台上。并且为了跳过国内服务器备案才能解析域名、部署网站的蛋疼操作，我选择直接通过 Github 服务器解析域名并将网站通过 Github Pages 部署，然后添加 CNAME 进行域名绑定，唯一要做的就是选择一个高大上的域名咯。最为适合作为个人主页的域名，无疑是.me，然而在国内已经被封禁，那么可以通过“扶墙（你懂的）”的方式在国外域名管理网站申请购买，或者选择其他顶级域名代替，例如 .info，.io 等，就看个人喜好了。</p>
<p>回归正题。</p>
<h1 id="Github-Hexo-搭建个人主页"><a href="#Github-Hexo-搭建个人主页" class="headerlink" title="Github + Hexo 搭建个人主页"></a>Github + Hexo 搭建个人主页</h1><h2 id="环境准备"><a href="#环境准备" class="headerlink" title="环境准备"></a>环境准备</h2><h3 id="安装-Node"><a href="#安装-Node" class="headerlink" title="安装 Node"></a>安装 Node</h3><p>简单地说 Node.js 就是运行在服务器端的 JavaScript。</p>
<p>Node.js 的包管理器 npm，是全球最大的开源库生态系统。</p>
<p>以 Windows 系统为例，打开官网<a target="_blank" rel="noopener" href="https://nodejs.org/en/download/">下载链接</a>，根据自己系统下载相应版本即可。然后一路默认点下去。</p>
<p>验证版本：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">node -v</span><br></pre></td></tr></table></figure>



<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">npm -v</span><br></pre></td></tr></table></figure>

<h3 id="安装-Git"><a href="#安装-Git" class="headerlink" title="安装 Git"></a>安装 Git</h3><p><a target="_blank" rel="noopener" href="https://git-for-windows.github.io/">下载链接</a>，然后一路默认安装点下去。</p>
<p>验证版本：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">git --version</span><br></pre></td></tr></table></figure>

<h3 id="安装-Markdown-编辑器"><a href="#安装-Markdown-编辑器" class="headerlink" title="安装 Markdown 编辑器"></a>安装 Markdown 编辑器</h3><p>Mac 和 Windows 系统的话，<del>推荐 <a target="_blank" rel="noopener" href="http://markdownpad.com/download.html">MarkdownPad</a> 编辑器</del>。</p>
<blockquote>
<p>更新</p>
<p>时代变了大人，目前最好用的是 <strong>Typora</strong>。</p>
</blockquote>
<p>嗯，我觉得喜欢写博客的人都应该学会简单的 <a target="_blank" rel="noopener" href="http://wowubuntu.com/markdown/">Markdown语法</a>。</p>
<p><a target="_blank" rel="noopener" href="http://www.jianshu.com/p/q81RER">献给写作者的 Markdown 新手指南</a></p>
<p><a target="_blank" rel="noopener" href="http://www.jianshu.com/p/qqGjLN">为什么作家应该用 Markdown 保存自己的文稿</a></p>
<p><a target="_blank" rel="noopener" href="http://www.jianshu.com/p/PpDNMG">Markdown 写作浅谈</a></p>
<h2 id="账号准备"><a href="#账号准备" class="headerlink" title="账号准备"></a>账号准备</h2><p>以下整理一些必备的账号，通过账号提供 API，才能实现博客的多样化功能。</p>
<h3 id="Github-账号"><a href="#Github-账号" class="headerlink" title="Github 账号"></a>Github 账号</h3><p>这个不用多 BB，每个 Geek 都应该有，地位相当于 Facebook。</p>
<p><a target="_blank" rel="noopener" href="https://github.com/">https://github.com</a></p>
<p>首先强调一点，名字最好起得好看一点，否则……</p>
<p>注册好之后，需要做一件事情就是，首先创建一个远程仓库，点击 Create a repository，在 Repository name 下的命名，一定要写成：<strong>username.github.io</strong>的形式，其中 username 就是自己的用户名。</p>
<p>之后选择 Initializie this repository with a README，创建即可。<strong>之后不需要任何 git 的操作了。</strong></p>
<p><strong>不要按照 Github 创建项目之后的提示做！！！</strong></p>
<h3 id="友言账号"><a href="#友言账号" class="headerlink" title="友言账号"></a>友言账号</h3><p>第三方评论系统。</p>
<p><a target="_blank" rel="noopener" href="http://www.uyan.cc/">http://www.uyan.cc</a></p>
<p>并不是说它有多好&#x3D; &#x3D;而是，喵的只剩下它了。从前最经典的老牌评论系统 Disqus 被墙，网易云跟帖被封，多说下线，畅言被封，韩国的来必力验证码被墙。没辙。你自己扶了墙，或者肉身翻墙，国内的小伙伴就很蛋疼，也没啥卵用。</p>
<h3 id="百度站长统计账号"><a href="#百度站长统计账号" class="headerlink" title="百度站长统计账号"></a>百度站长统计账号</h3><p>用于统计站点访问量和流量分析，很有用的站长管理系统。</p>
<p><a target="_blank" rel="noopener" href="https://tongji.baidu.com/web/welcome/login">注册地址</a></p>
<h3 id="LeanCloud-账号"><a href="#LeanCloud-账号" class="headerlink" title="LeanCloud 账号"></a>LeanCloud 账号</h3><p>用于统计文章阅览量，也不错哦。</p>
<p><a target="_blank" rel="noopener" href="https://leancloud.cn/">注册地址</a></p>
<h2 id="Hexo-安装配置"><a href="#Hexo-安装配置" class="headerlink" title="Hexo 安装配置"></a>Hexo 安装配置</h2><h3 id="Hexo-安装"><a href="#Hexo-安装" class="headerlink" title="Hexo 安装"></a>Hexo 安装</h3><p>Node 和 Git 都安装好后，可执行如下命令安装 Hexo：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">npm install -g hexo</span><br></pre></td></tr></table></figure>

<h3 id="Hexo-初始化"><a href="#Hexo-初始化" class="headerlink" title="Hexo 初始化"></a>Hexo 初始化</h3><p>创建一个本地文件夹，命名随意，但是如果是 myBlog 会很舒服。</p>
<p>然后进入目录执行 init 命令初始化 hexo 到目录。</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo init</span><br></pre></td></tr></table></figure>

<p>至此，全部安装工作已经完成。</p>
<h3 id="Hexo-部署"><a href="#Hexo-部署" class="headerlink" title="Hexo 部署"></a>Hexo 部署</h3><p>进入 myBlog，执行如下命令，会生成静态页面到 hexo&#x2F;public。</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo generate</span><br></pre></td></tr></table></figure>

<p>或者简写：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo g</span><br></pre></td></tr></table></figure>

<h3 id="Hexo-启动本地服务器"><a href="#Hexo-启动本地服务器" class="headerlink" title="Hexo 启动本地服务器"></a>Hexo 启动本地服务器</h3><p>启动本地服务器，可以在浏览器预览、调试。</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo server</span><br></pre></td></tr></table></figure>

<p>或者简写：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo s</span><br></pre></td></tr></table></figure>

<p>打开浏览器输入 <a target="_blank" rel="noopener" href="http://localhost:4000/">http://localhost:4000</a> 就可以看到部署效果。</p>
<h3 id="写文章"><a href="#写文章" class="headerlink" title="写文章"></a>写文章</h3><figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo new <span class="string">&quot;新建文章名&quot;</span></span><br></pre></td></tr></table></figure>

<p>如果希望修改默认模板，可以去 scaffolds 文件夹下查看，比如 post 的 layout 默认是 hexo&#x2F;scaffolds&#x2F;post.md</p>
<figure class="highlight markdown"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line">title: &#123; &#123; title &#125; &#125;</span><br><span class="line">date: &#123; &#123; date &#125; &#125;</span><br><span class="line"><span class="section">tags:</span></span><br><span class="line"><span class="section">---</span></span><br></pre></td></tr></table></figure>

<p><strong>注意，大括号与大括号之间多加了空格，否则会被转义，不能正常显示。</strong></p>
<p>例如，我想添加分类 categories，以避免每次新建文章时手工输入，则只需要修改这个文件，添加一行即可：</p>
<figure class="highlight markdown"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br></pre></td><td class="code"><pre><span class="line">title: &#123; &#123; title &#125; &#125;</span><br><span class="line">date: &#123; &#123; date &#125; &#125;</span><br><span class="line">categories:</span><br><span class="line"><span class="section">tags:</span></span><br><span class="line"><span class="section">---</span></span><br></pre></td></tr></table></figure>

<h3 id="提交"><a href="#提交" class="headerlink" title="提交"></a>提交</h3><p>每次提交前，有三个固定语句。</p>
<h4 id="清除配置"><a href="#清除配置" class="headerlink" title="清除配置"></a>清除配置</h4><figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo clean</span><br></pre></td></tr></table></figure>

<p>或简写</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo c</span><br></pre></td></tr></table></figure>

<h4 id="部署"><a href="#部署" class="headerlink" title="部署"></a>部署</h4><figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo generate</span><br></pre></td></tr></table></figure>

<p>或简写</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo g</span><br></pre></td></tr></table></figure>

<h4 id="提交-1"><a href="#提交-1" class="headerlink" title="提交"></a>提交</h4><figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo deploy</span><br></pre></td></tr></table></figure>

<p>或简写</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo d</span><br></pre></td></tr></table></figure>

<h3 id="Hexo-站点配置"><a href="#Hexo-站点配置" class="headerlink" title="Hexo 站点配置"></a>Hexo 站点配置</h3><p>打开站点配置文件，位于文件夹根目录，_config.yml。</p>
<p>主题、git 提交配置：</p>
<figure class="highlight yml"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br></pre></td><td class="code"><pre><span class="line"><span class="comment"># Extensions</span></span><br><span class="line"><span class="comment">## Plugins: https://hexo.io/plugins/</span></span><br><span class="line"><span class="comment">## Themes: https://hexo.io/themes/</span></span><br><span class="line"><span class="attr">theme:</span> <span class="string">next</span></span><br><span class="line"></span><br><span class="line"><span class="comment"># Deployment</span></span><br><span class="line"><span class="comment">## Docs: https://hexo.io/docs/deployment.html</span></span><br><span class="line"><span class="attr">deploy:</span></span><br><span class="line">  <span class="attr">type:</span> <span class="string">git</span></span><br><span class="line">  <span class="attr">repository:</span> <span class="string">https://github.com/MrShadowalker/MrShadowalker.github.io.git</span></span><br><span class="line">  <span class="attr">branch:</span> <span class="string">master</span></span><br></pre></td></tr></table></figure>

<p>theme 后的 next 为我选用的主题，下一节会有介绍。</p>
<p>deploy 提交这部分，因为我的 Github 用户名是 MrShadowalker，这里将 MrShadowalker 改成自己的用户名即可。</p>
<h2 id="主题配置"><a href="#主题配置" class="headerlink" title="主题配置"></a>主题配置</h2><p>个人最推荐的主题是 <a target="_blank" rel="noopener" href="http://theme-next.iissnan.com/getting-started.html">NexT</a>。</p>
<p>所有安装配置相关的都有，按照指示一步步做就好。</p>
<p>嗯，有问题在下面留言就好，我会一条条讲解。</p>
