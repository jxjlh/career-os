# CareerOS 全栈迁移到阿里云 + 高德地图中文化

## Context（背景与目标）

CareerOS 当前部署在 Vercel（前端）+ Render（后端）+ Supabase（数据库/认证/存储）三套云服务上。用户希望全部迁移到**阿里云轻量应用服务器**（境外节点，免备案），完全脱离 Supabase，自建 PostgreSQL + 自签 JWT 认证 + 本地磁盘存储。同时把人生地图从英文 Carto/OSM 瓦片改成**高德中文瓦片**。

用户决策：
- 服务器：阿里云**香港/新加坡**轻量应用服务器（境外免备案）
- 操作方式：用户给阿里云控制台登录，**全程由我操作**
- 顺序：**先服务器后地图**
- 范围：全栈上阿里云，完全脱离 Supabase

## 架构决策

| 组件 | 方案 | 理由 |
|------|------|------|
| 数据库 | 自建 PostgreSQL 16 | 后端已支持 psycopg3，改 `DATABASE_URL` 即切 |
| 认证 | HS256 自签 JWT | 复用现有 `security.py` 的 HS256 分支 + `audience="authenticated"`，零侵入 |
| 存储 | 本地磁盘 `/var/media/careeros` | `storage.py` 已有 fallback，Nginx alias 直读 |
| 进程管理 | systemd | 不用 Docker，学生易调试、资源占用低 |
| 反向代理 | Nginx + Let's Encrypt SSL | 单域名同域代理前后端，无 CORS |
| 地图 | 高德矢量瓦片 + WGS-84→GCJ-02 转换 | 展示层转换，DB 存原始坐标不变 |

## 分阶段实施计划

### 阶段 0：服务器开通与环境搭建（0.5 天）

**用户配合**：在浏览器登录阿里云控制台，然后交给我操作。

**我执行**（通过 browser_use 操作控制台 + SSH）：
1. 开通香港/新加坡轻量应用服务器（Ubuntu 22.04 LTS，最低配置即可）
2. 安全组放行：22(SSH)、80(HTTP)、443(HTTPS)
3. 生成 SSH 密钥对，通过控制台添加公钥
4. SSH 连接后安装：Python 3.12、Node 20、PostgreSQL 16、Nginx、certbot、git、uv
5. 初始化 PostgreSQL：建库 `careeros` + 建用户 `careeros`
6. 创建部署目录：`/var/www/careeros`、`/var/media/careeros`、`/var/log/careeros`
7. clone 代码到 `/var/www/careeros`

**关键文件**：无代码改动，纯服务器配置

**验证**：`psql -U careeros -d careeros -h 127.0.0.1` 登入成功；`python3.12 --version`、`node --version`、`nginx -v` 正常

### 阶段 1：本地 PostgreSQL + 数据迁移（0.5 天）

**目标**：后端连阿里云自建 PG，迁移 Supabase 数据。此阶段不动认证、不动前端。

**我执行**：
1. 配置 `apps/api/.env`（部署机上）：
   ```
   APP_ENV=production
   DATABASE_URL=postgresql+psycopg://careeros:<密码>@127.0.0.1:5432/careeros
   CORS_ORIGINS=https://<域名或IP>
   SUPABASE_URL=          # 留空 → storage.py 自动走本地磁盘
   SUPABASE_SERVICE_ROLE_KEY=
   SUPABASE_JWT_SECRET=
   ```
2. 从 Supabase `pg_dump` 导出业务表（排除 auth/storage schema）
3. 导入到本地 PG
4. 单独导出 Supabase `auth.users` 的 id/email，写入本地 `profiles` 表（密码哈希留 NULL = 需重设）
5. 跑 `uv run alembic upgrade head` + `Base.metadata.create_all` 自愈

**关键文件**：无代码改动，只改 `.env`。`apps/api/app/core/database.py` 和 `config.py` 已支持。

**验证**：`curl localhost:8000/health` 返回 ok；`curl localhost:8000/ready` 显示 `postgres: ok`；`SELECT count(*) FROM profiles;` 数据正确

### 阶段 2：自建认证后端（1 天）

**目标**：新增 `/auth/login`、`/auth/register`、`/auth/refresh` 端点，HS256 自签 JWT。

**代码改动**：

