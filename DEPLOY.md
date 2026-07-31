# 部署指南：AI Life OS 联网 + iPhone PWA 安装（全免费）

本指南把项目部署到公网，并在 iPhone 上作为 App 运行，全程免费。

## 免费技术栈

| 层 | 方案 | 说明 |
|----|------|------|
| 前端 | **Vercel** | Next.js 原生托管，含 `/api/v1/*` → 后端的 rewrite 代理，浏览器只访问前端域名 |
| 后端 | **Render** | 免费 Docker Web Service，15 分钟无访问休眠，冷启动 ~30s |
| 数据库 / 认证 | **Supabase**（已配置） | 免费 500MB Postgres + Auth + JWT |
| iPhone App | **PWA**（添加到主屏幕） | 无需 Xcode / $99 开发者账号 |
| AI | **讯飞星火**（已配置） | 免费额度 |

> 后端备选：Fly.io / Koyeb（同为免费 Docker 托管），env 配置不变。
> ⚠️ 之前 `render.yaml` 曾把 Supabase service_role_key / anon_key / DB 密码以明文提交到仓库——**已泄露，部署前请先去 Supabase 控制台轮换这些密钥**（Settings → API → Reset）。

---

## D1. Supabase 配置（数据库 + 认证）

1. 进入已建项目（`odthfgmjgutpsfjkmvto`）→ **Authentication → Providers** → 启用 **Email**。
2. （自测）关闭 "Confirm email"，或保持开启走邮箱确认流程。
3. **轮换密钥**（必做，因曾泄露）：Project Settings → API → 对 `anon key`、`service_role key` 点 Reset；Database 设新密码。
4. 取 `Database → Connection string`（**pooler 模式**，端口 6543，带 `?pgbouncer=true`）作为后端 `DATABASE_URL`。
5. 取 Project Settings → API → `JWT secret` 作为后端 `SUPABASE_JWT_SECRET`。
6. 记下 `Project URL`、`anon key`（前端要用）。

---

## D2. 后端 → Render

1. Render Dashboard → **New → Blueprint** → 连接 GitHub 仓库 → 自动读取根目录 `render.yaml`。
2. 服务 `ai-life-os-api` 创建后，进入 Environment 填写 `sync: false` 的变量（值不写入仓库）：

   | 变量 | 取值来源 |
   |------|---------|
   | `DATABASE_URL` | D1.4 的 pooler 连接串 |
   | `CORS_ORIGINS` | D3 完成后的 Vercel 域名（先留空，部署完前端回来填） |
   | `SUPABASE_URL` | `https://odthfgmjgutpsfjkmvto.supabase.co` |
   | `SUPABASE_ANON_KEY` | D1.6 |
   | `SUPABASE_SERVICE_ROLE_KEY` | D1.3 轮换后的新值 |
   | `SUPABASE_JWT_SECRET` | D1.5 |
   | `XFYUN_API_KEY` / `XFYUN_API_SECRET` / `XFYUN_APP_ID` | 讯飞控制台 |

3. 部署完成后访问 `https://<service>.onrender.com/health` 应返回 `ok`。
4. **跑数据库迁移**：Render Shell 执行 `alembic upgrade head`（或修改启动命令为 `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`）。

> 免费档 15 分钟无访问会休眠，首请求冷启动 ~30s。可用免费 cron（如 cron-job.org）每 10 分钟 ping `/health` 保活。

---

## D3. 前端 → Vercel

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

## D4. iPhone 安装为 App

1. iPhone **Safari**（必须 Safari，Chrome 不支持"添加到主屏幕"全屏）打开 Vercel 域名 → 登录。
2. 点底部 **分享按钮** → **"添加到主屏幕"** → 命名"AI Life OS" → 添加。
3. 主屏出现"AI Life OS"图标，点击即**全屏独立运行**（无 Safari 地址栏）。
4. 长按图标可看到快捷操作：AI 对话 / 今日建议 / 长期记忆（来自 manifest shortcuts）。

---

## 验证清单

- [ ] `curl https://<render域名>/health` 返回 ok
- [ ] Render Shell `alembic current` 显示最新 head
- [ ] Vercel 域名打开 → 注册/登录成功
- [ ] 未登录访问 `/dashboard` → 自动重定向到 `/login`
- [ ] `/life/coach` 能发起 AI 对话（经 rewrite 代理 → Render → Supabase → 讯飞）
- [ ] iPhone Safari → 添加到主屏幕 → 全屏运行、图标正确、状态栏样式正确

## 已知限制（免费档）

- **Render 冷启动**：15 分钟无访问休眠，首请求慢 ~30s（可定时 ping 缓解）。
- **Vercel rewrite 超时**：AI 长请求（>30s）可能被边缘超时。讯飞通常 <10s 可接受；超长任务（年度复盘）建议前端轮询。
- **PWA 不上架 App Store**：仅"添加到主屏幕"。如需上架需 Capacitor + $99/年开发者账号（非免费）。
- **Supabase 免费档**：500MB 数据库、5 万月活认证用户，个人使用充足。
