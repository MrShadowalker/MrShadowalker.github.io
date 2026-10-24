---
layout: post
title: "Java 优化"
date: 2017-12-11 15:59:31.000
updated: 2017-12-11 15:59:31.000
permalink: /articles/Java-optimization.html
comments: true
description: "Valar Morghulis"
categories:
  - "编程开发"
tags:
  - "Java"
---

<h1 id="代码优化的目标"><a href="#代码优化的目标" class="headerlink" title="代码优化的目标"></a>代码优化的目标</h1><ul>
<li>减小代码体积</li>
<li>提高代码运行效率</li>
</ul>
<!--more-->

<h1 id="代码优化细节"><a href="#代码优化细节" class="headerlink" title="代码优化细节"></a>代码优化细节</h1><h2 id="尽量指定类、方法的final修饰符"><a href="#尽量指定类、方法的final修饰符" class="headerlink" title="尽量指定类、方法的final修饰符"></a>尽量指定类、方法的final修饰符</h2><p>带有 final 修饰符的类是不可派生的。在 Java 核心 API 中，有许多应用 final 的例子，如 java.lang.String ，整个类都是 final 的。为类指定 final 修饰符可以让类不可以被继承，为方法指定 final 修饰符可以让方法不可以被重写。如果指定了一个类为 final ，则该类所有的方法都是 final 的。Java 编译器会寻找机会内联所有的 final 方法，内联对于提升 Java 运行效率作用重大，具体参见 Java 运行期优化。此举能够使性能平均提升50%。</p>
<h2 id="尽量重用对象"><a href="#尽量重用对象" class="headerlink" title="尽量重用对象"></a>尽量重用对象</h2><p>特别是 String 对象的使用，出现字符串连接时应该使用 StringBuilder、StringBuffer 代替。由于 Java 虚拟机不仅要花时间生成对象，以后可能还需要花时间对这些对象进行垃圾回收和处理，因此，生成过多的对象将会给程序的性能带来很大的影响。</p>
<h2 id="尽可能使用局部变量"><a href="#尽可能使用局部变量" class="headerlink" title="尽可能使用局部变量"></a>尽可能使用局部变量</h2><p>调用方法时传递的参数以及在调用中差UN关键的临时变量都保存在占中，速度较快；其他变量，如静态变量、实例变量等，都在堆中创建，速度较慢。另外，栈中创建的变量，随着方法的运行结束，这些内容就没了，不需要额外的垃圾回收。</p>
<h2 id="及时关闭流"><a href="#及时关闭流" class="headerlink" title="及时关闭流"></a>及时关闭流</h2><p>Java 编程过程中，进行数据库连接、I&#x2F;O 流操作时务必小心，在使用完毕后，及时关闭以释放资源。因为对这些大对象的操作会造成系统很大的开销，稍有不慎，将会导致严重后果。</p>
<h2 id="进来能够减少对变量的重复计算"><a href="#进来能够减少对变量的重复计算" class="headerlink" title="进来能够减少对变量的重复计算"></a>进来能够减少对变量的重复计算</h2><p>明确一个概念，对方法的调用，即使方法中只有一个语句，也是有消耗的，包括创建栈帧、调用方法是保护现场、调用方法完毕时恢复现场等。所以例如下面的操作：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line"><span class="keyword">for</span> (<span class="type">int</span> <span class="variable">i</span> <span class="operator">=</span> <span class="number">0</span>; i &lt; list.size(); i++)</span><br><span class="line">&#123;...&#125;</span><br></pre></td></tr></table></figure>

<p>建议替换为：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line"><span class="keyword">for</span> (<span class="type">int</span> <span class="variable">i</span> <span class="operator">=</span> <span class="number">0</span>, <span class="type">int</span> <span class="variable">length</span> <span class="operator">=</span> list.size(); i &lt; length; i++)</span><br><span class="line">&#123;...&#125;</span><br></pre></td></tr></table></figure>

<p>这样，在list.size()很大的时候，就减少了许多消耗。</p>
<h2 id="尽量采用懒加载的策略，即在需要时才创建"><a href="#尽量采用懒加载的策略，即在需要时才创建" class="headerlink" title="尽量采用懒加载的策略，即在需要时才创建"></a>尽量采用懒加载的策略，即在需要时才创建</h2><p>例如：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line"><span class="type">String</span> <span class="variable">str</span> <span class="operator">=</span> <span class="string">&quot;abcde&quot;</span>;</span><br><span class="line"><span class="keyword">if</span> (i == <span class="number">1</span>)&#123;</span><br><span class="line">    list.add(str);</span><br><span class="line">&#125;</span><br></pre></td></tr></table></figure>

