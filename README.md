# Career OS

AI 驱动的职业成长操作系统（AI Career Growth Platform）。

核心理念：

```text
Learn -> Practice -> Build -> Interview -> Job -> Promotion -> Repeat
```

## 功能模块

- Dashboard：学习进度、技能成长、OKR、项目、成长趋势、学习日历、AI 建议
- Career Roadmap：3 / 5 / 10 年职业路线，AI 生成、修改、拖拽、完成
- Skill Matrix：技能树、当前 / 目标等级、AI 建议
- Learning Explorer：AI 学习搜索引擎，实时搜索 + AI 排序 + 总结 / Quiz / 思维导图
- Resource Library：收藏、标签、笔记、学习状态
- Weekly Planner：AI 生成本周计划与每日任务
- Projects：作品集管理，AI 生成 STAR / 项目介绍 / 简历描述
- Interview Center：文本 + 语音模拟面试，AI 五维评分
- Job Market：保存岗位、JD 解析、技能差距与学习路线
- Salary Planner：目标薪资拆解为技能、项目、岗位、时间线
- AI Career Coach：基于全量上下文回答下一步学什么、如何跳槽、如何涨薪
- Resume Builder：中英文简历自动生成、版本管理、异步导出
- Analytics：学习时间、技能增长、完成率、OKR

## 技术栈

| 层 | 技术 |
| --- | --- |
| Web | Next.js 15、React 19、TypeScript、TailwindCSS 4、TanStack Query、Framer Motion、ECharts、lucide-react |
| Mobile | 响应式 Web + PWA |
| Backend | FastAPI、SQLAlchemy 2、Pydantic v2、Alembic |
| Database / Auth / Storage | Supabase PostgreSQL、Supabase Auth、Supabase Storage |
| AI | 讯飞星火 Spark-X2-Flash（默认），OpenAI / Anthropic / Gemini 插件位 |
| Search | Tavily / Exa / Google / Bing / Wikipedia / GitHub / YouTube 插件 |
| Deploy | Vercel（Web）+ Render（API）+ Supabase（免费套餐） |

## 项目结构

```text
apps/web        Next.js 前端
apps/api        FastAPI 后端
docs/           产品 / 架构 / 数据库 / API / UI 设计
infra/          Supabase SQL、Docker
.github/workflows/ci.yml
render.yaml     Render 蓝图
docker-compose.yml
```

## 本地开发

### 1. 环境变量

复制 `.env.example` 到 `.env.local`（前端）与 `apps/api/.env`（后端），按需填写：

- 讯飞星火：`XFYUN_API_KEY`、`XFYUN_API_SECRET`、`XFYUN_APP_ID`、`SPARK_MODEL=Spark-X2-Flash`
- Supabase：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_JWT_SECRET`
- 搜索 Provider：Tavily / Exa / Google / Bing / GitHub / YouTube 的 API Key

密钥不会提交到 git。未配置 Supabase 时，前端使用开发模式账号（`Bearer dev`）。

`XFYUN_APP_ID` 是讯飞开放平台控制台中的 APPID，星火 WebSocket 鉴权需要它，与 APIKey / APISecret 一起配置。

### 2. 后端

```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

API 文档：http://localhost:8000/docs

### 3. 前端

```bash
npm install
npm run dev:web
```

打开 http://localhost:3000

### 4. 测试与构建

```bash
# 后端测试
cd apps/api && uv run pytest -q

# 前端类型检查与构建
cd apps/web && npm run typecheck && npm run build

# 后端静态检查
cd apps/api && uv run ruff check app tests
```

## 数据库迁移

```bash
cd apps/api
uv run alembic revision --autogenerate -m "change description"
uv run alembic upgrade head
```

Supabase RLS / 触发器 / 存储桶 / 种子数据见 `infra/supabase/migrations/0001_init.sql`。

## 免费部署

详细的 Supabase / Vercel / Render 账号说明与逐步配置见 `docs/07-部署指南.md`。

免费版每日限额：AI 对话 30 条、搜索 20 次、AI 总结 20 次、Quiz 10 次、模拟面试 3 场、简历生成 3 次。

## 设计文档

- `docs/01-product-architecture.md`：产品架构、ER 图、API、页面流程、模块关系、目录结构
- `docs/02-产品与交互设计.md`：用户画像、旅程、信息架构、页面规格
- `docs/03-数据库设计.md`：全部表结构、索引、RLS、种子数据
- `docs/04-API设计.md`：REST / SSE / 异步任务 / 契约约定
- `docs/05-UI设计.md`：设计系统、组件、响应式、暗色模式、品牌资产
