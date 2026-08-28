from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import SessionLocal, engine, ensure_columns, migrate_journal_constraints
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.core.logging import setup_logging
from app.core.middleware import RateLimitMiddleware, RequestContextMiddleware
from app.db.base import Base
from app.domains.ai.router import router as ai_router
from app.domains.analytics.router import router as analytics_router
from app.domains.auth.router import router as auth_router
from app.domains.bucket.router import router as bucket_router
from app.domains.bucket.seed import seed_bucket_data
from app.domains.english.router import router as english_router
from app.domains.english.seed import seed_word_books
from app.domains.career.router import router as career_router
from app.domains.dashboard.router import router as dashboard_router
from app.domains.explorer.router import router as explorer_router
from app.domains.finance.router import router as finance_router
from app.domains.goals.router import router as goals_router
from app.domains.health.router import router as health_router
from app.domains.interviews.router import router as interviews_router
from app.domains.jobs.router import router as jobs_router
from app.domains.journal.router import router as journal_router
from app.domains.library.router import router as library_router
from app.domains.reading.router import router as reading_router
from app.domains.life.router import router as life_router
from app.domains.notifications.router import router as notifications_router
from app.domains.planner.router import router as planner_router
from app.domains.profile.router import router as profile_router
from app.domains.projects.router import router as projects_router
from app.domains.resume.router import router as resume_router
from app.domains.roadmap.router import router as roadmap_router
from app.domains.salary.router import router as salary_router
from app.domains.skills.router import router as skills_router
from app.domains.social.router import router as social_router

from app.domains.chat.router import router as chat_router

settings = get_settings()
logger = logging.getLogger("app.main")
_lifespan_initialized = False


def _ensure_all_storage_buckets_public() -> None:
    """启动时将所有存储桶修补为公开，确保图片可通过公共 URL 访问."""
    try:
        from app.services.storage import StorageService
        svc = StorageService()
        for bucket in ("avatars", "chat-images", "journal-images"):
            try:
                svc._ensure_bucket(bucket)
                logger.info("storage bucket '%s' ensured public", bucket)
            except Exception as e:
                logger.warning("failed to ensure bucket '%s' public: %s", bucket, e)
    except Exception as e:
        logger.warning("storage bucket public check skipped: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _lifespan_initialized

    setup_logging()
    if not _lifespan_initialized:
        if settings.app_env in ("dev", "test"):
            ensure_columns()
            migrate_journal_constraints()
            Base.metadata.create_all(bind=engine)
            # 幂等写入 Bucket List 和英语种子数据。
            with SessionLocal() as db:
                seed_bucket_data(db)
                seed_word_books(db)
        else:
            # 生产自愈：补建缺失的表 + 补已存在表缺失的列。
            # 根因：Alembic 从未在生产跑过（alembic_version 表不存在），早期表由更早版本
            # 的 create_all 建好，但后续 ORM 新增的表（life_goals、user_profiles 等）从未
            # 被创建 → /life/* 与 /profile 查询报 "relation does not exist" → 500。
            # create_all 仅 CREATE IF NOT EXISTS（不改已有表/列），ensure_columns 再幂等补
            # 已有表缺失的列。两者都对已存在对象 no-op，安全重复执行。
            try:
                Base.metadata.create_all(bind=engine)
                ensure_columns()
                migrate_journal_constraints()
                # 幂等写入英语种子词库
                with SessionLocal() as db:
                    seed_word_books(db)
            except Exception as e:  # noqa: BLE001
                logger.error("production schema self-heal failed: %s", e, exc_info=True)

        _ensure_all_storage_buckets_public()
        _lifespan_initialized = True
    yield


app = FastAPI(
    title="Career OS API",
    description="AI Career Growth Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# 本地媒体回退目录: 未配置 Supabase 或上传失败时, 图片/视频落盘于此.
media_dir = Path(settings.media_dir)
if not media_dir.is_absolute():
    media_dir = Path(__file__).resolve().parent.parent / media_dir
media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=media_dir), name="media")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)
# 测试环境关闭限流: 单测共享同一 app 实例且来自同一 TestClient host,
# 全局限流状态会跨用例累积导致后续用例误触发 429; 生产环境按 IP 滑动窗口限流.
if settings.app_env != "test":
    app.add_middleware(RateLimitMiddleware, requests_per_minute=120)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(health_router)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(dashboard_router, prefix=settings.api_prefix)
