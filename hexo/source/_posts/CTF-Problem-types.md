---
layout: post
title: "CTF 干货系列——题目类型"
date: 2017-10-26 16:34:45.000
updated: 2017-10-26 16:34:45.000
permalink: /articles/CTF-Problem-types.html
comments: true
description: "Valar Morghulis"
categories:
  - "信息安全"
tags:
  - "CTF"
---

<p>哈哈这里继续挖坑。</p>
<p>等不及的小伙伴可以先去我个人很喜欢的一个<a target="_blank" rel="noopener" href="http://www.bugku.com/">论坛</a>上随便找找帖子哈。</p>
<p>链接扔在这里：<a target="_blank" rel="noopener" href="http://www.bugku.com/">CTF社区</a></p>
<p>当然了，这里面也有不少<a target="_blank" rel="noopener" href="http://tool.bugku.com/">在线工具</a>和<a target="_blank" rel="noopener" href="http://123.206.31.85/challenges">习题</a>，方便大家实战练习。</p>
<p>废话说到这里，下面开始正经的。</p>
<!--more-->

<p>当然，以后有时间补齐，哈哈~</p>
<h1 id="题目类型"><a href="#题目类型" class="headerlink" title="题目类型"></a>题目类型</h1><h2 id="Web"><a href="#Web" class="headerlink" title="Web"></a>Web</h2><ul>
<li><p>爆破，包括包括 md5、爆破随机数、验证码识别等</p>
</li>
<li><p>绕WAF，包括花式绕Mysql、绕文件读取关键词检测之类拦截</p>
<ul>
<li><p><a target="_blank" rel="noopener" href="http://103.238.227.13:10087/">注入</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="http://ctf5.shiyanbar.com/web/wonderkun/index.php">盲注</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="http://a.sql.bugku.com/web2/">注入绕过1</a>：<strong>提示</strong>!,!&#x3D;,&#x3D;,+,-,^,%</p>
</li>
<li><p><a target="_blank" rel="noopener" href="http://web.jarvisoj.com:32787/">注入绕过2</a></p>
</li>
</ul>
</li>
<li><p>花式玩弄几个 PHP 特性，包括弱类型，strpos 和 &#x3D;&#x3D;&#x3D;，反序列化+destruct、\0截断、iconv截断</p>
</li>
<li><p>PHP 伪协议，zip:&#x2F;&#x2F;、phar:&#x2F;&#x2F;、php:&#x2F;&#x2F;filter&#x2F;read等</p>
<ul>
<li><a target="_blank" rel="noopener" href="http://web.jarvisoj.com:32768/">练习</a></li>
</ul>
</li>
<li><p>各种找源码技巧，包括 git、svn、xxx.php.swp、<em>www</em>.(zip|tar.gz|rar|7z)、xxx.php.bak</p>
</li>
<li><p>文件上传，包括花式文件后缀，包括 .php345、.inc、.phtml、.phpt、.phps、各种文件内容检测&lt;?php &lt;? &lt;% 、花式解析漏洞</p>
<ul>
<li><p><a target="_blank" rel="noopener" href="http://c.bugku.com/web9/">练习1</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="http://web.jarvisoj.com:32790/">练习2</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="http://web.jarvisoj.com:32785/index.php#">练习3</a></p>
</li>
</ul>
</li>
<li><p>MySQL 类型差异，包括和PHP弱类型类似的特性，0x、0b、1e之类，varchar和integer相互转换</p>
</li>
<li><p>open_basedir、disable_functions花式绕过技巧，包括dl、mail、imagick、bash漏洞、DirectoryIterator及各种二进制选手插足的方法</p>
</li>
<li><p>条件竞争，包括竞争删除前生成shell、竞争数据库无锁多扣钱</p>
</li>
<li><p>windows特性，包括短文件名、IIS解析漏洞、NTFS文件系统通配符、:DATA，冒号截断</p>
</li>
<li><p>SSRF，包括花式探测端口，302跳转、花式协议利用、gophar直接取shell等</p>
</li>
<li><p>XSS，各种浏览器auditor绕过、富文本过滤黑白名单绕过、flash xss、CSP绕过</p>
<ul>
<li><a target="_blank" rel="noopener" href="http://103.238.227.13:10089/">XSS</a></li>
</ul>
</li>
<li><p>XXE，各种XML存在地方（rss&#x2F;word&#x2F;流媒体）、各种XXE利用方法（SSRF、文件读取）</p>
<ul>
<li><a target="_blank" rel="noopener" href="http://web.jarvisoj.com:9882/">XXE</a>：<strong>提示</strong> 请设法获得目标机器&#x2F;home&#x2F;ctf&#x2F;flag.txt中的flag值。</li>
</ul>
</li>
<li><p>协议，花式IP伪造 X-Forwarded-For&#x2F;X-Client-IP&#x2F;X-Real-IP&#x2F;CDN-Src-IP、花式改UA，花式藏FLAG、花式分析数据包</p>
</li>
<li><p>python脚本，盲注脚本、POST提交脚本等，常见python库</p>
<ul>
<li><p>urllib、urllib2、requests   # 发送 HTTP 请求的</p>
</li>
<li><p>urlparse    # 处理 url </p>
</li>
<li><p>re             # 正则表达式</p>
</li>
<li><p>random    # 生成随机数的</p>
</li>
<li><p>hashlib    # 集成md5算法</p>
</li>
<li><p>base64    # base64编码</p>
</li>
<li><p>socket     # 套接字</p>
</li>
<li><p>os&#x2F;sys</p>
</li>
<li><p><a target="_blank" rel="noopener" href="http://c.bugku.com/web6/">练习</a></p>
</li>
</ul>
</li>
</ul>
<h2 id="Misc"><a href="#Misc" class="headerlink" title="Misc"></a>Misc</h2><ul>
<li><p>压缩包加密，伪加密、暴力破解、明文攻击、CRC32 碰撞</p>
</li>
<li><p>图片隐写，LSB、Stegsolve、binwalk、foremost、JPHS、文件头部属性、RGB图片像素点还原</p>
</li>
<li><p>音频隐写，MP3Stego、分析频谱</p>
</li>
<li><p>流量包分析，追踪流、直接导出、binwalk、foremost</p>
<ul>
<li><a target="_blank" rel="noopener" href="http://ctf5.shiyanbar.com/misc/misc300.zip">练习</a></li>
</ul>
</li>
<li><p>社工，包括花式查社工库、微博、QQ签名、whois</p>
</li>
</ul>
<h2 id="Crypto"><a href="#Crypto" class="headerlink" title="Crypto"></a>Crypto</h2><ul>
<li><p>古典密码</p>
</li>
<li><p>现代密码，RSA、hash 长度扩展、异或、移位加密各种变形、32 位随机数过小、唯密文攻击</p>
<ul>
<li><p><a target="_blank" rel="noopener" href="http://ctf5.shiyanbar.com/crypto/RSA">RSA</a></p>
</li>
<li><p><a target="_blank" rel="noopener" href="http://ctf5.shiyanbar.com/crypto/ciphertext.zip">唯密文攻击</a>：<strong>提示</strong>试试看破解这个 1024 位 RSA 系统。flag 的形式是 CTF{USTC-X}，X 是 RSA 的两个素数中较小的那个（取其大写 MD5 的前 6 位）</p>
</li>
</ul>
</li>
</ul>
