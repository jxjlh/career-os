# 部署任务：AI LifeOS 前端到 Vercel

## 项目背景

AI LifeOS 是一个 monorepo 项目（GitHub: `jxjlh/career-os`，分支 `master`）：
- `apps/web` — Next.js 15 前端（App Router，40+ 页面，TailwindCSS，PWA）
- `apps/api` — FastAPI 后端

**后端已部署成功**并在运行：`https://ai-life-os-api-4y3x.onrender.com`（`/health` 返回 `{"status":"ok"}`）。

**目标**：把 `apps/web` 部署到 Vercel（免费 Hobby 计划），作为 iPhone PWA 使用。

## 已完成的工作（无需重复）

1. **Vercel CLI 已认证**：用户 `jxjlh`，auth 文件在 `~/Library/Application Support/com.vercel.cli/auth.json`
   - API Token: `vca_8V314v21OzI73MNyesfwN9nrJ97t8yQ78FygcDjxdshXEaEdVJ18dPJe`
   - Team ID: `team_kILuyoxg194Ky1Joe6Gks0R9`（slug: `ethan-879b`）

2. **Vercel 项目已创建**：`career-os-web`（ID: `prj_TFH3CX2iZtMFsNjjDHWZtGpOPRkP`），项目设置已通过 API 配置好：
   - `framework: nextjs`
   - `buildCommand: next build`
   - `outputDirectory: .next`
   - `installCommand: npm install`
   - `rootDirectory: apps/web`
   - `ssoProtection: null`（已禁用）
   - `gitForkProtection: false`（已禁用）

3. **环境变量已设置**（Production 环境）：
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://odthfgmjgutpsfjkmvto.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_ftRAw_nGku7CG49dOwQ05w_-HTMb82N`
   - `API_UPSTREAM` = `https://ai-life-os-api-4y3x.onrender.com`
   - （不要设 `NEXT_PUBLIC_API_BASE_URL`，留空让前端走 `/api/v1` 相对路径，由 Vercel rewrite 代理转发到 `API_UPSTREAM`）

4. **代码已改为自包含**（commit `cf21795`，已 push 到 GitHub）：
   - `apps/web/lib/utils.ts` — 内联了 `cn()` 函数（原来从 `@career-os/utils` 导入）
   - `apps/web/tsconfig.json` — `@career-os/utils` 指向 `./lib/utils.ts`，移除了其他 monorepo 包路径
   - `apps/web/next.config.ts` — 移除了 `transpilePackages` 和 `outputFileTracingRoot`（不再是 monorepo 构建）
   - `apps/web/vercel.json` — `{ "framework": "nextjs", "buildCommand": "next build", "installCommand": "npm install" }`
   - `.gitignore` — 加了 `.vercel/` 和 `.env.local`

5. **`apps/web/next.config.ts` 的 API 代理**：`/api/v1/:path*` → `${API_UPSTREAM}/api/v1/:path*`

## 当前阻塞问题

用 `vercel --prod --yes`（从 `apps/web` 目录）创建了多次部署，**每次部署都卡在 `BLOCKED` 状态**，构建从未启动（builds API 返回 `state: None`）。

已禁用的保护：
- `ssoProtection`（设为 null）
- `gitForkProtection`（设为 false）
- `protection`（空对象 {}）

**项目没有设置 GitHub 集成**（`link: {}` 为空），所以 `git push` 不会触发自动构建。

## 需要完成的任务

### 方案 A（推荐）：设置 GitHub 集成，用 git push 触发构建

1. 用 Vercel API 把 GitHub 仓库 `jxjlh/career-os` 正式连接到 Vercel 项目 `career-os-web`：
   ```
   PATCH https://api.vercel.com/v9/projects/career-os-web?teamId=team_kILuyoxg194Ky1Joe6Gks0R9
   Authorization: Bearer vca_8V314v21OzI73MNyesfwN9nrJ97t8yQ78FygcDjxdshXEaEdVJ18dPJe
   Content-Type: application/json
   {
     "link": {
       "type": "github",
       "org": "jxjlh",
       "repo": "career-os",
       "productionBranch": "master"
     }
   }
   ```
   如果 API 不支持直接设置 link，可能需要通过 Vercel 控制台（浏览器）连接 GitHub。

2. 连接成功后，推一个空 commit 或重新触发部署：
   ```
   git commit --allow-empty -m "trigger vercel deploy" && git push
   ```
   或用 Vercel API 从 git ref 创建部署：
   ```
   POST https://api.vercel.com/v13/deployments?teamId=team_kILuyoxg194Ky1Joe6Gks0R9
   Authorization: Bearer vca_8V314v21OzI73MNyesfwN9nrJ97t8yQ78FygcDjxdshXEaEdVJ18dPJe
   {
     "name": "career-os-web",
     "target": "production",
     "gitSource": {
       "type": "github",
       "org": "jxjlh",
       "repo": "career-os",
       "ref": "cf217951234567890abcdef..."
     }
   }
   ```
   （用完整的 commit SHA，可用 `git rev-parse HEAD` 获取）

3. 等待构建完成（2-3 分钟），用 API 轮询部署状态：
   ```
   GET https://api.vercel.com/v6/deployments?projectId=prj_TFH3CX2iZtMFsNjjDHWZtGpOPRkP&teamId=team_kILuyoxg194Ky1Joe6Gks0R9&limit=1
   ```
   `readyState` 应从 `INITIALIZING` → `BUILDING` → `READY`。

### 方案 B：用 Vercel API 直接创建部署（带文件上传）

如果 GitHub 集成无法通过 API 设置，用 API 上传文件创建部署：
1. 先用 `POST /v13/deployments?teamId=xxx` 创建部署（不带文件，获取 upload URLs）
2. 用返回的 upload URLs 上传 `apps/web` 的所有文件
3. 部署构建会自动开始

### 方案 C：用 Vercel 控制台（浏览器）

1. 打开 https://vercel.com/ethan-879b/career-os-web/settings/git
2. 连接 GitHub 仓库 `jxjlh/career-os`
3. 设置 Production Branch = `master`，Root Directory = `apps/web`
4. 保存后推一个 commit 触发构建

## 验证清单

部署成功后检查：
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://career-os-web-ethan-879b.vercel.app/` 返回 200 或 302（重定向到 /login）
- [ ] `curl -s https://career-os-web-ethan-879b.vercel.app/login | head -5` 返回真实 HTML（不是 "npm-install-ok"，不是 "Deployment is building"）
- [ ] `curl -s https://career-os-web-ethan-879b.vercel.app/api/v1/health` 返回 `{"status":"ok"}`（验证 API 代理到 Render 后端）
- [ ] 浏览器打开域名 → 能看到登录页 → 注册/登录成功

## 交付

最终前端访问 URL（任一可用即可）：
- `https://career-os-web-ethan-879b.vercel.app`（项目自动别名）
- `https://career-os-web-jxjlh-ethan-879b.vercel.app`（用户别名）

iPhone PWA 安装：用 iPhone Safari 打开上面的 URL → 分享 → 添加到主屏幕。

## 技术栈备忘

- 前端：Next.js 15, App Router, TailwindCSS, Framer Motion, React Query, Supabase Auth
- 后端：FastAPI, SQLAlchemy, Supabase Postgres, 讯飞星火 AI
- PWA：manifest.ts + layout.tsx 已配置 iOS meta 标签和苹果触摸图标
- 中间件：middleware.ts 做路由守卫（未登录 → /login）