1. `apps/api/pyproject.toml`：加 `passlib[bcrypt]` 依赖
2. `apps/api/app/db/models.py`：`Profile` 类加 `password_hash: Mapped[str | None]` 字段
3. `apps/api/migrations/versions/xxxx_add_password_hash.py`：新建 Alembic 迁移加列
4. `apps/api/app/core/config.py`：加配置项
   ```python
   jwt_secret: str = ""              # 自签 HS256 密钥
   jwt_algorithm: str = "HS256"
   access_token_ttl_minutes: int = 60
   refresh_token_ttl_days: int = 14
   ```
5. `apps/api/app/domains/auth/router.py`：新增四个端点
   - `POST /auth/register`：注册 + 签发 token
   - `POST /auth/login`：验证密码 + 签发 token
   - `POST /auth/refresh`：刷新 token
   - `POST /auth/reset-password`：老用户首次设密码（password_hash IS NULL）
   
   JWT payload 的 `aud` 必须是 `"authenticated"`（与 `security.py` 第 66/77 行一致），这样**无需改验签逻辑**
6. `apps/api/app/core/security.py` 第 75 行：密钥来源改为 `settings.jwt_secret or settings.supabase_jwt_secret`（优先用新密钥，迁移期兼容两种 token）

**关键文件**：
- `apps/api/app/core/security.py`
- `apps/api/app/domains/auth/router.py`
- `apps/api/app/db/models.py`
- `apps/api/app/core/config.py`

**验证**：`curl -X POST localhost:8000/api/v1/auth/register -d '{"email":"t@t.com","password":"abc123"}'` 返回 token；用 token 调 `/auth/me` 成功

### 阶段 3：前端认证改造（1 天）

**目标**：用自建 `lib/auth.ts` 替换 `lib/supabase.ts`，所有登录/注册走后端 API。

**代码改动**：

1. 新建 `apps/web/lib/auth.ts`：提供与 `lib/supabase.ts` 同名的导出
   - `getAccessToken()`：从 localStorage 读 token，过期则调 `/auth/refresh`
   - `writeSessionCookie` / `clearSessionCookie`：保留原逻辑
   - `signOut()`：清 localStorage + cookie（不再调 supabase.auth.signOut）
   - 新增 `login(email, password)`、`register(email, password)`：调后端 API
2. `apps/web/lib/api.ts`：import 从 `@/lib/supabase` 改为 `@/lib/auth`
3. 改造 auth 页面（4 个）：
   - `app/(auth)/login/page.tsx`：`supabase.auth.signInWithPassword` → `login(email, password)`
   - `app/(auth)/signup/page.tsx`：`supabase.auth.signUp` → `register(email, password)`
   - `app/(auth)/forgot-password/page.tsx`：调 `/auth/reset-password`
   - `app/(auth)/reset-password/page.tsx`：简化为设新密码表单
4. 替换三处 `supabase.auth.getUser()` 调用：
   - `components/user-menu.tsx`
   - `components/sidebar/sidebar-profile.tsx`
   - `components/dashboard/hero.tsx`
   
   改为调 `/api/v1/auth/me` 取 email（或加 `useEmail()` hook 共用）
5. `apps/web/next.config.ts`：移除硬编码的 Render URL，改为 `http://127.0.0.1:8000`
6. 删除 `@supabase/supabase-js` 依赖 + `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_*`

**关键文件**：
- `apps/web/lib/auth.ts`（新建）
- `apps/web/lib/supabase.ts`（删除）
- `apps/web/lib/api.ts`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/(auth)/signup/page.tsx`
- `apps/web/components/user-menu.tsx`、`sidebar-profile.tsx`、`dashboard/hero.tsx`

**注意**：`apps/web/middleware.ts` **不用改**——它只检查 cookie 存在性，与 Supabase 无关。

**验证**：本地 `npm run dev:web` + `npm run dev:api`，注册→登录→访问 /dashboard→退出 全流程通

### 阶段 4：服务器部署 + Nginx + SSL（1 天）

**我执行**（SSH 到服务器）：

1. 写两个 systemd unit：
   - `/etc/systemd/system/careeros-api.service`：`uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`
   - `/etc/systemd/system/careeros-web.service`：`node .next/standalone/apps/web/server.js`
2. 构建前端：`npm install && npm --workspace apps/web run build`
3. 配置 Nginx 反向代理（`/etc/nginx/sites-available/careeros.conf`）：
   - `/api/v1/` → `127.0.0.1:8000`（后端）
   - `/media/` → `alias /var/media/careeros/`（静态文件直读）
   - `/_next/static/` → `alias .next/static/`（前端静态资源）
   - `/` → `127.0.0.1:3000`（Next.js）
   - `client_max_body_size 25M`（上传用）
4. SSL（如果有域名）：`certbot --nginx -d <域名>`
5. 域名 DNS A 记录指向服务器公网 IP

**验证**：
- `https://<域名或IP>/login` 能打开
- `https://<域名或IP>/api/v1/health` 返回 ok
- 浏览器 DevTools 所有请求同域，无 CORS
- `systemctl status careeros-api careeros-web` 都 active

