# 部署指南：AI Life OS 联网 + iPhone PWA 安装（全免费）

本指南把项目部署到公网，并在 iPhone 上作为 App 运行，全程免费。

## 免费技术栈

| 层 | 方案 | 说明 |
|----|------|------|
| 前端 | **Render（推荐）** | `render.yaml` Blueprint 自动部署 Next.js standalone，内置 `/api/v1/*` → 后端 rewrite 代理；也可选 Vercel |
| 后端 | **Render** | 免费 Docker Web Service，自动跑 Alembic 迁移，15 分钟无访问休眠，冷启动 ~30s |
| 数据库 / 认证 | **Supabase**（已配置） | 免费 500MB Postgres + Auth + JWT |
| iPhone App | **PWA**（添加到主屏幕） | 无需 Xcode / $99 开发者账号 |
| AI | **讯飞星火**（已配置） | 免费额度 |

> 后端备选：Fly.io / Koyeb（同为免费 Docker 托管），env 配置不变。
> 前端备选：Vercel 部署方式见本文件 D3（Root Directory 选 `apps/web`）。
> ⚠️ 之前 `render.yaml` 曾把 Supabase service_role_key / anon_key / DB 密码以明文提交到仓库——**已泄露，部署前请先去 Supabase 控制台轮换这些密钥**（Settings → API → Reset）。

---

## D1. Supabase 配置（数据库 + 认证）

1. 进入已建项目（`odthfgmjgutpsfjkmvto`）→ **Authentication → Providers** → 启用 **Email**。
2. （自测）关闭 "Confirm email"，或保持开启走邮箱确认流程。
3. **轮换密钥**（必做，因曾泄露）：Project Settings → API → 对 `anon key`、`service_role key` 点 Reset；Database 设新密码。
4. 取 `Database → Connection string`（**pooler 模式**，端口 6543，带 `?pgbouncer=true`）作为后端 `DATABASE_URL`。
5. Project Settings → API → `JWT secret` 可不填：后端留空时自动用 ES256 + JWKS 公钥验证 Supabase 默认签发的 JWT。
6. 记下 `Project URL`、`anon key`（前端要用）。

---

## D2. 全栈 → Render Blueprint（推荐）

1. Render Dashboard → **New → Blueprint** → 连接 GitHub 仓库 → 自动读取根目录 `render.yaml`，一次创建 `ai-life-os-api` 与 `ai-life-os-web` 两个服务。
2. 服务创建后，进入 Environment 填写 `sync: false` 的变量（值不写入仓库）：

   | 变量 | 取值来源 |
   |------|---------|
   | `DATABASE_URL` | D1.4 的 pooler 连接串 |
   | `CORS_ORIGINS` | D3 完成后的前端域名（先留空，部署完前端回来填） |
   | `SUPABASE_URL` | `https://odthfgmjgutpsfjkmvto.supabase.co` |
   | `SUPABASE_ANON_KEY` | D1.6 |
   | `SUPABASE_SERVICE_ROLE_KEY` | D1.3 轮换后的新值 |
   | `SUPABASE_JWT_SECRET` | **留空**：后端自动走 ES256 + JWKS 公钥验证，与 Supabase 默认签发的 JWT 一致 |
   | `XFYUN_API_KEY` / `XFYUN_API_SECRET` / `XFYUN_APP_ID` | 讯飞控制台 |

3. 后端 Dockerfile 已支持 Render 注入的 `$PORT`（未注入时默认 8000），启动命令包含 `alembic upgrade head`，无需手动迁移。
4. 部署完成后访问 `https://<service>.onrender.com/health` 应返回 `ok`，访问 `/ready` 应显示 `"postgres": "ok"`。
5. 前端服务名 `ai-life-os-web`，构建产物为 Next.js standalone（`apps/web/Dockerfile`），无需额外配置。

> 免费档 15 分钟无访问会休眠，首请求冷启动 ~30s。可用免费 cron（如 cron-job.org）每 10 分钟 ping `/health` 保活。

---

## D3. 前端 → Vercel（可选）

> 使用 Render Blueprint 时跳过本节；只有想单独把前端放 Vercel 时才按下面操作。

1. Vercel → **New Project** → 导入仓库 → **Root Directory 选 `apps/web`**。
2. Framework Preset 自动识别为 Next.js。Build/Output 用默认。
3. Environment Variables：

   | 变量 | 值 |
   |------|----|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://odthfgmjgutpsfjkmvto.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | D1.6 的 anon key |
   | `API_UPSTREAM` | `https://<service>.onrender.com`（D2 的 Render 域名） |

   > **不要**设 `NEXT_PUBLIC_API_BASE_URL`：留空时前端走相对 `/api/v1`，由 Vercel rewrite 代理转发到 `API_UPSTREAM`，浏览器只访问前端域名、天然避免 CORS。
