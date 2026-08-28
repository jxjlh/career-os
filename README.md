# Career OS

AI 驱动的职业成长操作系统（AI Career Growth Platform）。

核心理念：

```text
Learn -> Practice -> Build -> Interview -> Job -> Promotion -> Repeat
```

## 功能模块

- Dashboard：学习进度、技能成长、OKR、项目、成长趋势、学习日历、AI 建议
- 人生目标：总目标 / 已完成 / 未完成三栏看板、人生格言、中文足迹地图、轨迹时间轴、清单建议
- 人生记录：AI 相机拍照 / 录像、时间地点水印、同行好友水印、视频日志、记录时间轴
- 职业规划：现状描述 + AI 学习建议、技能矩阵、AI 学习计划 / 手动计划、成长分析、资源库
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

> 上传与存储：图片 / 视频默认上传到 Supabase Storage；本地开发或 Supabase 不可用时自动回落到
> 后端 `apps/api/media/` 目录，前端通过 `/media/*` 代理读取，上传不会中断。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Web | Next.js 15、React 19、TypeScript、TailwindCSS 4、TanStack Query、Framer Motion、ECharts、lucide-react |
| Mobile | 响应式 Web + PWA |
| Backend | FastAPI、SQLAlchemy 2、Pydantic v2、Alembic |
| Database / Auth / Storage | Supabase PostgreSQL、Supabase Auth、Supabase Storage |
| AI | 讯飞星火 Spark-X2-Flash（默认），OpenAI / Anthropic / Gemini 插件位 |
| Search | Tavily / Exa / Google / Bing / Wikipedia / GitHub / YouTube 插件 |
| Deploy | GitHub Actions → 腾讯云 VPS（Docker）+ Supabase |

## 项目结构

```text
apps/web        Next.js 前端
apps/api        FastAPI 后端
packages/       ui / auth / database / ai / search / shared / utils
docs/           产品 / 架构 / 数据库 / API / UI 设计
infra/          Supabase SQL、Docker
.github/workflows/ci.yml
.github/workflows/deploy-vps.yml  腾讯云 VPS 自动部署
docker-compose.yml
turbo.json      TurboRepo 任务编排
```

Monorepo 使用 TurboRepo + npm workspaces：

```bash
npm run dev        # 同时启动 web 与 api
npm run build      # 全工作区构建
npm run typecheck  # 全工作区类型检查
npm run test       # 全工作区测试
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

开发环境统一使用 `alembic upgrade head` 同步表结构；禁止使用 `create_all()` 做 schema 升级，生产环境只依赖 Alembic migration。

Supabase RLS / 触发器 / 存储桶 / 种子数据见 `infra/supabase/migrations/0001_init.sql`。

## 免费部署

详细的 Supabase / 腾讯云 / GitHub Actions 配置说明与逐步部署流程见 `docs/07-部署指南.md`。

免费版每日限额：AI 对话 30 条、搜索 20 次、AI 总结 20 次、Quiz 10 次、模拟面试 3 场、简历生成 3 次。

## 设计文档

- `docs/01-product-architecture.md`：产品架构、ER 图、API、页面流程、模块关系、目录结构
- `docs/02-产品与交互设计.md`：用户画像、旅程、信息架构、页面规格
- `docs/03-数据库设计.md`：全部表结构、索引、RLS、种子数据
- `docs/04-API设计.md`：REST / SSE / 异步任务 / 契约约定
- `docs/05-UI设计.md`：设计系统、组件、响应式、暗色模式、品牌资产