app.include_router(skills_router, prefix=settings.api_prefix)
app.include_router(explorer_router, prefix=settings.api_prefix)
app.include_router(finance_router, prefix=settings.api_prefix)
app.include_router(goals_router, prefix=settings.api_prefix)
app.include_router(planner_router, prefix=settings.api_prefix)
app.include_router(career_router, prefix=settings.api_prefix)
app.include_router(profile_router, prefix=settings.api_prefix)
app.include_router(library_router, prefix=settings.api_prefix)
app.include_router(reading_router, prefix=settings.api_prefix)
app.include_router(life_router, prefix=settings.api_prefix)
app.include_router(bucket_router, prefix=settings.api_prefix)
app.include_router(notifications_router, prefix=settings.api_prefix)
app.include_router(roadmap_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(ai_router, prefix=settings.api_prefix)
app.include_router(projects_router, prefix=settings.api_prefix)
app.include_router(jobs_router, prefix=settings.api_prefix)
app.include_router(journal_router, prefix=settings.api_prefix)
app.include_router(resume_router, prefix=settings.api_prefix)
app.include_router(interviews_router, prefix=settings.api_prefix)
app.include_router(salary_router, prefix=settings.api_prefix)
app.include_router(social_router, prefix=settings.api_prefix)

app.include_router(english_router, prefix=settings.api_prefix)

app.include_router(chat_router, prefix=settings.api_prefix)

# ---------- 前端静态文件托管 ----------
# 将 Next.js 构建产物 (apps/web/out) 作为静态资源提供服务，
# 使腾讯云 VPS 上的后端同时托管前端 SPA，省去独立的前端托管服务。
# 关键：API 路由 (已通过 include_router 注册) 优先匹配，
# 未命中的请求回退到 index.html，支持 SPA 客户端路由。
frontend_dir = Path(__file__).resolve().parent.parent / "static"
if frontend_dir.exists():
    # 挂载静态资源（/_next, /icons, /manifest.webmanifest 等带文件扩展名的请求）
    app.mount(
        "/_next",
        StaticFiles(directory=frontend_dir / "_next"),
        name="frontend-next",
    )
    # Catch-all: 所有非 API、非静态资源、非文件路径的请求 → index.html
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(request: Request, full_path: str):
        # API 请求永远不走这里（已被 router 匹配）
        # 静态资源（/_next/*）也不走这里（已被 StaticFiles mount 匹配）
        # 带文件扩展名的请求（如 .js, .css, .png）尝试直接返回文件
        api_prefix = settings.api_prefix.strip("/")
        if full_path == api_prefix or full_path.startswith(f"{api_prefix}/"):
            raise HTTPException(status_code=404, detail="API route not found")
        candidate = frontend_dir / full_path
        if candidate.is_file():
            # Next.js 的 RSC payload 文件 (index.txt) 不应作为页面返回给导航请求，
            # 否则浏览器会把 RSC 数据当纯文本显示（"显示源代码"问题）。
            # RSC 数据请求带 "RSC" / "rsc" / Next-Router-State-Tree 请求头，正常返回文件；
            # 普通导航请求（无 RSC 头）重定向到对应路由，让浏览器加载 index.html 正常渲染。
            if full_path.endswith("/index.txt") and not full_path.startswith("_next"):
                has_rsc_header = (
                    bool(request.headers.get("rsc"))
                    or bool(request.headers.get("RSC"))
                    or bool(request.headers.get("next-router-state-tree"))
                    or bool(request.headers.get("Next-Router-State-Tree"))
                )
                if not has_rsc_header:
                    # 相对路径 307 重定向（不依赖 FRONTEND_URL，避免 http/https 混用）
                    route_path = "/" + full_path[: -len("/index.txt")] + "/"
                    if request.url.query:
                        route_path = f"{route_path}?{request.url.query}"
                    return RedirectResponse(route_path, status_code=307)
            return FileResponse(candidate)
        route_index = candidate / "index.html"
        if route_index.is_file():
            return FileResponse(route_index)
        # 其他所有路径 → index.html（SPA fallback）
        index_file = frontend_dir / "index.html"
        return FileResponse(index_file)

# 注：当 static/ 目录不存在时（如本地开发未构建前端），
# 上述 catch-all 路由不会注册，所有请求仍走 API 路由。