<p>可替换为：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line"><span class="keyword">if</span> (i == <span class="number">1</span>)&#123;</span><br><span class="line">    <span class="type">String</span> <span class="variable">str</span> <span class="operator">=</span> <span class="string">&quot;abcde&quot;</span>;</span><br><span class="line">    list.add(str);</span><br><span class="line">&#125;</span><br></pre></td></tr></table></figure>

<h2 id="慎用异常"><a href="#慎用异常" class="headerlink" title="慎用异常"></a>慎用异常</h2><p>异常对性能不利。抛出异常首先要创建一个新的对象，Throwable 接口的构造函数调用名为 fillInStackTrace() 的本地同步方法， fillInStackTrace() 方法检查堆栈，收集调用跟踪信息。只要有异常被抛出，Java 虚拟机就必须调整调用堆栈，因为在处理过程中创建了一个新的对象。异常只能用于错误处理，不应该用来控制程序流程。</p>
<p>不要在循环中使用 try-catch，应该将其放在最外层，除非不得已。</p>
<h2 id="关于内容长度"><a href="#关于内容长度" class="headerlink" title="关于内容长度"></a>关于内容长度</h2><p>如果能估计到待添加的内容长度，为底层以数组方式实现的集合、工具类指定初始长度，比如：ArrayList、StringBuilder、StringBuffer、HashMap、HashSet等。</p>
<p>以StringBuilder为例：</p>
<ul>
<li>StringBuilder()    &#x2F;&#x2F; 默认分配 16 个字符的空间</li>
<li>StringBuilder(int size)    &#x2F;&#x2F; 默认分配 size 个字符的空间</li>
<li>StringBuilder(String str)    &#x2F;&#x2F; 默认分配 16+str.length() 个字符的空间</li>
</ul>
<p>可以通过类（这里指的不仅仅是上面的 StringBuilder）来设定他的初始化变容量，这样可以明显地提升性能。以 StringBuilder 为例，length 表示当前的 StringBuilder 能保持的字符数量。因为当 StringBuilder 达到最大容量时，会将自身容量增加到当前的 2 倍再加 2，无论何时只要 StringBuilder 达到他的最大容量，就不得不创建一个新的字符数组然后将旧的字符数组内容拷贝到新字符数组中——然鹅这是十分耗费性能的操作。那么，如果能预估到字符数组中要存放 5000 个字符而不指定长度，最接近 5000 的 2 次幂是 4096，忽略每次扩容加的 2，那么：</p>
<ul>
<li>在 4096 基础上，在申请 8194 个大小的字符数组，加起来相当于一次申请了 12290 个大小的字符数组，如果一开始就能指定 5000 个大小的字符数组，就能节省一倍以上的空间。</li>
<li>把原来的 4096 个字符拷贝到新的字符数组中去，又浪费了性能。</li>
</ul>
<p>会发现，如果不指定字符长度，既浪费内存空间又降低代码运行效率。所以，给底层以数组实现的集合、工具类设置一个合理的初始化容量是代码优化很重要的一部分。但是注意像 HashMap 这种是以数组+链表实现的集合，别把初始大小和估计的大小设置的一样，因为一个 table 上只连接一个对象的可能性几乎为 0。初始大小建议设置为 2 的 N 次幂，如果能估计到有 2000 个元素，设置成 new HashMap(128)、new HashMap(256) 都是可以的。</p>
<h2 id="复制"><a href="#复制" class="headerlink" title="复制"></a>复制</h2><p>复制大量数据时，使用 System.arraycopy() 命令。</p>
<h2 id="乘法和除法使用移位操作"><a href="#乘法和除法使用移位操作" class="headerlink" title="乘法和除法使用移位操作"></a>乘法和除法使用移位操作</h2><p>如下：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line"><span class="keyword">for</span> (val = <span class="number">0</span>; val &lt; <span class="number">100000</span>; val += <span class="number">5</span>) &#123;</span><br><span class="line">    a = val * <span class="number">8</span>;</span><br><span class="line">    b = val / <span class="number">2</span>;</span><br><span class="line">&#125;</span><br></pre></td></tr></table></figure>

<p>用移位操作可以极大地提升性能，因为在计算机底层，对位的操作是最方便、最快的。因此修改为：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line"><span class="keyword">for</span> (val = <span class="number">0</span>; val &lt; <span class="number">100000</span>; val +=<span class="number">5</span>) &#123;</span><br><span class="line">    a = val &lt;&lt; <span class="number">3</span>;</span><br><span class="line">    b = val &gt;&gt; <span class="number">3</span>;</span><br><span class="line">&#125;</span><br></pre></td></tr></table></figure>

