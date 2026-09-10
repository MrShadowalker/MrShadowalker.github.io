# Shadow.Net

个人博客：[chenzihao.me](https://chenzihao.me)。保留 Hexo / Ayer 的海浪封面、侧栏、配色和文章样式。

此仓库是 **GitHub Pages 发布产物**，不是完整的 Hexo 源码仓库。`master` 根目录由 Pages 直接发布，推送即可能更新线上。

## 本地预览与检查

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

访问 `http://127.0.0.1:4173`。预览只绑定本机。不要在这份产物中执行 `hexo clean`，也不要直接用其他目录的 `public/` 覆盖整个仓库。

```sh
python3 scripts/check_site.py
```

检查本地资源、HTML 根标签、依赖版本和域名配置。浏览器回归还应覆盖首页、文章、搜索、手机侧栏、目录、图片预览和代码复制；静态检查不能代替浏览器验证。

## 维护约定

- 更新页面公共逻辑时，同时修改对应的 Hexo 主题源文件，否则下次生成会覆盖修复。
- 样式修改优先放在 `css/custom.css`，保留原主题视觉基线。
- 前端依赖使用确定版本，升级前核对主题 API 兼容性。
- 草稿、审计证据、备份放在忽略的 `docs_private/`，不要提交进公共站点。
- 历史 `* 2.*`、`* 3.*` 文件暂时保留；不能只凭文件名批量删除。
- 发布前保留 `CNAME`、`pCR.html`、`rhythm.html` 及已有文章路径，检查文章清单、搜索、归档和 RSS 的一致性。

2026-09-09 的本地维护记录与文章草稿入口：`docs_private/README.md`。这些文件不会随 Git 推送公开。
