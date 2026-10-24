# Shadow.Net

个人博客：[chenzihao.me](https://chenzihao.me)。仓库同时保存可维护的 Hexo 源码和 GitHub Pages 发布产物：`hexo/` 是唯一编辑入口，仓库根目录是可直接部署的静态结果。

## 本地维护

首次使用先安装依赖：

```sh
cd hexo
npm install
```

日常编辑文章放在 `hexo/source/_posts/`，主题覆盖和公共前端资源分别放在 `hexo/themes/ayer/` 与 `hexo/source/`。文章正文保留为 HTML 片段，是为了让旧文章里的表格、代码、图片和交互标记在重建后保持不变；`about/`、`schedule/`、`pCR.html`、`rhythm.html` 和 `trip/` 是独立页面，也保留为原始静态页面。

预览源工程：

```sh
cd hexo
npm run server
```

生成并检查静态结果：

```sh
cd hexo
npm run build
cd ..
python3 scripts/check_site.py
```

`hexo/public/` 是构建缓存，已加入忽略规则。确认预览和检查通过后，用下面的命令把生成结果同步到仓库根目录：

```sh
cd hexo
npm run publish
```

也可以直接预览已经生成的 Pages 目录，并保留自定义 404 行为：

```sh
python3 scripts/serve.py --root hexo/public
```

根目录静态文件用于 GitHub Pages 发布，请不要手工编辑生成的文章、归档、分类、标签或首页 HTML；修改源码后重新 `npm run publish`。发布前会保留 `CNAME`、特殊独立页面和现有文章路径，并清理已从 Hexo 结果中移除的旧产物。

## 清理记录

已清理历史 `* 2.*`、`* 3.*` 等 iCloud/Finder 重复副本；`.gitignore` 已拦截同类文件。依赖版本固定在 `hexo/package.json` 和 `hexo/package-lock.json`，升级前请先检查 Ayer 主题和本地交互脚本。
