---
layout: post
title: "CTF干货系列——题目类型——Web"
date: 2017-10-26 17:34:07.000
updated: 2017-10-26 17:34:07.000
permalink: /articles/CTF-Web.html
comments: true
description: "Valar Morghulis"
categories:
  - "信息安全"
tags:
  - "CTF"
---

<h1 id="技能"><a href="#技能" class="headerlink" title="技能"></a>技能</h1><p>CTF 中主攻 Web 题的大（Web）佬（狗）们，通常需要点亮以下技能：</p>
<!--more-->

<h2 id="编程语言"><a href="#编程语言" class="headerlink" title="编程语言"></a>编程语言</h2><p>编程语言黑魔法才是关键。</p>
<h3 id="JavaScript"><a href="#JavaScript" class="headerlink" title="JavaScript"></a>JavaScript</h3><h3 id="PHP"><a href="#PHP" class="headerlink" title="PHP"></a>PHP</h3><h3 id="Python"><a href="#Python" class="headerlink" title="Python"></a>Python</h3><h3 id="Java"><a href="#Java" class="headerlink" title="Java"></a>Java</h3><h3 id="……"><a href="#……" class="headerlink" title="……"></a>……</h3><h2 id="数据库"><a href="#数据库" class="headerlink" title="数据库"></a>数据库</h2><p>各种数据库的特性与差别，也包括黑魔法。</p>
<h3 id="MySQL"><a href="#MySQL" class="headerlink" title="MySQL"></a>MySQL</h3><h3 id="msSQL"><a href="#msSQL" class="headerlink" title="msSQL"></a>msSQL</h3><h3 id="Access"><a href="#Access" class="headerlink" title="Access"></a>Access</h3><h3 id="Oracle"><a href="#Oracle" class="headerlink" title="Oracle"></a>Oracle</h3><h3 id="……-1"><a href="#……-1" class="headerlink" title="……"></a>……</h3><h2 id="CVE-漏洞"><a href="#CVE-漏洞" class="headerlink" title="CVE 漏洞"></a>CVE 漏洞</h2><p>利用与分析。</p>
<p>这个需要多去看看近期漏洞。</p>
<h2 id="……-2"><a href="#……-2" class="headerlink" title="……"></a>……</h2><hr>
<h1 id="基础知识"><a href="#基础知识" class="headerlink" title="基础知识"></a>基础知识</h1><h2 id="网站运行原理"><a href="#网站运行原理" class="headerlink" title="网站运行原理"></a>网站运行原理</h2><h3 id="HTTP-协议"><a href="#HTTP-协议" class="headerlink" title="HTTP 协议"></a>HTTP 协议</h3><ul>
<li>概述</li>
</ul>
<p>在传输层基于 TCP&#x2F;IP 协议进行传输，本身属于 OSI 七层模型中的应用层。</p>
<p>HTTP 协议工作于 Client-Server 架构之上。例如，最常见的 client 是 Browser，浏览器作为 HTTP client 通过 URL 想 HTTP server 即 Web 服务器发送 HTTP 请求包，Web 服务器根据 HTTP 协议解析请求后，向 client 发送相应信息。</p>
<ul>
<li>特点</li>
</ul>
<p><strong>简单，快速。</strong>几个字段就可以完整地描述所要请求的资源和数据内容。</p>
<p><strong>灵活性。</strong>客户端以及服务器只需要使用Content-type字段来指定当前数据内容的MIME类型。</p>
<p><strong>无连接。</strong>限制每次连接只处理一个请求。服务器处理完客户端请求并收到客户端应答后，即断开连接。</p>
<p><strong>无状态。</strong>对于事物处理没有记忆能力。如果后续处理需要前面的信息，则必须重传，可能导致每次连接传送的数据量增大。另一方面，在服务器不需要先前信息时应答较快。</p>
<ul>
<li>消息结构</li>
</ul>
<p><strong>前置术语</strong></p>
<p>URI：统一资源标识符</p>
<p>回车符：%0d</p>
<p>换行符：%0a</p>
<p><strong>请求数据包结构</strong></p>
<p>client 发送一个 HTTP 请求到 server 的请求报文包括以下格式：</p>
<p>请求行（request line）、请求头部（header）、空行、请求数据。</p>
<p><strong>响应数据包结构</strong></p>
<p>HTTP 相应也由四个部分组成：</p>
<p>状态行、消息报头、空行、响应正文。</p>
<ul>
<li>请求方法</li>
</ul>
<p><strong>HTTP1.0</strong></p>
<p>GET，请求指定的页面信息，并返回实体主体。</p>
<p>POST，向指定资源提交数据进行处理请求（例如提交表单或者上传文件），数据被包含在请求体中，POST请求可能会导致新的资源的建立、已有资源的修改。</p>
<p>HEAD，类似于GET请求，只不过返回的响应中没有具体内容，用于获取报头。</p>
<p><strong>HTTP1.1 新增</strong></p>
<p>OPTIONS，</p>
<p>PUT，</p>
<p>DELETE，</p>
<p>TRACE，</p>
<p>CONNECT，</p>
<h3 id="Web-语言与容器"><a href="#Web-语言与容器" class="headerlink" title="Web 语言与容器"></a>Web 语言与容器</h3><h3 id="实验：抓包与重放"><a href="#实验：抓包与重放" class="headerlink" title="实验：抓包与重放"></a>实验：抓包与重放</h3><hr>
<h1 id="题型"><a href="#题型" class="headerlink" title="题型"></a>题型</h1><p>以下常见套路，应该都熟悉才好。</p>
<h2 id="爆破"><a href="#爆破" class="headerlink" title="爆破"></a>爆破</h2><h3 id="md5"><a href="#md5" class="headerlink" title="md5"></a>md5</h3><h3 id="爆破随机数"><a href="#爆破随机数" class="headerlink" title="爆破随机数"></a>爆破随机数</h3><h3 id="验证码识别"><a href="#验证码识别" class="headerlink" title="验证码识别"></a>验证码识别</h3><h3 id="……-3"><a href="#……-3" class="headerlink" title="……"></a>……</h3><h2 id="绕-WAF"><a href="#绕-WAF" class="headerlink" title="绕 WAF"></a>绕 WAF</h2><p>绕过拦截。</p>
<h3 id="花式绕-MySQL"><a href="#花式绕-MySQL" class="headerlink" title="花式绕 MySQL"></a>花式绕 MySQL</h3><h3 id="绕文件读取关键词检测"><a href="#绕文件读取关键词检测" class="headerlink" title="绕文件读取关键词检测"></a>绕文件读取关键词检测</h3><h3 id="……-4"><a href="#……-4" class="headerlink" title="……"></a>……</h3><h2 id="PHP-特性"><a href="#PHP-特性" class="headerlink" title="PHP 特性"></a>PHP 特性</h2><p>花式玩弄 PHP。</p>
<h3 id="弱类型"><a href="#弱类型" class="headerlink" title="弱类型"></a>弱类型</h3><h3 id="strpos-和"><a href="#strpos-和" class="headerlink" title="strpos 和&#x3D;&#x3D;&#x3D;"></a>strpos 和&#x3D;&#x3D;&#x3D;</h3><h3 id="反序列化-destruct"><a href="#反序列化-destruct" class="headerlink" title="反序列化 destruct"></a>反序列化 destruct</h3><h3 id="0-截断"><a href="#0-截断" class="headerlink" title="\0 截断"></a>\0 截断</h3><h3 id="iconv-截断"><a href="#iconv-截断" class="headerlink" title="iconv 截断"></a>iconv 截断</h3><h3 id="……-5"><a href="#……-5" class="headerlink" title="……"></a>……</h3><h2 id="密码题"><a href="#密码题" class="headerlink" title="密码题"></a>密码题</h2><h3 id="hash-长度扩展"><a href="#hash-长度扩展" class="headerlink" title="hash 长度扩展"></a>hash 长度扩展</h3><h3 id="异或"><a href="#异或" class="headerlink" title="异或"></a>异或</h3><h3 id="移位加密各种变形"><a href="#移位加密各种变形" class="headerlink" title="移位加密各种变形"></a>移位加密各种变形</h3><h3 id="32-位随机数过小"><a href="#32-位随机数过小" class="headerlink" title="32 位随机数过小"></a>32 位随机数过小</h3><h2 id="找源码"><a href="#找源码" class="headerlink" title="找源码"></a>找源码</h2><h3 id="Git"><a href="#Git" class="headerlink" title="Git"></a>Git</h3><h3 id="SVN"><a href="#SVN" class="headerlink" title="SVN"></a>SVN</h3><h3 id="xxx-php-swp"><a href="#xxx-php-swp" class="headerlink" title="xxx.php.swp"></a>xxx.php.swp</h3><h3 id="www-zip-tar-gz-rar-7z"><a href="#www-zip-tar-gz-rar-7z" class="headerlink" title="www.(zip|tar.gz|rar|7z)"></a>www.(zip|tar.gz|rar|7z)</h3><h3 id="xxx-php-bak"><a href="#xxx-php-bak" class="headerlink" title="xxx.php.bak"></a>xxx.php.bak</h3><h2 id="文件上传"><a href="#文件上传" class="headerlink" title="文件上传"></a>文件上传</h2><h3 id="文件后缀"><a href="#文件后缀" class="headerlink" title="文件后缀"></a>文件后缀</h3><h3 id="php345"><a href="#php345" class="headerlink" title=".php345"></a>.php345</h3><h3 id="inc"><a href="#inc" class="headerlink" title=".inc"></a>.inc</h3><h3 id="phtml"><a href="#phtml" class="headerlink" title=".phtml"></a>.phtml</h3><h3 id="phpt"><a href="#phpt" class="headerlink" title=".phpt"></a>.phpt</h3><h3 id="phps"><a href="#phps" class="headerlink" title=".phps"></a>.phps</h3><h3 id="文件内容检测"><a href="#文件内容检测" class="headerlink" title="文件内容检测"></a>文件内容检测</h3><?php <? <% <scriptlanguage=php>

