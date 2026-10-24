---
layout: post
title: "如何打造宇宙最强 Macbook"
date: 2021-07-14 16:27:28.000
updated: 2021-07-14 16:27:28.000
permalink: /articles/Tool-best-Mac.html
comments: true
description: "描述"
categories:
  - "编程开发"
tags:
  - "Mac"
  - "工具"
  - "教程"
---

<p>作为开发者，如何打造宇宙最强 Mac 呢？</p>
<!--more-->

<h1 id="Homebrew"><a href="#Homebrew" class="headerlink" title="Homebrew"></a>Homebrew</h1><p>homebrew 之于 Mac，相当于 apt-get 之于 Ubuntu，rpm 之于 Centos。Unix 对比 Windows 优势很大的一点就是软件安装管理比较方便，有一套系统的工具，自然 homebrew 也是 Mac 上必装的应用之一。</p>
<p>使用以下语句安装：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">/usr/bin/ruby -e <span class="string">&quot;<span class="subst">$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)</span>&quot;</span></span><br></pre></td></tr></table></figure>

<p>配置路径：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">echo</span> <span class="string">&#x27;export PATH=&quot;/usr/local/bin:$PATH&quot;&#x27;</span> &gt;&gt; ~/.bash_profile</span><br></pre></td></tr></table></figure>

<p>之后可以下载安装 Mac 不自带而本身十分强大的各种工具，如 wget 等：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">brew install wget</span><br></pre></td></tr></table></figure>

<h2 id="Homebrew-Cask"><a href="#Homebrew-Cask" class="headerlink" title="Homebrew Cask"></a>Homebrew Cask</h2><h1 id="Terminal"><a href="#Terminal" class="headerlink" title="Terminal"></a>Terminal</h1><p>先普及一下什么叫 shell：<br>在 Unix 内核的操作系统中，当然现在衍生出好多分支，Linux，Mac OS X 都算。<br>shell 就算和上面这些系统内核指令打交道的一座桥梁，我们通过键盘输入一种自己容易记忆识别的符号标识(shell 命令)，然后 shell 解析这种命令再反馈给内核去执行一系列操作。</p>
<p>其实 zsh 也是一种 shell ，但是并不是我们系统默认的 shell ，Unix 衍生系统的默认 shell 都是 bash。</p>
<p>我们查看一下 Mac 里面内置了哪些shell：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">cat</span> /etc/shells</span><br></pre></td></tr></table></figure>

<p>Mac 自带的 Terminal 是 bash，现将其换成 zsh，采取 iTerm2 + Oh-My-Zsh + Solarized 配色方案，使其拥有语法高亮、命令行补全、自动提示符、显示 Git 仓库状态等功能。</p>
<h2 id="iTerm2-zsh"><a href="#iTerm2-zsh" class="headerlink" title="iTerm2 + zsh"></a>iTerm2 + zsh</h2><ul>
<li>首先安装 iTerm2，官网即可下载：<a target="_blank" rel="noopener" href="http://iterm2.com/">http://iterm2.com/</a>。</li>
<li>将 iTem2 设置为默认终端：<br>iTerm2 -&gt; Make iTerm2 Default Term</li>
<li>然后打开偏好设置 Preference，选中 Keys，勾选 Hotkey 下的 Show&#x2F;hide iTerm2 with a system-wide hotkey，将热键设置为 Command+. ，这样你就可以通过 Command+. 全局热键来打开或关闭 iTerm2 窗口，非常方便。</li>
<li>配色方案,我选用的是 <a target="_blank" rel="noopener" href="http://ethanschoonover.com/solarized">solarized</a>，效果还不错。点开官网，下载，解压，然后打开 iTerm2 下的偏好设置 Preference ，点开 Profiles 下的 colors 选项，点击右下角的 Color Presets 选项，选择 import ，导入解压的 solarized 文件下的 Solarized Dark.itermcolors。</li>
<li>安装 oh-my-zsh。<br>Github 链接：<a target="_blank" rel="noopener" href="https://github.com/robbyrussell/oh-my-zsh">https://github.com/robbyrussell/oh-my-zsh</a></li>
</ul>
<p>使用 curl 安装：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">sh -c <span class="string">&quot;<span class="subst">$(curl -fsSL https://raw.github.com/robbyrussell/oh-my-zsh/master/tools/install.sh)</span>&quot;</span></span><br></pre></td></tr></table></figure>

