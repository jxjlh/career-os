# 让项目联网 + 做成 iPhone PWA App（全免费方案）

## Context（背景与目标）

用户希望把 AI Life OS 项目部署到公网（联网），并在 iPhone 上当 App 使用，要求**全部免费**。
经探索确认：

- **前端** Next.js 15（`output: "standalone"`），已有 `next.config.ts` 的 `/api/v1/*` → 后端的**服务端 rewrite 代理**（浏览器只访问前端域名，天然避免 CORS）。
- **后端** FastAPI，已有 Dockerfile（uv + uvicorn），`psycopg` Postgres 驱动已就绪，Alembic 迁移齐备。
- **数据库/认证** Supabase 已配置（`.env` 里有 URL / JWT_SECRET / JWKS / XFYUN keys）；`/login` `/signup` 已用 `supabase.auth.signInWithPassword/signUp`；后端 `get_current_user` 已能验证 JWT 并自动建 Profile。
- **PWA** `app/manifest.ts` 存在但极简（1 个图标、无 maskable）；`app/layout.tsx` **完全没有 iOS meta 标签**；**无 apple-touch-icon**；**无 Service Worker**。

用户已确认方案选择：**PWA 添加到主屏幕** + **接入 Supabase 邮箱登录**。

本计划分四部分：A) PWA 增强（让 iPhone 能"添加到主屏幕"成 App）；B) 认证加固（生产可用的登录守卫）；C) 部署就绪（env 文档 + CORS + Render 配置）；D) 部署指南（用户在三平台执行的步骤）。

---

## 免费技术栈选型

| 层 | 方案 | 免费额度 |
|----|------|---------|
| 前端托管 | **Vercel** | Next.js 原生支持，含 rewrite 代理，免费 Hobby 档 |
| 后端托管 | **Render** | 免费 Web Service（Docker），15 分钟无访问会休眠，冷启动 ~30s |
| 数据库 | **Supabase**（已配置） | 免费 500MB Postgres + Auth + JWT |
| iOS App | **PWA**（Add to Home Screen） | 0 成本，无需 Xcode / 开发者账号 |
| AI | **讯飞星火**（已配置） | 免费额度 |

> 备选：后端也可用 Fly.io / Koyeb（同为免费 Docker 托管）。若 Render 冷启动不可接受可切换，env 配置不变。

---

## Part A — PWA 增强（让 iPhone 能"添加到主屏幕"成 App）

iOS Safari 的"添加到主屏幕"**不需要 Service Worker**，只需 manifest + iOS meta 标签 + apple-touch-icon。以下为代码改动：

### A1. 增强 `app/manifest.ts`
- 名称改为 `AI Life OS`（short_name `Life OS`），`start_url: "/"`，`display: "standalone"`，`background_color` / `theme_color` 调成与设计一致（紫色调 `#7c3aed`）。
- icons 增补：保留 512x512，新增 192x192、`purpose: ["any","maskable"]`。
- 增加 `shortcuts`（对话 / 今日建议 / 记忆快捷入口）。

### A2. 在 `app/layout.tsx` 注入 iOS PWA meta 标签
Next.js 15 用 `export const metadata` + `export const viewport` 声明 meta。补：
- `appleWebApp: { capable: true, title: "AI Life OS", statusBarStyle: "black-translucent" }`
- `icons.apple` 指向 `/icons/apple-touch-icon.png`（180x180）
- `manifest` 链接（Next.js 已自动生成 `/manifest.webmanifest`，但显式声明更稳）
- `<meta name="mobile-web-app-capable" content="yes">`（兼容）

### A3. 生成 apple-touch-icon（180x180）
用 macOS 自带 `sips` 从现有 `public/icons/career-os-appicon.png`（512x512）生成 `public/icons/apple-touch-icon.png`（180x180）：
```bash
sips -z 180 180 apps/web/public/icons/career-os-appicon.png --out apps/web/public/icons/apple-touch-icon.png
```

