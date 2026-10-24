# Shadow.Net Hexo 源码

这是 Shadow.Net 的完整本地维护工程，使用 Hexo 6.3.0 和随项目保存的 Ayer 主题覆盖。`source/_posts/` 里的 51 篇文章由现有 Pages 页面恢复，正文保留 HTML 片段，以保持旧文章的表格、代码块、图片和链接结构；复杂的旅行页、关于页、计划页和其他独立 HTML 也在 `source/` 中原样维护。

```sh
npm install        # 首次安装
npm run server     # Hexo 开发预览
npm run build      # 清理并生成 public/
npm run publish    # 生成后同步到仓库根目录
```

根目录是 GitHub Pages 的发布目标，`public/` 是可删除的构建目录并被 Git 忽略。公共样式和脚本的维护入口是 `source/`；主题模板、配置合并和评论/搜索等功能覆盖在 `themes/ayer/`。生成结果会保留 `.html` 文章 URL、RSS、搜索索引、站点地图、CNAME 和现有独立页面。
