# 任务：修复 AI Life OS 后端 Render 服务的 postgres 连接失败

## 项目背景

AI Life OS 是一个 monorepo（GitHub: `jxjlh/career-os`，分支 `master`）：
- `apps/web` — Next.js 15 前端（**已部署成功**到 Vercel）
- `apps/api` — FastAPI 后端（Docker 部署到 Render，**postgres 连接失败**）

## 当前状态（已验证）

| 组件 | URL | 状态 |
|------|-----|------|
| 前端 Vercel | `https://career-os-op3iies6e-ethan-879b.vercel.app` | ✅ READY，`/` 返回 200 真实 HTML |
| 前端 PWA manifest | `https://career-os-op3iies6e-ethan-879b.vercel.app/manifest.webmanifest` | ✅ 正常 |
| 后端 Render `/health` | `https://ai-life-os-api-4y3x.onrender.com/health` | ✅ `{"status":"ok"}` |
| 后端 Render `/ready` | `https://ai-life-os-api-4y3x.onrender.com/ready` | ❌ `{"status":"degraded","checks":{"storage":"ok","ai_provider":"ok","postgres":"error"}}` |

**唯一阻塞点**：后端 `/ready` 的 `postgres: error`。原因：Render 上 `DATABASE_URL` 环境变量未正确配置（或为空，导致 fallback 到 sqlite，但 sqlite 文件在容器内无法写入或迁移失败）。

## 已知凭据（这些已泄露在 git history，可直接使用）

```
Supabase Project Ref:    odthfgmjgutpsfjkmvto
Supabase Project URL:    https://odthfgmjgutpsfjkmvto.supabase.co
Supabase Anon Key (旧格式 JWT，前端用):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdGhmZ21qZ3V0cHNmamttdnRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NjIxNTcsImV4cCI6MjEwMTAzODE1N30.ORovjxkwm74Jpc-_cp6oK60k16--WF6ttcKqzobRkbE

Supabase Service Role Key (后端用):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdGhmZ21qZ3V0cHNmamttdnRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQ2MjE1NywiZXhwIjoyMTAxMDM4MTU3fQ.s3UL2Jpi7eMmE9AAh5d08WuDzNcUsSupjOu8ja81KNQ

Vercel 前端域名: https://career-os-op3iies6e-ethan-879b.vercel.app
Render 后端域名:  https://ai-life-os-api-4y3x.onrender.com
```

## 需要用户提供（请在开始前向用户索取）

```
1. Supabase 数据库密码（Database password）
   获取路径：https://supabase.com/dashboard/project/odthfgmjgutpsfjkmvto/settings/database
   → 初始数据库密码设过的话用旧的；忘了就点 "Reset database password" 重置一个新的

2. Render API Key
   获取路径：https://dashboard.render.com/account/api-keys
   → 创建一个 API Key（格式 rnd_开头的字符串）
   → 同时记下 Owner ID（同页面可见）
```

## 你（codex）要完成的任务

### 步骤 1：构造 DATABASE_URL

用 Supabase pooler 模式（端口 6543，必须带 `?pgbouncer=true`）：

```
postgresql://postgres:<URL编码后的密码>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
```

**关键：密码必须 URL-encode**，否则 `+` 会被解析成空格、`==` 会被截断，导致连接失败。
- `+` → `%2B`
- `/` → `%2F`
- `=` → `%3D`
- `@` → `%40`
- `:` → `%3A`

用 Python 做编码（不要手写）：
```python
from urllib.parse import quote_plus
password = "<用户提供的原始密码>"
encoded = quote_plus(password)
# 例：密码 "ab+cd/ef=" → encoded "ab%2Bcd%2Fef%3D"
```

