# Changelog

## v0.1.0-sprint1 - 2026-07-31

### Added
- TurboRepo monorepo：apps/web、apps/api、packages（ui/auth/database/ai/search/shared/utils）
- Next.js：TypeScript、App Router、Tailwind、shadcn 风格组件、Dark Mode、响应式 PWA
- Web 全局框架：Sidebar、Topbar、Breadcrumb、Command Palette、Notification、Loading、Error Boundary、404、500
- FastAPI：Router / Service / Repository 分层、Alembic、Health Check、OpenAPI、Swagger
- 数据库：profiles、roles、permissions、user_roles、role_permissions、settings 及全业务表
- Supabase：RLS、Auth 触发器、Storage 桶、种子数据、完整初始化 SQL
- AI Provider：讯飞星火默认，OpenAI / Anthropic / Gemini / Mock 插件
- Search Provider：Tavily / Exa / Google / Bing / Wikipedia / GitHub / YouTube
- DevOps：Docker、docker-compose、render.yaml、GitHub Actions CI/CD
- 架构加固：请求日志、Request ID、安全响应头、限流、Provider 并发搜索
- 文档：产品架构、交互、数据库、API、UI、部署指南、Sprint 1 报告、架构审查

### Changed
- Monorepo 由 npm workspaces 升级为 TurboRepo 任务编排
- 前端 API 客户端统一 `/api/v1` 前缀与 Supabase Token 注入
- JWT 校验支持 Supabase JWKS（ES256）与 HS256 双模式
- 搜索任务并发执行多个 Provider

### Fixed
- Dashboard 趋势接口 `range` 参数覆盖内置函数问题
- SQL 初始化顺序：先建表后 RLS

### Security
- 密钥仅存环境变量，`.env` 已 gitignore
- 增加 X-Content-Type-Options / X-Frame-Options / Referrer-Policy 响应头
- 增加基于 IP 的请求限流