### A4. 轻量 Service Worker（可选，增强 App 体验）
新增 `apps/web/public/sw.js`：缓存 app shell（`/_next/static/*`、`/icons/*`），navigation 走 network-first（联网优先，离线降级到缓存）。在 `apps/web/app/layout.tsx`（或一个 `<SWRegister>` 客户端组件）中**仅生产环境**注册。
> 若担心 SW 复杂度，可先跳过——iOS 不依赖 SW 即可"添加到主屏幕"。本次作为可选项实现最小版。

---

## Part B — 认证加固（Supabase 邮箱登录生产可用）

### B1. 新增路由守卫 `apps/web/middleware.ts`
当前 `(app)` 路由无任何守卫，未登录也能进页面（API 会 401 但页面仍渲染）。
新增 Next.js 中间件：检查 Supabase session（用 `@supabase/ssr` 的 `createServerClient` 读 cookie），未登录访问 `(app)/*` → 重定向 `/login`；已登录访问 `(auth)/*` → 重定向 `/dashboard`。
> 需要 `npm i @supabase/ssr`（免费）。注意：现有登录把 token 存 `localStorage`，SSR 守卫读不到——需把 session 同步到 cookie。最简方案：守卫用 `getSession()`（Supabase 会自动从 localStorage/cookie 读取，但 middleware 跑在 Edge 没有 localStorage）。**采用 `@supabase/ssr` 的 cookie 模式**：在 `lib/supabase.ts` 增加 server client，登录/登出时写 cookie。为降低改动面，**优先方案**：middleware 用轻量判断——读 `career_os_token` cookie（登录时额外 `document.cookie` 写一份），有则放行、无则重定向。这样不引入新依赖、不改 Supabase client 架构。

### B2. 修复 signup token bug
`app/(auth)/signup/page.tsx:29` 在 `signUp` 后无条件 `localStorage.setItem("career_os_token","dev")`，会覆盖真实 session、且生产环境 dev token 无效。
改为：仅当 `isSupabaseConfigured` 为 false 才写 "dev"；否则取真实 session token；若 Supabase 开启邮箱确认则提示"请查收邮件"。

### B3. 登录后跳转优化
`login`/`signup` 现在都跳 `/onboarding`。改为：读取 profile `onboarding_completed`，已完成跳 `/dashboard`，未完成跳 `/onboarding`。（后端 `GET /profile` 已返回该字段。）

---

## Part C — 部署就绪（代码/配置改动）

### C1. 后端 env 文档 `apps/api/.env.example`
列出所有必需变量名 + 注释（不含真实值）：`APP_ENV`、`DATABASE_URL`、`CORS_ORIGINS`、`SUPABASE_JWT_SECRET`（或 `SUPABASE_JWKS_URL`）、`SUPABASE_URL`、`XFYUN_*`、`API_PREFIX`。让 Render 配置有据可依。

### C2. CORS 支持.env 注入生产域名
`config.py` 的 `cors_origins` 已是逗号分隔字符串、`main.py` 已按 `,` split。无需改代码，只需部署时设 `CORS_ORIGINS=https://<vercel域名>`。
> 因前端走 rewrite 代理，浏览器本不直连后端，CORS 不会被触发；但显式配置更安全（应对直连场景）。

### C3. Render 部署配置 `render.yaml`
在仓库根新增 `render.yaml`（Blueprint），声明一个 Web Service：
- runtime: docker，dockerfilePath: `apps/api/Dockerfile`
- health check: `/health`
- env: `APP_ENV=production`、`DATABASE_URL`、`CORS_ORIGINS`、`SUPABASE_JWT_SECRET`、`SUPABASE_JWKS_URL`、`XFYUN_*`（值在 Render 控制台填，不写进文件）
- 注：render.yaml 只放结构，敏感值用 Render 的 secret/env 引用。

### C4. Vercel 部署提示（不改代码，仅文档）
Vercel 导入时 Root Directory 设 `apps/web`；环境变量：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`API_UPSTREAM=https://<render域名>`。`NEXT_PUBLIC_API_BASE_URL` 留空（走相对 `/api/v1` → rewrite 代理）。

---

## Part D — 部署指南（用户在三平台执行，我提供步骤文档）

写一份 `DEPLOY.md`（仓库根），分步说明：