### 花式解析漏洞

## MySQL

### SQL注入攻击



### 和PHP弱类型类似的特性

### 0x，0b，1e之类

### 隐式转换

## open_basedir&disable_functions花式绕过技巧

### dl

### mail

### imagick

### bash漏洞

### DirectoryIterator

### 各种二进制选手插足的方法

## 条件竞争

### 竞争删除前生成shell

### 竞争数据库无锁多扣钱

## 社工

### 花式查社工库，微博、QQ

### whois

## Windows特性

### 短文件名

### IIS解析漏洞

### NTFS文件系统通配符

### ::$DATA

### 冒号截断

## SSRF

### 花式探测端口

### 302跳转

### 花式协议利用

### gophar直接取shell

## XSS

### 各种浏览器auditor绕过

### 富文本过滤黑白名单绕过

### flash XSS

### CSP绕过

## XXE

### 各种XML存在地方

rss/word/流媒体

### 各种XXE利用方法

SSRF，文件读取

## 协议

### 花式IP伪造

X-Forwarded-For，X-Client-IP，X-Real-IP，CDN-Src-IP

### 花式改UA

### 花式藏Flag

### 花式分析数据包


---

# 练习地址

- [We Chall](http://www.wechall.net/)

- [RedTiger's Hackit](http://redtiger.labs.overthewire.org)

- [prompt](http://prompt.ml/0)

- [CTF社区](http://123.206.31.85)

- ……