<p>或者使用 wget 安装：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">sh -c <span class="string">&quot;<span class="subst">$(wget https://raw.githubusercontent.com/robbyrussell/oh-my-zsh/master/tools/install.sh -O -)</span>&quot;</span></span><br></pre></td></tr></table></figure>

<ul>
<li>主题。<br>安装成功后，用 vim 打开隐藏文件 .zshrc ，修改主题为 agnoster：</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">ZSH_THEME=<span class="string">&quot;agnoster&quot;</span></span><br></pre></td></tr></table></figure>

<p>应用这个主题需要特殊的字体支持，否则会出现乱码情况，这时我们来配置字体：</p>
<ol>
<li>使用 <a target="_blank" rel="noopener" href="https://github.com/powerline/fonts/blob/master/Meslo%20Slashed/Meslo%20LG%20M%20Regular%20for%20Powerline.ttf">Meslo</a> 字体，点开连接点击 view raw 下载字体。</li>
<li>安装字体到系统字体册。</li>
<li>应用字体到 iTerm2 下，我自己喜欢将字号设置为 14 px，看着舒服（iTerm -&gt; Preferences -&gt; Profiles -&gt; Text -&gt; Change Font）。</li>
<li>重新打开 iTerm2 窗口，这时便可以看到效果了。</li>
</ol>
<p>到这步我们的终端看上去已经非常好看了，这时我们来安装其它插件，让终端看起来更加风骚。</p>
<ul>
<li>自动提示命令。当我们输入命令时，终端会自动提示你接下来可能要输入的命令，这时按 → 便可输出这些命令，非常方便。</li>
</ul>
<p>设置如下：</p>
<ol>
<li>克隆仓库到本地 ~&#x2F;.oh-my-zsh&#x2F;custom&#x2F;plugins 路径下：</li>
</ol>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">git <span class="built_in">clone</span> git://github.com/zsh-users/zsh-autosuggestions <span class="variable">$ZSH_CUSTOM</span>/plugins/zsh-autosuggestions</span><br></pre></td></tr></table></figure>

<ol start="2">
<li>用 vim 打开 .zshrc 文件，找到插件设置命令，默认是 plugins&#x3D;(git) ，我们把它修改为:</li>
</ol>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">plugins=(zsh-autosuggestions git)</span><br></pre></td></tr></table></figure>

<ol start="3">
<li>重新打开终端窗口。</li>
</ol>
<p>PS：当你重新打开终端的时候可能看不到变化，可能你的字体颜色太淡了，我们把其改亮一些：</p>
<p>移动到 ~&#x2F;.oh-my-zsh&#x2F;custom&#x2F;plugins&#x2F;zsh-autosuggestions 路径下:</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">cd</span> ~/.oh-my-zsh/custom/plugins/zsh-autosuggestions</span><br></pre></td></tr></table></figure>

<ol start="4">
<li>用 vim 打开 zsh-autosuggestions.zsh 文件，修改:</li>
</ol>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE=<span class="string">&#x27;fg=10&#x27;</span> </span><br></pre></td></tr></table></figure>

<ul>
<li>语法高亮。</li>
</ul>
<ol>
<li>使用 homebrew 安装 zsh-syntax-highlighting 插件。</li>
</ol>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">brew install zsh-syntax-highlighting</span><br></pre></td></tr></table></figure>

<ol start="2">
<li>配置 .zshrc 文件，插入一行。</li>
</ol>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">source</span> /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh</span><br></pre></td></tr></table></figure>

<ol start="3">
<li>输入命令。</li>
</ol>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">source</span> ~/.zshrc</span><br></pre></td></tr></table></figure>