### D1. Supabase（数据库 + 认证）
1. 进入已建项目 `odthfgmjgutpsfjkmvto` → Authentication → Providers → 启用 **Email**。
2. （可选）关闭 "Confirm email" 以便自测，或保持开启走邮箱确认。
3. 拿到 `Database` → Connection string（pooler 模式，`?pgbouncer=true`）作为 `DATABASE_URL`。
4. 拿到 Project Settings → API → `JWT secret` 作为后端 `SUPABASE_JWT_SECRET`。

### D2. 后端 → Render
1. New → Web Service → 连接 GitHub 仓库 → 用 `render.yaml`（或手动 Docker，路径 `apps/api/Dockerfile`）。
2. 填环境变量（见 C1）。
3. 部署后访问 `https://<service>.onrender.com/health` 验证。
4. **跑迁移**：Render Shell 执行 `alembic upgrade head`（或在启动命令加 `alembic upgrade head && uvicorn ...`）。

### D3. 前端 → Vercel
1. New Project → 导入仓库 → Root Directory 选 `apps/web`。
2. 填环境变量（见 C4），`API_UPSTREAM` 填 Render 域名。
3. Deploy。访问 Vercel 域名 → 登录 → 使用。

### D4. iPhone 安装为 App
1. iPhone Safari 打开 Vercel 域名 → 登录。
2. Safari 分享按钮 → "添加到主屏幕"。
3. 主屏出现 "AI Life OS" 图标，点击即全屏独立运行（无 Safari 地址栏）。

---

## 关键改动文件清单

| 文件 | 改动 |
|------|------|
| `apps/web/app/manifest.ts` | 增强：名称/图标/shortcuts/maskable |
| `apps/web/app/layout.tsx` | 注入 iOS PWA meta + apple-touch-icon + manifest |
| `apps/web/public/icons/apple-touch-icon.png` | 新增 180x180（sips 生成） |
| `apps/web/public/sw.js` | 新增最小 Service Worker（可选） |
| `apps/web/middleware.ts` | 新增路由守卫（未登录重定向 /login） |
| `apps/web/app/(auth)/signup/page.tsx` | 修复 token bug + 跳转优化 |
| `apps/web/app/(auth)/login/page.tsx` | 跳转优化（按 onboarding_completed） |
| `apps/api/.env.example` | 新增：部署 env 文档 |
| `render.yaml` | 新增：Render Blueprint |

> 认证 cookie 方案若需，会在 `apps/web/lib/supabase.ts` 增加最小 cookie 写入辅助（不改 Supabase client 架构）。

---

## 验证方式

1. **PWA 本地验证**：`npm run build && npm start`，用 Chrome DevTools → Application → Manifest 确认图标/meta 齐全；Lighthouse → PWA 审计通过基本项。
2. **iOS 验证**：`npm run dev` + 手机同网访问 `http://<本机IP>:3000`（或部署后访问 Vercel 域名），Safari → 添加到主屏幕 → 确认全屏独立运行、图标正确。
3. **认证验证**：未登录访问 `/dashboard` → 重定向 `/login`；注册/登录后能调通 `/api/v1/profile`。
4. **联网验证**：Vercel 域名打开 → 登录 → `/life/coach` 能调 AI 对话（经 rewrite 代理到 Render → Supabase → XFYUN）。
5. **后端健康**：`curl https://<render域名>/health` 返回 ok；`alembic current` 确认迁移到最新 head。

---

## 已知限制（免费档）

- **Render 冷启动**：15 分钟无访问休眠，下次请求 ~30s 冷启动（首字慢）。可定时 ping 缓解，或换 Fly.io。
- **Vercel rewrite 代理超时**：AI 长请求（>30s）可能被 Vercel 边缘超时。讯飞星火通常 <10s 返回，可接受；超长任务（年度复盘）建议前端轮询或后端异步。
- **PWA 不上架 App Store**：PWA 只能"添加到主屏幕"，无法在 App Store 分发。如需上架需 Capacitor + $99/年开发者账号（非免费，本方案不含）。
- **Supabase 免费档**：500MB 数据库、5万月活认证用户，个人使用充足。
