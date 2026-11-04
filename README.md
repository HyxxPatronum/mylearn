# MyLearn 个人学习笔记

纯静态的 Markdown 笔记站：编辑器 + 阅读器 + 目录，全部在浏览器里运行，零后端。
算法与 Agent 学习笔记都记在这里。

- 线上地址：https://hyxxpatronum.github.io/mylearn/
- 本地使用：直接双击 `index.html`（离线可用，渲染库在 `vendor/`）。

## 目录结构

```
index.html          页面骨架
app.js              笔记数据与增删改逻辑
components.js       图标、目录搜索、侧栏等 UI 组件
styles.css          统一样式
vendor/             marked / DOMPurify / Lucide（本地离线）
published-data.js   发布快照：页面加载的笔记数据
site.config.json    站点标题、描述、作者、线上地址
tools/build.mjs     生成可发布的 dist/
tools/make-default-data.mjs  重置为起始笔记
tools/deploy.mjs    通过 GitHub API 发布
.github/workflows/pages.yml  GitHub Pages 自动部署
dist/               构建产物（不进 git）
```

## 写作

1. 打开 `index.html`，用「新建笔记 / 新建分类」写 Markdown，右侧实时预览。
2. 内容自动存进当前浏览器（localStorage）。
3. 想发布时，点侧栏「复制笔记数据」，把内容存成 `library.json`，然后：

   ```bash
   node tools/build.mjs --library library.json
   ```

   这会把数据写进 `published-data.js`（`dist/` 和仓库根目录各一份）。
4. 推送后 GitHub Actions 自动部署，几十秒后线上生效。

> 线上页面优先读 `published-data.js`，所以访客总能看到你发布的版本；
> 你自己的编辑草稿只存在你自己的浏览器里，不会互相覆盖。

## 发布到 GitHub Pages

仓库已包含 `.github/workflows/pages.yml`：每次 push 到 `main` 都会发布整站。

首次发布（或换机器）：

```powershell
$env:DSH_GITHUB_TOKEN = '你的 token'
node tools/deploy.mjs HyxxPatronum mylearn
```

token 需要 Contents: write、Administration: write、Pages: write。
如果 token 没有建库/开 Pages 权限，先在网页上建好空仓库 `mylearn`，
Repository → Settings → Pages → Source 选 **GitHub Actions**，再运行上面的命令。

也可以不用脚本，直接：

```bash
git add .
git commit -m "publish"
git push origin main
```

## 注意

- 仓库是公开的，不要把隐私笔记提交上来。
- 只改 `published-data.js` 就能更新内容，改 `app.js` / `styles.css` 才会动界面。