<p>开始静静地装逼吧<br>(逃~</p>
<h2 id="vim"><a href="#vim" class="headerlink" title="vim"></a>vim</h2><p>vim 是 Unix 平台上最常用的文本编辑器，因此对 vim 进行相应顺手的配置也非常重要。</p>
<p>Mac 的用户目录下没有默认的 .vimrc 配置文件，我们可以先 touch 一个空的 .vimrc 文件，然后在 vimrc 文件里进行相关的配置。</p>
<p>一般我使用的最简单的几个配置项如下：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br></pre></td><td class="code"><pre><span class="line">color desert <span class="string">&quot;颜色设置&quot;</span></span><br><span class="line">syntax on <span class="string">&quot;语法高亮&quot;</span></span><br><span class="line"><span class="built_in">set</span> number <span class="string">&quot;自动显示行号&quot;</span></span><br><span class="line"><span class="built_in">set</span> cursorline <span class="string">&quot;突出显示当前行&quot;</span></span><br><span class="line"><span class="built_in">set</span> ts=4 <span class="string">&quot;设置tab长度为4&quot;</span></span><br><span class="line"><span class="built_in">set</span> shiftwidth=4 <span class="string">&quot;设定 &lt;&lt; 和 &gt;&gt; 命令移动时的宽度为 4&quot;</span></span><br><span class="line"><span class="built_in">let</span> &amp;termencoding=&amp;encodingset fileencodings=utf-8,gbk <span class="string">&quot;解决中文编码乱码&quot;</span></span><br></pre></td></tr></table></figure>



<h1 id="Environment"><a href="#Environment" class="headerlink" title="Environment"></a>Environment</h1><h2 id="MySQL"><a href="#MySQL" class="headerlink" title="MySQL"></a>MySQL</h2><p>Mac 上的 MySQL 安装配置简直就是大坑。</p>
<p>首先，最重要最重要的就是，一定不要用 homebrew 安装 MySQL，你会感受到无比的绝望~！！</p>
<h3 id="MySQL-配置环境变量"><a href="#MySQL-配置环境变量" class="headerlink" title="MySQL 配置环境变量"></a>MySQL 配置环境变量</h3><ul>
<li>首先要知道你使用的 Mac OS X 是什么样的 shell，使用命令</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">echo</span> <span class="variable">$SHELL</span></span><br></pre></td></tr></table></figure>

<p>如果输出的是：csh 或者是 tcsh，那么你用的就是 C Shell。</p>
<p>如果输出的是：bash，sh，zsh，那么你的用的可能就是 Bourne Shell 的一个变种。</p>
<p>Mac OS X 10.2 之前默认的是 C Shell。</p>
<p>Mac OS X 10.3 之后默认的是 Bourne Shell。</p>
<ul>
<li>打开终端，输入： cd ~</li>
</ul>
<p>会进入~文件夹</p>
<ul>
<li>然后输入：</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">sudo</span> vim .bash_profile</span><br></pre></td></tr></table></figure>

<p>回车执行，需要输入 root 用户密码。sudo 是使用 root 用户修改环境变量文件。</p>
<p>在文档的最下方输入：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">export</span> PATH=<span class="variable">$&#123;PATH&#125;</span>:/usr/local/mysql/bin</span><br></pre></td></tr></table></figure>

<p>然后 esc 退出 insert 状态，并在最下方输入 <code>:wq!</code> 保存退出。</p>
<ul>
<li>输入：</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">source</span> .bash_profile</span><br></pre></td></tr></table></figure>

<p>回车执行，运行环境变量。</p>
<ul>
<li><p>再输入 <code>mysql</code>，即可使用。</p>
</li>
<li><p>本人测试以后发现，上面的做法每次关掉终端在打开都需要重新 source .bash_profile。<br>于是</p>
</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">vi ~/.zshrc</span><br></pre></td></tr></table></figure>

<p>在这里面添加了：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">export</span> PATH=<span class="variable">$&#123;PATH&#125;</span>:/usr/local/mysql/bin</span><br></pre></td></tr></table></figure>

<p>保存后</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">source</span> ~/.zshrc </span><br></pre></td></tr></table></figure>

<p>这样的话就可以一劳永逸了。</p>
<h3 id="重设-MySQL-的-root-初始密码"><a href="#重设-MySQL-的-root-初始密码" class="headerlink" title="重设 MySQL 的 root 初始密码"></a>重设 MySQL 的 root 初始密码</h3><ul>
<li><p>停止 mysql server.  通常是在 <code>系统偏好设置</code> &gt; MySQL &gt; <code>Stop MySQL Server</code></p>
</li>
<li><p>打开终端，输入：</p>
</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">sudo</span> /usr/local/mysql/bin/mysqld_safe --skip-grant-tables</span><br></pre></td></tr></table></figure>

<ul>
<li>打开另一个新终端，输入:</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">sudo</span> /usr/local/mysql/bin/mysql -u root</span><br></pre></td></tr></table></figure>



<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">UPDATE mysql.user SET authentication_string=PASSWORD(<span class="string">&#x27;新密码&#x27;</span>) WHERE User=<span class="string">&#x27;root&#x27;</span>;</span><br></pre></td></tr></table></figure>



<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">FLUSH PRIVILEGES;</span><br></pre></td></tr></table></figure>

<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">\q</span><br></pre></td></tr></table></figure>

<ul>
<li><p>重启 MySQL.</p>
</li>
<li><p>以上方法针对 MySQL V5.7.9，旧版的 MySQL 请使用：</p>
</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">UPDATE mysql.user SET Password=PASSWORD(<span class="string">&#x27;新密码&#x27;</span>) WHERE User=<span class="string">&#x27;root&#x27;</span>;</span><br></pre></td></tr></table></figure>



<h3 id="Errors"><a href="#Errors" class="headerlink" title="Errors"></a>Errors</h3><ul>
<li>不少 Mac 在第一次使用的时候，会出现这样的错误提示：</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">You must reset your password using ALTER USER statement before executing this statement.</span><br></pre></td></tr></table></figure>

<ul>
<li>解决方案如下：</li>
</ul>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">SET PASSWORD = PASSWORD(<span class="string">&#x27;your new password&#x27;</span>);</span><br></pre></td></tr></table></figure>



<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">ALTER USER <span class="string">&#x27;root&#x27;</span>@<span class="string">&#x27;localhost&#x27;</span> PASSWORD EXPIRE NEVER;</span><br></pre></td></tr></table></figure>



<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">flush privileges;</span><br></pre></td></tr></table></figure>

<p>完成以上三步退出再登，使用新设置的密码就行了，以上除了 <code>your new password</code> 自己修改成新密码外，其他原样输入即可。</p>
<h2 id="Git"><a href="#Git" class="headerlink" title="Git"></a>Git</h2><p>Mac 自带 git，我的 Mac 自带 2.13.5 版本，所以就省了 git 的安装。</p>
<h2 id="Java"><a href="#Java" class="headerlink" title="Java"></a>Java</h2><h3 id="JDK-的安装"><a href="#JDK-的安装" class="headerlink" title="JDK 的安装"></a>JDK 的安装</h3><p><a target="_blank" rel="noopener" href="http://www.oracle.com/technetwork/java/javase/downloads/jdk9-downloads-3848520.html">Oracle 官网</a>，找到对应的 JDK 版本，下载安装即可。</p>
<p>安装完成以后，无须配置环境变量，直接可以运行相应的 java 命令。</p>
<h3 id="Maven的安装"><a href="#Maven的安装" class="headerlink" title="Maven的安装"></a>Maven的安装</h3><p>Maven 是现在 Java 项目管理的在开发过程中必不可少的工具。</p>
<p>利用前面我们安装好的 homebrew，很容易就可以安装上 Maven。</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">brew install maven</span><br></pre></td></tr></table></figure>

<p>检查版本:</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">mvn -v</span><br></pre></td></tr></table></figure>



<h2 id="Ruby"><a href="#Ruby" class="headerlink" title="Ruby"></a>Ruby</h2><p>Mac 自带 ruby，我的 Mac 自带 2.0.0p648 (2015-12-16 revision 53162) 版本，所以就省了 ruby 的安装。</p>
<h2 id="PHP"><a href="#PHP" class="headerlink" title="PHP"></a>PHP</h2><p>Mac 自带 php，我的 Mac 自带 5.6.30 版本，所以就省了 php 的安装。</p>
<h3 id="Xdebug"><a href="#Xdebug" class="headerlink" title="Xdebug"></a>Xdebug</h3><h2 id="Python"><a href="#Python" class="headerlink" title="Python"></a>Python</h2><p>Mac 自带 python，我的 Mac 自带 2.7.10 版本，所以就省了 python 的安装。</p>
<p>1.Mac 系统已经默认安装好了python 2.7</p>
<p>2.安装 python 的包管理器 pip </p>
<p>先下载 get-pip.py <a target="_blank" rel="noopener" href="https://bootstrap.pypa.io/get-pip.py">https://bootstrap.pypa.io/get-pip.py</a> 执行命令安装</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">sudo</span> python get-pip.py</span><br></pre></td></tr></table></figure>

<p>3.安装virtualenv 。virtualenv 为每个不同项目提供一份 Python 安装。它并没有真正安装多个 Python 副本，但是它确实提供了一种巧妙的方式来让各项目环境保持独立。</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="built_in">sudo</span> pip install virtualenv</span><br></pre></td></tr></table></figure>

<p>现在你只需要键入以下的命令来激活 virtualenv 中的 Flask:</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">pip install Flask</span><br></pre></td></tr></table></figure>



<h4 id="更新"><a href="#更新" class="headerlink" title="更新"></a>更新</h4><p>目前 Python2.x 版本基本废弃，转向 Python3.x 版本。</p>
<p>推荐使用 Anaconda 来管理环境和相关的包。</p>
<p>这里挖个坑，以后另开 Python 版块详细介绍。</p>
<h2 id="Node-JS"><a href="#Node-JS" class="headerlink" title="Node.JS"></a>Node.JS</h2><figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">brew install nodejs</span><br></pre></td></tr></table></figure>

<p>之后检查版本：</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">npm -v</span><br></pre></td></tr></table></figure>



<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">node -v</span><br></pre></td></tr></table></figure>



<h2 id="Scala"><a href="#Scala" class="headerlink" title="Scala"></a>Scala</h2><p>最近几年算法跟大数据方面最火的分布式框架非 Spark 莫属了。因为 Spark 的缘故，所以咱们得对 Scala 至少得混个脸熟。</p>
<p>因为安装了 homebrew，安装 Scala 就变得很 easy 了。</p>
<figure class="highlight zsh"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">brew install scala</span><br></pre></td></tr></table></figure>



<h1 id="IDE"><a href="#IDE" class="headerlink" title="IDE"></a>IDE</h1><h2 id="Xcode"><a href="#Xcode" class="headerlink" title="Xcode"></a>Xcode</h2><h3 id="Xcode-addones"><a href="#Xcode-addones" class="headerlink" title="Xcode addones"></a>Xcode addones</h3><h2 id="JetBrains"><a href="#JetBrains" class="headerlink" title="JetBrains"></a>JetBrains</h2><p>Activation code</p>
<figure class="highlight dart"><table><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="title class_">CD4C1E7Z6V</span>-eyJsaWNlbnNlSWQiOiJDRDRDMUU3WjZWIiwibGljZW5zZWVOYW1lIjoiRGVtZXRyaXVzIENvbnRyZXJhcyIsImFzc2lnbmVlTmFtZSI6IiIsImFzc2lnbmVlRW1haWwiOiIiLCJsaWNlbnNlUmVzdHJpY3Rpb24iOiJGb3IgZWR1Y2F0aW9uYWwgdXNlIG9ubHkiLCJjaGVja0NvbmN1cnJlbnRVc2UiOmZhbHNlLCJwcm9kdWN0cyI6W3siY29kZSI6IkFDIiwicGFpZFVwVG8iOiIyMDE4LTAzLTEyIn0seyJjb2RlIjoiRE0iLCJwYWlkVXBUbyI6IjIwMTgtMDMtMTIifSx7ImNvZGUiOiJJSSIsInBhaWRVcFRvIjoiMjAxOC0wMy0xMiJ9LHsiY29kZSI6IlJTMCIsInBhaWRVcFRvIjoiMjAxOC0wMy0xMiJ9LHsiY29kZSI6IldTIiwicGFpZFVwVG8iOiIyMDE4LTAzLTEyIn0seyJjb2RlIjoiRFBOIiwicGFpZFVwVG8iOiIyMDE4LTAzLTEyIn0seyJjb2RlIjoiUkMiLCJwYWlkVXBUbyI6IjIwMTgtMDMtMTIifSx7ImNvZGUiOiJQUyIsInBhaWRVcFRvIjoiMjAxOC0wMy0xMiJ9LHsiY29kZSI6IkRDIiwicGFpZFVwVG8iOiIyMDE4LTAzLTEyIn0seyJjb2RlIjoiREIiLCJwYWlkVXBUbyI6IjIwMTgtMDMtMTIifSx7ImNvZGUiOiJSTSIsInBhaWRVcFRvIjoiMjAxOC0wMy0xMiJ9LHsiY29kZSI6IlBDIiwicGFpZFVwVG8iOiIyMDE4LTAzLTEyIn0seyJjb2RlIjoiQ0wiLCJwYWlkVXBUbyI6IjIwMTgtMDMtMTIifV0sImhhc2giOiI1NDc2MjU1LzAiLCJncmFjZVBlcmlvZERheXMiOjAsImF1dG9Qcm9sb25nYXRlZCI6ZmFsc2UsImlzQXV0b1Byb2xvbmdhdGVkIjpmYWxzZX0=-gnfWktLzZjpomv7IR5yOFM70UCC9fk6yskvEBVtKRSZLoC+<span class="title class_">Pys880dERQOTe443osbEJVLhpediv</span>/tC9mIwJLGLJlvPr1Ps3ruV5ugk/l1PPYJeLnfVfYWNeOlCkt+<span class="title class_">GJSlwRqvo24rGwWnGXosiZ35juVzQHXcIMU6ekkyiMrHXWb9xMlwlJ1Bm0KwIddOnxCGi5q17qFc4ArDNqACUS9FkeKEHjV5</span>+xAs7uJBW/<span class="title class_">QMGDwHq</span>/eu7mm7x5QUUA3VbQUqHn/rcECDuNoMpQ8tzrpS1vFGQkthfVPcHREVudCJ/9bJaE9lIoa55rgxWUPiOQDicygCsRlAiZoeu/<span class="title class_">WNSvaA</span>==-<span class="title class_">MIIEPjCCAiagAwIBAgIBBTANBgkqhkiG9w0BAQsFADAYMRYwFAYDVQQDDA1KZXRQcm9maWxlIENBMB4XDTE1MTEwMjA4MjE0OFoXDTE4MTEwMTA4MjE0OFowETEPMA0GA1UEAwwGcHJvZDN5MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxcQkq</span>+zdxlR2mmRYBPzGbUNdMN6OaXiXzxIWtMEkrJMO/5oUfQJbLLuMSMK0QHFmaI37WShyxZcfRCidwXjot4zmNBKnlyHodDij/78TmVqFl8nOeD5+07B8VEaIu7c3E1N+e1doC6wht4I4+<span class="title class_">IEmtsPAdoaj5WCQVQbrI8KeT8M9VcBIWX7fD0fhexfg3ZRt0xqwMcXGNp3DdJHiO0rCdU</span>+<span class="title class_">Itv7EmtnSVq9jBG1usMSFvMowR25mju2JcPFp1</span>+<span class="title class_">I4ZI</span>+<span class="title class_">FqgR8gyG8oiNDyNEoAbsR3lOpI7grUYSvkB</span>/xVy/<span class="title class_">VoklPCK2h0f0GJxFjnye8NT1PAywoyl7RmiAVRE</span>/<span class="title class_">EKwIDAQABo4GZMIGWMAkGA1UdEwQCMAAwHQYDVR0OBBYEFGEpG9oZGcfLMGNBkY7SgHiMGgTcMEgGA1UdIwRBMD</span>+<span class="title class_">AFKOetkhnQhI2Qb1t4Lm0oFKLl</span>/<span class="title class_">GzoRykGjAYMRYwFAYDVQQDDA1KZXRQcm9maWxlIENBggkA0myxg7KDeeEwEwYDVR0lBAwwCgYIKwYBBQUHAwEwCwYDVR0PBAQDAgWgMA0GCSqGSIb3DQEBCwUAA4ICAQC9WZuYgQedSuOc5TOUSrRigMw4</span>/+wuC5EtZBfvdl4HT/8vzMW/oUlIP4YCvA0XKyBaCJ2iX+<span class="title class_">ZCDKoPfiYXiaSiH</span>+<span class="title class_">HxAPV6J79vvouxKrWg2XV6ShFtPLP</span>+0gPdGq3x9R3+kJbmAm8w+<span class="title class_">FOdlWqAfJrLvpzMGNeDU14YGXiZ9bVzmIQbwrBA</span>+c/<span class="title class_">F4tlK</span>/<span class="title class_">DV07dsNExihqFoibnqDiVNTGombaU2dDup2gwKdL81ua8EIcGNExHe82kjF4zwfadHk3bQVvbfdAwxcDy4xBjs3L4raPLU3yenSzr</span>/<span class="title class_">OEur1</span>+jfOxnQSmEcMXKXgrAQ9U55gwjcOFKrgOxEdek/<span class="title class_">Sk1VfOjvS</span>+nuM4eyEruFMfaZHzoQiuw4IqgGc45ohFH0UUyjYcuFxxDSU9lMCv8qdHKm+wnPRb0l9l5vXsCBDuhAGYD6ss+<span class="title class_">Ga</span>+aDY6f/qXZuUCEUOH3QUNbbCUlviSz6+<span class="title class_">GiRnt1kA9N2Qachl</span>+2yBfaqUqr8h7Z2gsx5LcIf5kYNsqJ0GavXTVyWh7PYiKX4bs354ZQLUwwa/cG++<span class="number">2</span>+wNWP+<span class="title class_">HtBhVxMRNTdVhSm38AknZlD</span>+<span class="title class_">PTAsWGu9GyLmhti2EnVwGybSD2Dxmhxk3IPCkhKAK</span>+pl0eWYGZWG3tJ9mZ7SowcXLWDFAk0lRJnKGFMTggrWjV8GYpw5bq23VmIqqDLgkNzuoog==</span><br></pre></td></tr></table></figure>

<h4 id="更新-1"><a href="#更新-1" class="headerlink" title="更新"></a>更新</h4><p>现在很多激活码都失效了。</p>
<p>教大家一个永久试用的方法：</p>
<ul>
<li><p>任何一个 JB 家的 IDE 中打开 Preference -&gt; Plugins -&gt; Setting（Installed 右边的小齿轮） -&gt; Manage Plugin Repositories</p>
</li>
<li><p>新增 <code>https://plugins.zhile.io</code></p>
</li>
<li><p>返回 Marketplace，搜索 <code>IDE Eval Reset</code>，安装并重启 IDE</p>
</li>
<li><p>打开后，菜单栏 Help 中，最下面就是 Eval Reset，可以设置每次重启自动刷新试用时间，即可无限期试用</p>
</li>
</ul>
<h1 id="Editor"><a href="#Editor" class="headerlink" title="Editor"></a>Editor</h1><h2 id="Sublime"><a href="#Sublime" class="headerlink" title="Sublime"></a>Sublime</h2><p>对于 RD 同学来说，习惯、顺手的文本编辑器也是非常重要的一个工具。</p>
<p>我一直用 Sublime，用的时间也比较长了，感觉还不错。</p>
<p>Sublime 的官网地址：<a target="_blank" rel="noopener" href="https://www.sublimetext.com/">https://www.sublimetext.com/</a>。</p>
<p>去官网下载，安装即可。</p>
<h2 id="Visual-Studio-Code"><a href="#Visual-Studio-Code" class="headerlink" title="Visual Studio Code"></a>Visual Studio Code</h2><h1 id="VIrtual-Machine"><a href="#VIrtual-Machine" class="headerlink" title="VIrtual Machine"></a>VIrtual Machine</h1><h2 id="VMware-Fusion"><a href="#VMware-Fusion" class="headerlink" title="VMware Fusion"></a>VMware Fusion</h2><h2 id="Mac-Kali-Lnux-Win10"><a href="#Mac-Kali-Lnux-Win10" class="headerlink" title="Mac + Kali Lnux + Win10"></a>Mac + Kali Lnux + Win10</h2><h1 id="Browser"><a href="#Browser" class="headerlink" title="Browser"></a>Browser</h1><h2 id="FireFox"><a href="#FireFox" class="headerlink" title="FireFox"></a>FireFox</h2><h3 id="FireFox-addones"><a href="#FireFox-addones" class="headerlink" title="FireFox addones"></a>FireFox addones</h3><h2 id="Chrome"><a href="#Chrome" class="headerlink" title="Chrome"></a>Chrome</h2><h3 id="Chrome-addones"><a href="#Chrome-addones" class="headerlink" title="Chrome addones"></a>Chrome addones</h3><h2 id="Safari"><a href="#Safari" class="headerlink" title="Safari"></a>Safari</h2><h1 id="VPN"><a href="#VPN" class="headerlink" title="VPN"></a>VPN</h1><p>Shadowsocks</p>
<p><a target="_blank" rel="noopener" href="https://github.com/shadowsocks/shadowsocks-gui">https://github.com/shadowsocks/shadowsocks-gui</a></p>