<p>移位操作虽然快，但是可能会使得代码不好理解，因此如果使用最好加上相应的注释。</p>
<h2 id="循环内不要不断创建对象引用"><a href="#循环内不要不断创建对象引用" class="headerlink" title="循环内不要不断创建对象引用"></a>循环内不要不断创建对象引用</h2><p>例如：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br></pre></td><td class="code"><pre><span class="line"><span class="keyword">for</span> (<span class="type">int</span> <span class="variable">i</span> <span class="operator">=</span> <span class="number">0</span>; i &lt;= count; i++) &#123;</span><br><span class="line">    <span class="type">Object</span> <span class="variable">obj</span> <span class="operator">=</span> <span class="keyword">new</span> <span class="title class_">Object</span>();</span><br><span class="line">&#125;</span><br></pre></td></tr></table></figure>

<p>这种做法会导致内存中有 count 个 Object 对象引用存在，count 很大的话，就消耗内存了，建议修改为：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line"><span class="type">Object</span> <span class="variable">obj</span> <span class="operator">=</span> <span class="literal">null</span>;</span><br><span class="line"><span class="keyword">for</span> (<span class="type">int</span> <span class="variable">i</span> <span class="operator">=</span> <span class="number">0</span>; i &lt;= count; i++) &#123;</span><br><span class="line">    obj = <span class="keyword">new</span> <span class="title class_">Object</span>();</span><br><span class="line">&#125;</span><br></pre></td></tr></table></figure>

<p>这样的话，内存中只有一个 Object 对象引用，每次 new Object() 的时候，Object 对象引用指向不同的 Object 而已，但内存中只有一个，这样就大大节省内存空间了。</p>
<h2 id="关于-array-和-ArrayList"><a href="#关于-array-和-ArrayList" class="headerlink" title="关于 array 和 ArrayList"></a>关于 array 和 ArrayList</h2><p>基于效率和类型检查的考虑，应尽可能使用 array，无法确定数组大小时才使用 ArrayList。</p>
<h2 id="集合类型选择"><a href="#集合类型选择" class="headerlink" title="集合类型选择"></a>集合类型选择</h2><p>尽量使用 HashMap、ArrayList、StringBuilder，除非线程安全需要，否则不推荐使用 Hashtable、Vector、StringBuffer，后三者由于使用同步机制而导致了性能开销。</p>
<h2 id="不要将数组声明为-public，static，final"><a href="#不要将数组声明为-public，static，final" class="headerlink" title="不要将数组声明为 public，static，final"></a>不要将数组声明为 public，static，final</h2><p>因为毫无意义。这样只是定义了引用为 static、final，数组的内容还是可以随意改变的，将数组声明为 public 更是一个安全漏洞，这意味着这个数组可以被外部类所改变。</p>
<h2 id="进来那个在合适的场合使用单例"><a href="#进来那个在合适的场合使用单例" class="headerlink" title="进来那个在合适的场合使用单例"></a>进来那个在合适的场合使用单例</h2><p>使用单例可以减轻加载的负担、缩短加载时间、提高加载效率，但并不是所有地方都适用于单例，简单来说，单例主要适用于以下三个方面：</p>
<ul>
<li>控制资源的使用，通过线程同步来控制资源的并发访问。</li>
<li>控制实例的产生，以达到节约资源的目的。</li>
<li>控制数据的共享，在不建立直接关联的条件下，让多个不相关的进程或线程之间实现通信。</li>
</ul>
<h2 id="尽量避免随意使用静态变量"><a href="#尽量避免随意使用静态变量" class="headerlink" title="尽量避免随意使用静态变量"></a>尽量避免随意使用静态变量</h2><p>当某个对象被定义为 static 的变量所引用，那么 gc 通常是不会回收这个对象所占有的堆内存的。例如：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br></pre></td><td class="code"><pre><span class="line"><span class="keyword">public</span> <span class="keyword">class</span> <span class="title class_">A</span> &#123;</span><br><span class="line">    <span class="keyword">private</span> <span class="keyword">static</span> <span class="type">B</span> <span class="variable">b</span> <span class="operator">=</span> <span class="keyword">new</span> <span class="title class_">B</span>();</span><br><span class="line">&#125;</span><br></pre></td></tr></table></figure>

