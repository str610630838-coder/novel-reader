# 部署到 GitHub Pages

本项目已改为**纯静态**版本，可直接部署到 GitHub Pages，无需 Node 服务器。

## 1. 删除 Vercel 部署（如之前部署过）

- 打开 [Vercel Dashboard](https://vercel.com/dashboard)，找到 **novel-reader** 项目
- 进入项目 → **Settings** → 最下方 **Delete Project** 删除即可
- 本地可删除 `.vercel` 文件夹（若存在）

## 2. 部署到 GitHub Pages

### 方式一：用仓库的 docs 目录（推荐）

1. 将代码推送到 GitHub（`docs/` 目录已包含 `index.html` 和 `api-client.js`）：
   ```bash
   git add .
   git commit -m "Switch to GitHub Pages (static)"
   git push origin master
   ```

2. 在 GitHub 仓库页面：**Settings** → **Pages**

3. 在 **Build and deployment** 中：
   - **Source** 选 **Deploy from a branch**
   - **Branch** 选 `master`（或你的默认分支）
   - **Folder** 选 **/docs**
   - 点击 **Save**

4. 等待 1–2 分钟，页面会显示：  
   `Your site is live at https://<用户名>.github.io/<仓库名>/`

### 方式二：用 GitHub Actions 发布到根目录

若希望站点在 `https://<用户名>.github.io/<仓库名>/` 下且根路径就是首页，可增加一条 Action 从 `docs` 发布到 `gh-pages`，并在 Pages 里选 **Deploy from branch** → 分支选 `gh-pages`、目录选 `/ (root)`。  
当前推荐直接用 **/docs** 方式即可。

## 3. 本地仅前端调试（可选）

- 用浏览器直接打开 `docs/index.html`，或
- 在项目根目录执行 `npx serve docs`，访问提示的地址

搜索 / 书籍 / 章节 均通过浏览器请求 CORS 代理（api.allorigins.win）拉取书源，无需运行 `server.js`。

## 4. 仍想用 Node 后端时

在项目根目录执行 `node server.js`，访问 `http://localhost:3000`。  
此时会走本地 API，不再经过 CORS 代理。
