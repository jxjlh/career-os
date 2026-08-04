# CareerOS → Cloudflare 全家桶迁移计划

## Context

**为什么迁移**：当前部署在 Vercel + Render + Supabase，国内访问慢且不稳定（Vercel 常被墙、Render 会休眠）。阿里云轻量服务器因新账号风控无法购买。用户选择 Cloudflare 全家桶（国内 CDN 节点、永久免费额度）。

**目标架构**：
- 前端 → Cloudflare Pages（Next.js 静态导出）
- 后端 → Cloudflare Pages Functions（Hono + TypeScript）
- 数据库 → Cloudflare D1（SQLite，Drizzle ORM）
- 文件存储 → Cloudflare R2
- Auth → 保留 Supabase Auth（1945 用户无需迁移，前端 SDK 直调兼容静态导出）

**关键决策**：
1. **Auth 保留 Supabase**：用户密码不可逆，迁移需强制重置；`lib/supabase.ts` 已是纯客户端调用，兼容静态导出
2. **ORM 选 Drizzle**：D1 一等公民，Edge runtime 友好，类型推断好
3. **AI Provider 弃讯飞星火**：WebSocket 长连接 Pages Functions 不支持，改用 OpenAI/Workers AI

**工作量**：12-15 个工作日，建议分 MVP + 完整版两批上线。

---

## 分阶段实施

### Phase 1：前端迁 Cloudflare Pages（2 天，立即国内可达）

**目标**：前端切静态导出，后端暂留 Render，先让国内用户能访问页面。

**改动文件**：

1. **`apps/web/next.config.ts`** — 改成静态导出
   ```typescript
   const nextConfig: NextConfig = {
     output: "export",
     images: { unoptimized: true },
     eslint: { ignoreDuringBuilds: true },
     // 删除 rewrites、standalone、outputFileTracingRoot
   };
   ```

2. **删除 `apps/web/middleware.ts`** — Edge middleware 在 export 下不工作

3. **新增 `apps/web/components/auth-guard.tsx`** — 客户端路由守卫，平移 middleware 逻辑
   - 检查 `localStorage.getItem("career_os_token")`
   - 未登录访问受保护路由 → `router.replace("/login?next=...")`
   - 在 `apps/web/app/(app)/layout.tsx` 和 `apps/web/app/(auth)/layout.tsx` 包一层

4. **`apps/web/app/page.tsx`** — 改客户端跳转
   ```typescript
   "use client";
   export default function Home() {
     const router = useRouter();
     useEffect(() => { router.replace("/dashboard"); }, [router]);
     return null;
   }
   ```

5. **`apps/web/lib/api.ts`** — API base 改成 Render 绝对 URL
   ```typescript
   export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ai-life-os-api-4y3x.onrender.com/api/v1";
   ```

6. **`apps/web/lib/life.ts`** L390-406 — 媒体 URL 改成 Render 绝对路径

7. **删除** `apps/web/vercel.json`、`apps/web/Dockerfile`

**部署**：
- Cloudflare Pages 项目 `careeros-web`
- Build command: `npm --workspace apps/web run build`
- Build output: `apps/web/out`
- 环境变量: `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_API_BASE_URL`

**验证**：
- `careeros.pages.dev` 能打开登录页
- 注册/登录流程正常（Supabase Auth 直连）
- Dashboard 页面渲染（API 调用 Render，可能有延迟但能跑通）

---

### Phase 2：后端迁 Pages Functions（5-7 天，最大工作量）

**目标**：把 FastAPI 25 个 domain 翻译成 Hono，跑在 Cloudflare Pages Functions。

**新目录结构**：
```
apps/functions/
├── [[route]].ts              # Pages Functions 入口
├── src/
│   ├── app.ts                # Hono app + 全局中间件
│   ├── middleware/auth.ts    # Supabase JWT 验证（jose 库）
│   ├── db/
│   │   ├── schema/           # Drizzle schema（69 表）
│   │   └── client.ts         # drizzle(env.DB)
│   ├── domains/              # 25 个 domain 对应 25 个目录
│   │   ├── auth/router.ts
│   │   ├── life/router.ts
│   │   ├── ai/router.ts
│   │   └── ...
│   └── providers/ai/          # openai/anthropic/gemini/workers-ai
└── wrangler.toml
```

**翻译模板**（FastAPI → Hono）：
```python
# 原 FastAPI
@router.get("/life/goals")
def list_goals(current_user, db):
    return {"data": LifeGoalService(db).list(current_user.id)}
```
```typescript
// 翻译后 Hono
lifeGoalsRouter.get("/", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const goals = await LifeGoalService(db).list(user.id);
  return c.json({ data: goals });
});
```