**Pooler host 怎么找**：去 Supabase Dashboard → Project Settings → Database → Connection string → 选 "Pooler connection string"（注意不是 Direct connection），完整 URL 里就包含 host（形如 `aws-0-us-east-1.pooler.supabase.com` 或 `aws-0-ap-northeast-1.pooler.supabase.com`）。如果无法访问 Dashboard，先尝试常见的 host：
- `aws-0-us-east-1.pooler.supabase.com`
- `aws-0-ap-northeast-1.pooler.supabase.com`
- 或者用 Direct connection（端口 5432，不带 pgbouncer 参数）作为备选：
  ```
  postgresql://postgres:<encoded_pwd>@db.odthfgmjgutpsfjkmvto.supabase.co:5432/postgres?sslmode=require
  ```

### 步骤 2：通过 Render API 设置环境变量

Render API 文档：https://api-docs.render.com/

**先列出服务找到 service ID**：
```bash
RENDER_API_KEY="<用户提供的 Render API Key>"
curl -s "https://api.render.com/v1/services" \
  -H "Authorization: Bearer $RENDER_API_KEY" | python3 -c "
import sys, json
services = json.load(sys.stdin)
for s in services:
    print(s['service']['id'], '|', s['service']['name'], '|', s['service']['type'])
"
```
找到 `ai-life-os-api-4y3x` 对应的 service ID（形如 `srv-xxxxxxxxxxxxxxxxxx`）。

**设置环境变量**（用 `PUT /v1/services/{serviceId}/env-vars`，会整体替换，所以要先列出当前的再合并）：

```bash
SERVICE_ID="srv-xxxxxxxx"

# 先 GET 当前的环境变量
curl -s "https://api.render.com/v1/services/$SERVICE_ID/env-vars" \
  -H "Authorization: Bearer $RENDER_API_KEY" > /tmp/current_env.json

# 合并后 PUT 回去（payload 是数组，每项 {key, value}）
```

**必须设置的环境变量**：

| Key | Value |
|-----|-------|
| `APP_ENV` | `production` |
| `API_PREFIX` | `/api/v1` |
| `DATABASE_URL` | 步骤 1 构造的完整 pgbouncer 连接串 |
| `CORS_ORIGINS` | `https://career-os-op3iies6e-ethan-879b.vercel.app` |
| `SUPABASE_URL` | `https://odthfgmjgutpsfjkmvto.supabase.co` |
| `SUPABASE_ANON_KEY` | 上面的 anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 上面的 service role key |
| `SUPABASE_JWT_SECRET` | **留空字符串 ""**（重要！见下方说明） |
| `XFYUN_API_KEY` | 如果有就填，没有留空 |
| `XFYUN_API_SECRET` | 同上 |
| `XFYUN_APP_ID` | 同上 |
| `SPARK_MODEL` | `Spark-Lite` |
| `SPARK_WS_URL` | `wss://spark-api.xf-yun.com/v1.1/chat` |
| `SPARK_DOMAIN` | `lite` |

**⚠️ SUPABASE_JWT_SECRET 必须留空**：后端代码 `apps/api/app/core/security.py` 检测到此值为空时，会用 ES256 算法 + JWKS 公钥 URL 验证 JWT（与 Supabase 默认签发的 ES256 JWT 一致）；如果填了旧的 HS256 secret，所有登录请求都会 401。

### 步骤 3：触发重新部署

```bash
curl -s -X POST "https://api.render.com/v1/services/$SERVICE_ID/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": false}' | python3 -m json.tool
```

### 步骤 4：轮询部署状态 + 健康检查

Render 部署需要 2-5 分钟。轮询直到 `/ready` 返回 `postgres: ok`：

```bash
# 等 60 秒让构建启动
sleep 60

# 每 30 秒检查一次，最多 10 分钟
for i in $(seq 1 20); do
  echo "=== try $i ==="
  RESULT=$(curl -s -m 15 https://ai-life-os-api-4y3x.onrender.com/ready)
  echo "$RESULT"
  if echo "$RESULT" | grep -q '"postgres": "ok"'; then
    echo "✅ postgres connected!"
    break
  fi
  sleep 30
done
```

### 步骤 5：如果 postgres 仍 error，读错误详情