<p>此时静态变量 B 的生命周期与 A 类相同，如果 A 类不被卸载，那么引用 B 指向的 B 对象会常驻内存，知道程序终止。</p>
<h2 id="及时清除不再需要的会话"><a href="#及时清除不再需要的会话" class="headerlink" title="及时清除不再需要的会话"></a>及时清除不再需要的会话</h2><p>为了清除不再活动的会话，许多应用服务器都有默认的会话超时时间，一般为 30 分钟。当应用服务器需要保存更多的会话时，如果内存不足，那么操作系统会把部分数据转移到磁盘，应用服务器也可能根据 MRU（最近频繁使用）算法把不分不活跃的会话转储到磁盘，那么必须要先被序列化，在大规模集群中，对对象进行序列化的代价是很昂贵的。因此，当会话不再需要时，应当及时调用 HttpSession 的 invalidate() 方法清楚会话。</p>
<h2 id="实现-RandomAccess-接口的集合比如-ArrayList，应当使用最普通的-foreach-循环来遍历"><a href="#实现-RandomAccess-接口的集合比如-ArrayList，应当使用最普通的-foreach-循环来遍历" class="headerlink" title="实现 RandomAccess 接口的集合比如 ArrayList，应当使用最普通的 foreach 循环来遍历"></a>实现 RandomAccess 接口的集合比如 ArrayList，应当使用最普通的 foreach 循环来遍历</h2><p>这是 JDK 推荐给用户的。JDK API 对于 RandomAccess 接口的解释是：实现 RandowAccess 接口用来表明其支持快速随机访问，此接口的主要目的是允许一般算法更改其行为，从而将其应用到随机或连续访问列表式能提供良好的性能。实际经验表明，实现 RandomAccess 接口的类实例，假如是随机访问的，使用普通 for 循环效率将高于使用 foreach 循环；反过来，如果是顺序访问的，则使用 Iterator 效率更高。可以使用类似如下的代码做判断：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line"><span class="keyword">if</span> (list <span class="keyword">instanceof</span> RandomAccess) &#123;</span><br><span class="line">&#125;</span><br></pre></td></tr></table></figure>

<p>foreach 循环的底层实现原理就是迭代器 Iterator ；可变长度参数以及 foreach 循环原理。所以后半句“反过来，如果是顺序访问的，则使用 Iterator 效率会更高”的意思就是顺序访问的那些类实例，使用 foreach 循环去遍历。</p>
<h2 id="使用同步代码块替代同步方法"><a href="#使用同步代码块替代同步方法" class="headerlink" title="使用同步代码块替代同步方法"></a>使用同步代码块替代同步方法</h2><p>这点在多线程模块中的 synchronized 锁方法块一文中已经讲得很清楚了，除非能确定一整个方法都是需要进行同步的，否则尽量使用同步代码块，避免对那些不需要进行同步的代码也进行了同步，影响了代码执行效率。</p>
<h2 id="将常量声明为-static-final，并以大写命名"><a href="#将常量声明为-static-final，并以大写命名" class="headerlink" title="将常量声明为 static final，并以大写命名"></a>将常量声明为 static final，并以大写命名</h2><p>这样在编译期间就可以把这些内容放入常量池中，避免运行期间计算生成常量的值。另外，将常量的名字以大写命名也可以方便区分出常量与变量。</p>
<h2 id="不要创建一些不使用的对象，不要导入一些不使用的类"><a href="#不要创建一些不使用的对象，不要导入一些不使用的类" class="headerlink" title="不要创建一些不使用的对象，不要导入一些不使用的类"></a>不要创建一些不使用的对象，不要导入一些不使用的类</h2><p>这毫无意义，如果代码中出现 “The value of the local variable i is not used”、“The import java.util is never used”，那么请删除这些无用的内容。</p>
<h2 id="程序运行过程中避免使用反射"><a href="#程序运行过程中避免使用反射" class="headerlink" title="程序运行过程中避免使用反射"></a>程序运行过程中避免使用反射</h2><p>反射是Java提供给用户一个很强大的功能，功能强大往往意味着效率不高。不建议在程序运行过程中使用尤其是频繁使用反射机制，<br>特别是Method的invoke方法，如果确实有必要，一种建议性的做法是将那些需要通过反射加载的类在项目启动的时候通过反射实例化出一个对象并放入内存——用户只关心和对端交互的时候获取最快的响应速度，并不关心对端的项目启动花多久时间。</p>
<h2 id="使用数据库连接池和线程池"><a href="#使用数据库连接池和线程池" class="headerlink" title="使用数据库连接池和线程池"></a>使用数据库连接池和线程池</h2><p>这两个池都是用于重用对象的，前者可以避免频繁地打开和关闭连接，后者可以避免频繁地创建和销毁线程。</p>
<h2 id="使用带缓冲的输入输出流进行-IO-操作"><a href="#使用带缓冲的输入输出流进行-IO-操作" class="headerlink" title="使用带缓冲的输入输出流进行 IO 操作"></a>使用带缓冲的输入输出流进行 IO 操作</h2><p>带缓冲的输入输出流，即 BufferedReader、BufferedWriter、BufferedInputStream、BufferedOutputStream，这可以极大地提升 IO 效率。</p>
<h2 id="ArrayList-和-LinkedList"><a href="#ArrayList-和-LinkedList" class="headerlink" title="ArrayList 和 LinkedList"></a>ArrayList 和 LinkedList</h2><p>顺序插入和随机访问比较多的场景使用 ArrayList，元素删除和中间插入比较多的场景使用 LinkedList 这个，理解 ArrayList 和 LinkedList 的原理就知道了。</p>
<h2 id="不要让-public-方法中有太多的形参"><a href="#不要让-public-方法中有太多的形参" class="headerlink" title="不要让 public 方法中有太多的形参"></a>不要让 public 方法中有太多的形参</h2><p>public 方法即对外提供的方法，如果给这些方法太多形参的话主要有两点坏处：</p>
<ul>
<li>违反了面向对象的编程思想，Java讲求一切都是对象，太多的形参，和面向对象的编程思想并不契合</li>
<li>参数太多势必导致方法调用的出错概率增加<br>至于这个”太多”指的是多少个，3、4 个吧。比如我们用 JDBC 写一个 insertStudentInfo 方法，有 10 个学生信息字段要插入 Student 表中，可以把这 10 个参数封装在一个实体类中，作为 insert 方法的形参。</li>
</ul>
<h2 id="字符串变量和字符串常量-equals-的时候将字符串常量写在前面"><a href="#字符串变量和字符串常量-equals-的时候将字符串常量写在前面" class="headerlink" title="字符串变量和字符串常量 equals 的时候将字符串常量写在前面"></a>字符串变量和字符串常量 equals 的时候将字符串常量写在前面</h2><p>这是一个比较常见的小技巧了，如果有以下代码：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line"><span class="type">String</span> <span class="variable">str</span> <span class="operator">=</span> <span class="string">&quot;119&quot;</span>; </span><br><span class="line"><span class="keyword">if</span> (str.equals(<span class="string">&quot;119&quot;</span>)) &#123; </span><br><span class="line">... </span><br><span class="line">&#125; </span><br></pre></td></tr></table></figure>