**25 个 domain 工作量**（按 router.py 行数）：
- ai（227 行 + 12 个 service）：1.5 天 ← 最大头，含讯飞星火替换
- life（386 行）：1 天 ← 含 multipart 文件上传
- interviews（441 行）：0.5 天
- resume（235 行）：0.5 天 ← BackgroundTasks 改 Queue
- explorer（220 行）：0.5 天 ← BackgroundTasks 改 Queue
- projects（337 行）：0.5 天 ← 含文件上传
- social（204 行）：0.5 天
- coach（199 行）：0.5 天
- 其余 17 个 domain：合计 2.5 天

**关键翻译陷阱**：
1. SQLAlchemy `.contains()` → Drizzle `.like()`
2. `session.flush()` 拿 ID → `db.insert().values().returning()`
3. `BackgroundTasks.add_task` → `env.BACKGROUND_JOBS.send()`
4. `httpx.AsyncClient` → 原生 `fetch`
5. 讯飞星火 WebSocket → 移除，改 OpenAI/Workers AI
6. `UploadFile`/`Form` → `c.req.parseBody()` + R2 `put()`

---

### Phase 3：数据库迁 D1（2-3 天）

**目标**：PostgreSQL 69 表 → D1 Drizzle schema + 数据迁移。

**源文件**：`apps/api/app/db/models.py`（1097 行，69 表）

**翻译规则**：
| SQLAlchemy | Drizzle D1 |
|---|---|
| `String(36)` PK + `default=uuid_str` | `text("id").primaryKey().default(randomUUID())` |
| `DateTime(timezone=True)` | `integer("col", { mode: "timestamp" })` |
| `JSON` | `text("col", { mode: "json" })` |
| `Boolean` | `integer("col", { mode: "boolean" })` |
| `ForeignKey(ondelete="CASCADE")` | `references(() => tbl.id, { onDelete: "cascade" })` |

**数据迁移**：
- 1945 profiles + 111 life_goals + 50 life_records + 8 social_posts（量小，几分钟搞定）
- `pg_dump --data-only` → 转换脚本 → `wrangler d1 execute --file=d1_seed.sql`

**媒体文件迁移**：
- `apps/api/media/` → R2 bucket `life-records`
- 写 `scripts/migrate_media_to_r2.ts` 批量上传

---

### Phase 4：部署配置（1 天）

**wrangler.toml**：
```toml
name = "careeros"
compatibility_date = "2026-08-01"
pages_build_output_dir = "apps/web/out"

[[d1_databases]]
binding = "DB"
database_name = "careeros-db"
database_id = "<id>"

[[r2_buckets]]
binding = "LIFE_RECORDS_BUCKET"
bucket_name = "life-records"

[[queues.producers]]
binding = "BACKGROUND_JOBS"
queue = "background-jobs"
```

**部署命令**：
```bash
npm --workspace apps/web run build          # 产出 apps/web/out
npx wrangler pages deploy apps/web/out \
  --functions apps/functions
```

**环境变量**（Cloudflare 控制台）：
- 公开：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 加密：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`OPENAI_API_KEY`

---

### Phase 5：清理旧代码（0.5 天）

**删除**：
- `apps/api/`（整个 Python 后端，保留 git 历史）
- `apps/web/middleware.ts`、`apps/web/Dockerfile`、`apps/web/vercel.json`
- 根目录 `Dockerfile`、`docker-compose.yml`、`render.yaml`
- `apps/api/migrations/`（Alembic）、`apps/api/alembic.ini`
- 空壳包：`packages/auth`、`packages/database`、`packages/ai`、`packages/search`

---

## 实施优先级建议

**第 1 周（MVP 上线）**：Phase 1 + 部分 Phase 2/3
- 前端 Cloudflare Pages（国内立即可达）
- 核心后端：auth、dashboard、life、goals、records
- D1 schema + 核心表数据迁移
- 部署到 `*.pages.dev` 预览域名

**第 2-3 周（完整版）**：剩余 Phase 2/3/4/5
- ai、social、coach、interviews 等剩余 domain
- R2 媒体迁移 + Queue 背景任务
- 域名切换 + 旧 Render 下线

---

## 验证清单

- [ ] `careeros.pages.dev` 能打开登录页（国内访问 <1s）
- [ ] 注册/登录/登出流程（Supabase Auth）
- [ ] 受保护路由访问（AuthGuard 客户端守卫）
- [ ] Dashboard 页面渲染 + API 数据加载
- [ ] Life Goals CRUD
- [ ] Life Records 创建 + 图片上传（R2）
- [ ] AI 对话（OpenAI provider）
- [ ] 媒体回显（R2 CDN URL）
- [ ] 旧 Vercel/Render 域名下线

---

## 关键风险

1. **ai/service.py（57KB）翻译工作量**：建议先翻译 router + 简单 service，复杂 AI 流程（year_review、travel_plan）放后期
2. **讯飞星火移除**：迁移前先在 OpenAI 上跑通所有 prompt
3. **D1 写入并发限制**（1000 写/秒）：1945 用户量级无压力
4. **Pages Functions 单请求 CPU 30s**：搜索 job 必须走 Queue
