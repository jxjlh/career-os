from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import engine
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.core.logging import setup_logging
from app.core.middleware import RateLimitMiddleware, RequestContextMiddleware
from app.db.base import Base
from app.domains.analytics.router import router as analytics_router
from app.domains.auth.router import router as auth_router
from app.domains.coach.router import router as coach_router
from app.domains.dashboard.router import router as dashboard_router
from app.domains.explorer.router import router as explorer_router
from app.domains.health.router import router as health_router
from app.domains.interviews.router import router as interviews_router
from app.domains.jobs.router import router as jobs_router
from app.domains.library.router import router as library_router
from app.domains.notifications.router import router as notifications_router
from app.domains.planner.router import router as planner_router
from app.domains.projects.router import router as projects_router
from app.domains.resume.router import router as resume_router
from app.domains.roadmap.router import router as roadmap_router
from app.domains.salary.router import router as salary_router
from app.domains.skills.router import router as skills_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    if settings.app_env == "dev":
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Career OS API",
    description="AI Career Growth Platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=120)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(health_router)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(dashboard_router, prefix=settings.api_prefix)
app.include_router(skills_router, prefix=settings.api_prefix)
app.include_router(explorer_router, prefix=settings.api_prefix)
app.include_router(planner_router, prefix=settings.api_prefix)
app.include_router(library_router, prefix=settings.api_prefix)
app.include_router(notifications_router, prefix=settings.api_prefix)
app.include_router(roadmap_router, prefix=settings.api_prefix)
app.include_router(coach_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(projects_router, prefix=settings.api_prefix)
app.include_router(jobs_router, prefix=settings.api_prefix)
app.include_router(resume_router, prefix=settings.api_prefix)
app.include_router(interviews_router, prefix=settings.api_prefix)
app.include_router(salary_router, prefix=settings.api_prefix)