<p>建议修改为：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line"><span class="type">String</span> <span class="variable">str</span> <span class="operator">=</span> <span class="string">&quot;119&quot;</span>; </span><br><span class="line"><span class="keyword">if</span> (<span class="string">&quot;119&quot;</span>.equals(str)) &#123; </span><br><span class="line">... </span><br><span class="line">&#125; </span><br></pre></td></tr></table></figure>

<h2 id="不要对数组使用-toString-方法"><a href="#不要对数组使用-toString-方法" class="headerlink" title="不要对数组使用 toString() 方法"></a>不要对数组使用 toString() 方法</h2><p>看一下对数组使用toString()打印出来的是什么：</p>
<figure class="highlight java"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line"><span class="keyword">public</span> <span class="keyword">static</span> <span class="type">void</span> <span class="title function_">main</span><span class="params">(String[] args)</span> &#123;</span><br><span class="line">    <span class="type">int</span>[] <span class="variable">is</span> <span class="operator">=</span> <span class="keyword">new</span> <span class="title class_">int</span>[]&#123;<span class="number">111</span>, <span class="number">123</span>, <span class="number">234</span>&#125;; </span><br><span class="line">    System.out.println(is.toString()); </span><br><span class="line">&#125; </span><br></pre></td></tr></table></figure>

<p>本意是想打印出数组内容，却有可能因为数组引用 is 为空而导致空指针异常。不过虽然对数组 toString() 没有意义，但是对集合 toString() 是可以打印出集合里面的内容的，因为集合的父类 AbstractCollections<E> 重写了 Object 的 toString() 方法。</p>
<h2 id="公用的集合类中不使用的数据一定要及时-remove-掉"><a href="#公用的集合类中不使用的数据一定要及时-remove-掉" class="headerlink" title="公用的集合类中不使用的数据一定要及时 remove 掉"></a>公用的集合类中不使用的数据一定要及时 remove 掉</h2><p>如果一个集合类是公用的（也就是说不是方法里面的属性），那么这个集合里面的元素是不会自动释放的，因为始终有引用指向它们。所以，如果公用集合里面的某些数据不使用而不去 remove 掉它们，那么将会造成这个公用集合不断增大，使得系统有内存泄露的隐患。</p>
