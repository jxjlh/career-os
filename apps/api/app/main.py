from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import SessionLocal, engine, ensure_columns
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.core.logging import setup_logging
from app.core.middleware import RateLimitMiddleware, RequestContextMiddleware
from app.db.base import Base
from app.domains.ai.router import router as ai_router
from app.domains.analytics.router import router as analytics_router
from app.domains.auth.router import router as auth_router
from app.domains.bucket.router import router as bucket_router
from app.domains.bucket.seed import seed_bucket_data
from app.domains.career.router import router as career_router
from app.domains.coach.life_router import router as life_coach_router
from app.domains.coach.router import router as coach_router
from app.domains.dashboard.router import router as dashboard_router
from app.domains.explorer.router import router as explorer_router
from app.domains.goals.router import router as goals_router
from app.domains.health.router import router as health_router
from app.domains.interviews.router import router as interviews_router
from app.domains.jobs.router import router as jobs_router
from app.domains.library.router import router as library_router
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

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    # dev 与 test 环境自动建表, 便于本地启动与单测隔离; 生产仅依赖 Alembic migration
    if settings.app_env in ("dev", "test"):
        ensure_columns()
        Base.metadata.create_all(bind=engine)
        # 幂等写入 Bucket List 种子目录, 保证页面有可消费内容
        with SessionLocal() as db:
            seed_bucket_data(db)
    yield


app = FastAPI(
    title="Career OS API",
    description="AI Career Growth Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# 本地媒体回退目录: 未配置 Supabase 或上传失败时, 图片/视频落盘于此.
media_dir = Path(settings.media_dir)
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
app.include_router(goals_router, prefix=settings.api_prefix)
app.include_router(planner_router, prefix=settings.api_prefix)
app.include_router(career_router, prefix=settings.api_prefix)
app.include_router(profile_router, prefix=settings.api_prefix)
app.include_router(library_router, prefix=settings.api_prefix)
app.include_router(life_router, prefix=settings.api_prefix)
app.include_router(bucket_router, prefix=settings.api_prefix)
app.include_router(notifications_router, prefix=settings.api_prefix)
app.include_router(roadmap_router, prefix=settings.api_prefix)
app.include_router(coach_router, prefix=settings.api_prefix)
app.include_router(life_coach_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(ai_router, prefix=settings.api_prefix)
app.include_router(projects_router, prefix=settings.api_prefix)
app.include_router(jobs_router, prefix=settings.api_prefix)
app.include_router(resume_router, prefix=settings.api_prefix)
app.include_router(interviews_router, prefix=settings.api_prefix)
app.include_router(salary_router, prefix=settings.api_prefix)
app.include_router(social_router, prefix=settings.api_prefix)