4. Deploy。拿到 Vercel 域名后**回 D2 补 `CORS_ORIGINS`**（应对直连场景，双保险）。

---

## D4. 联网搜索（学习搜索引擎）

`学习搜索` 模块已经内置多数据源。免费无需 key 的有 **Wikipedia** 与 **GitHub**；需要免费 key 的按需填写：

| 变量 | 用途 | 免费额度 |
|------|------|---------|
| `TAVILY_API_KEY` | Tavily 网页搜索 | 每月 1000 次 |
| `EXA_API_KEY` | Exa 语义搜索 | 每月 1000 次 |
| `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX` | Google 自定义搜索 | 每天 100 次 |
| `BING_API_KEY` | Bing 搜索 | 每月 1000 次 |
| `YOUTUBE_API_KEY` | YouTube 学习视频 | 每天 10000 配额 |

在 Render 服务的 Environment 里填入对应变量即可，无需改代码。

> 关于 Streamlit：本项目是 Next.js + FastAPI 架构，Streamlit Community Cloud 只能部署 Python 数据应用，无法托管 Next.js 前端，因此网站不能部署到 Streamlit。仓库的 `render.yaml`（Render Blueprint）已把前端与后端一起免费部署，是等效且更合适的方案。

---

## D5. iPhone 安装为 App

1. iPhone **Safari**（必须 Safari，Chrome 不支持"添加到主屏幕"全屏）打开 Vercel 域名 → 登录。
2. 点底部 **分享按钮** → **"添加到主屏幕"** → 命名"AI Life OS" → 添加。
3. 主屏出现"AI Life OS"图标，点击即**全屏独立运行**（无 Safari 地址栏）。
4. 长按图标可看到快捷操作：AI 对话 / 今日建议 / 长期记忆（来自 manifest shortcuts）。
5. 图标已重设计：`public/icons/career-os-appicon.png`（512）、`career-os-appicon-192.png`（192）、`apple-touch-icon.png`（180）。

---

## D6. GitHub → CI → Render 自动部署

项目已按以下顺序部署：

1. 在任意开发机器上首次执行 `./scripts/setup-auto-deploy.sh`。它会启用版本库里的 `.githooks/post-commit`。
2. 每次成功 `git commit` 后，钩子会自动把当前分支推送到 `origin`。如需保留某次提交在本地，使用 `SKIP_AUTO_PUSH=1 git commit ...`。
3. `master` 的 GitHub CI（API 测试、前端类型检查、Lint、构建）全部通过后，Render 才会部署 API 和 Web 服务；`render.yaml` 使用 `autoDeployTrigger: checksPass`。
4. GitHub Actions 中的 **Verify Render deployment** 会轮询 API `/ready` 与 Web 根路径。若持续失败，工作流会失败并提示查看对应 Render 服务的构建/运行日志。
5. 修复失败时，先按 GitHub Actions 或 Render 日志处理根因，执行相关验证，再提交。自动推送与 CI/Render 部署会再次触发。

> 自动推送只会在提交后发生，不会在保存文件时自动创建提交，以避免把未完成工作、误删或敏感内容发布到 GitHub。

---

## 验证清单

- [ ] `curl https://<render域名>/health` 返回 ok
- [ ] `curl https://<render域名>/ready` 返回 `"postgres": "ok"`
- [ ] Render Shell `alembic current` 显示最新 head
- [ ] 前端域名打开 → 注册/登录成功
- [ ] 未登录访问 `/dashboard` → 自动重定向到 `/login`
- [ ] `/planner` 能加载本周学习与阅读计划（经 rewrite 代理 → Render → Supabase）
- [ ] `学习搜索` 能返回 Wikipedia / GitHub 结果（联网生效）
- [ ] iPhone Safari → 添加到主屏幕 → 全屏运行、图标正确、状态栏样式正确

## 已知限制（免费档）

- **Render 冷启动**：15 分钟无访问休眠，首请求慢 ~30s（可定时 ping 缓解）。
- **rewrite 超时**：AI 长请求（>30s）可能被托管平台边缘超时。讯飞通常 <10s 可接受；超长任务（年度复盘）建议前端轮询。
- **PWA 不上架 App Store**：仅"添加到主屏幕"。如需上架需 Capacitor + $99/年开发者账号（非免费）。
- **Supabase 免费档**：500MB 数据库、5 万月活认证用户，个人使用充足。