我刚改了 `/ready` 让它返回 `postgres_error` 字段（commit `f1bdfee`，已 push）。如果部署后 `/ready` 还报 error，直接看返回里的 `postgres_error` 字段，常见错误：

| 错误信息 | 根因 | 修复 |
|---------|------|------|
| `password authentication failed` | 密码错或没 URL-encode | 检查密码是否 URL-encode 正确 |
| `connection refused` | host 或端口错 | 换 Direct connection（5432）或换 pooler host |
| `server closed the connection unexpectedly` | pgbouncer 参数缺失 | 确保 URL 带 `?pgbouncer=true` |
| `SSL connection is required` | 缺 sslmode | URL 加 `&sslmode=require` |
| `database "postgres" does not exist` | db name 错 | 应该是 `postgres`（Supabase 默认） |

### 步骤 6：跑 Alembic 数据库迁移

Render Dockerfile 启动命令已包含 `uv run alembic upgrade head`，首次连接成功会自动跑迁移建表。如果迁移失败，去 Render Dashboard → service → Shell 执行：

```bash
cd /app && uv run alembic upgrade head
```

### 步骤 7：端到端验证

```bash
# 1. 后端 ready
curl -s https://ai-life-os-api-4y3x.onrender.com/ready
# 期望：{"status":"ready","checks":{"storage":"ok","ai_provider":"ok","postgres":"ok"}}

# 2. 前端首页
curl -s -o /dev/null -w "%{http_code}\n" https://career-os-op3iies6e-ethan-879b.vercel.app/
# 期望：200

# 3. 前端 → 后端 API 代理
curl -s https://career-os-op3iies6e-ethan-879b.vercel.app/api/v1/auth/me
# 期望：401（未登录，但说明代理通了）

# 4. 浏览器注册/登录测试
# 打开 https://career-os-op3iies6e-ethan-879b.vercel.app/signup
# 注册一个账号 → 登录 → 访问 /dashboard 应能正常显示
```

## 关键代码位置（供参考，不要改）

- 后端 JWT 验证逻辑：`apps/api/app/core/security.py`
- 后端数据库连接：`apps/api/app/core/database.py` + `apps/api/app/core/config.py`（`normalize_db_url()` 自动处理密码 URL-encode）
- 后端健康检查：`apps/api/app/domains/health/router.py`
- Render 配置：`render.yaml`（根目录）
- 前端 Vercel 配置：`apps/web/vercel.json` + `apps/web/next.config.ts`
- 前端 Supabase 客户端：`apps/web/lib/supabase.ts`

## 失败时的回退方案

如果 Render 的 free 档持续连不上 Supabase（比如 pgbouncer 在 free 档有问题），备选：

1. **改用 Direct connection**（端口 5432，不走 pgbouncer）：
   ```
   postgresql://postgres:<encoded_pwd>@db.odthfgmjgutpsfjkmvto.supabase.co:5432/postgres?sslmode=require
   ```

2. **换免费托管平台**：Fly.io 或 Koyeb（同样支持 Docker，env 配置不变）。Fly.io 对 Postgres 长连接更友好。

3. **临时用 SQLite 跑通**：在 Render 把 `DATABASE_URL` 设为 `sqlite:///./career_os.db`，能验证前后端联通，但数据不持久（每次部署重置）。仅用于 demo，不可长期用。

## 完成标准

- [ ] `curl https://ai-life-os-api-4y3x.onrender.com/ready` 返回 `"postgres": "ok"`
- [ ] `curl https://ai-life-os-api-4y3x.onrender.com/api/v1/auth/me` 返回 401（不是 500）
- [ ] 浏览器打开 `https://career-os-op3iies6e-ethan-879b.vercel.app/signup` 能注册账号
- [ ] 注册后登录，访问 `/dashboard` 能正常显示（说明 DB 写入 + 读取都正常）

完成后告诉我：
1. 最终用的 DATABASE_URL 形式（pgbouncer 还是 direct，哪个 host）
2. /ready 的返回 JSON
3. 是否跑了 alembic 迁移，结果如何
4. 注册登录测试是否成功