### 阶段 5：高德地图中文化（0.5 天）

**代码改动**：

1. `apps/web/components/life/map/life-map-view.tsx` 第 17-32 行：改 `TILES` 常量
   ```typescript
   const TILES = {
     dark: {
       url: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
       subdomains: ["1", "2", "3", "4"],
       attribution: '&copy; 高德地图',
       maxZoom: 18,
     },
     light: {
       url: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
       subdomains: ["1", "2", "3", "4"],
       attribution: '&copy; 高德地图',
       maxZoom: 18,
     },
   };
   ```
2. 新建 `apps/web/lib/geo-coord.ts`：实现 WGS-84 → GCJ-02 转换（标准 eviltransform 算法，约 30 行）
3. `life-map-view.tsx` 里 marker 坐标、points、routePoints 全部用 `wgs84ToGcj02(lng, lat)` 转换后再传给 Leaflet
4. **数据库存原始 WGS-84 不变**——只在展示层转换

**关键文件**：
- `apps/web/components/life/map/life-map-view.tsx`
- `apps/web/lib/geo-coord.ts`（新建）

**验证**：地图显示中文标注；marker 位置与卫星图一致（不偏移）

### 阶段 6：清理 Supabase（0.5 天）

1. 后端删除 Supabase 相关代码：`config.py` 的 supabase_* 字段、`security.py` 的 ES256 分支、`storage.py` 的 Supabase 逻辑
2. 前端删除 `lib/supabase.ts` + `@supabase/supabase-js` 依赖
3. Supabase 项目先 Pause（观察 1 个月再 Delete）
4. 配置 PG 自动备份：crontab 每日 `pg_dump`
5. `grep -ri supabase apps/` 确认无残留

**验证**：`npm run build` + `uv run pytest` 通过；grep 无 supabase 残留

## 风险与回滚

| 风险 | 缓解 | 回滚 |
|------|------|------|
| 境外轻量不在学生免费额度 | 开通时确认费用，香港最便宜约 24元/月 | 切回 Vercel+Render |
| 老用户密码无法迁移 | `/auth/reset-password` 端点；单人场景直接 psql UPDATE | 切回 Supabase Auth |
| 高德瓦片反爬 | 多 subdomain 轮询 | 切回 Carto/OSM |
| 单机故障 | 每日 pg_dump 备份 | 数据恢复到新机器 |
| 内存不足（2G 机器） | PG shared_buffers=256MB；uvicorn 单 worker | 加 swap 或升级配置 |

## 实施顺序与时间表

| 阶段 | 工时 | 风险 | 用户配合 |
|------|------|------|----------|
| 0 服务器开通+环境 | 0.5d | 低 | 给控制台登录 |
| 1 PG+数据迁移 | 0.5d | 低 | 无 |
| 2 自建认证后端 | 1d | 中 | 无 |
| 3 前端认证改造 | 1d | 中 | 无 |
| 4 部署+Nginx+SSL | 1d | 中 | 域名 DNS（如有） |
| 5 高德地图 | 0.5d | 低 | 无 |
| 6 清理 Supabase | 0.5d | 低 | 无 |

**总工时约 5 个工作日**。阶段 0-2 可在 Supabase 仍服务流量时做，阶段 3-4 是切换窗口，阶段 5-6 收尾。

## 验证清单（端到端）

完成全部阶段后验证：
1. 访问 `https://<域名或IP>/login` → 注册新账号 → 登录
2. 登录后自动跳 `/dashboard`，所有模块正常显示
3. 上传一张图片到人生记录 → 检查 `/var/media/careeros` 有文件
4. 打开 `/life/map` → 地图显示中文标注，marker 位置正确
5. 退出登录 → 跳回 `/login`
6. `curl https://<域名或IP>/api/v1/health` 返回 ok
7. `grep -ri supabase apps/` 无残留
8. `systemctl status careeros-api careeros-web` 都 active
