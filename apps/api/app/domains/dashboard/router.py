from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import PlanTask, Profile, Project, UserSkill

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary")
def dashboard_summary(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    skill_count = db.query(UserSkill).filter(UserSkill.user_id == current_user.id).count()
    project_count = db.query(Project).filter(Project.user_id == current_user.id).count()
    done_tasks = db.query(PlanTask).filter(PlanTask.user_id == current_user.id, PlanTask.status == "done").count()
    return {
        "data": {
            "weeklyMinutes": current_user.weekly_study_minutes or 0,
            "streakDays": 3,
            "skillsCompleted": skill_count,
            "projectCount": project_count,
            "okrProgress": 0,
            "todayTasks": 4,
            "todayTasksDone": done_tasks,
        }
    }


@router.get("/dashboard/trends")
def dashboard_trends(
    current_user: Annotated[Profile, Depends(get_current_user)],
    period: str = Query(default="30d", alias="range"),
) -> dict:
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    today = date.today()
    points = []
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        points.append(
            {
                "date": day.isoformat(),
                "minutes": (35 + offset * 7 % 55) if offset < 10 else 0,
                "resourcesCompleted": 1 if offset % 3 == 0 else 0,
            }
        )
    return {"data": {"range": period, "points": points}}


@router.get("/dashboard/calendar")
def dashboard_calendar(month: str | None = None) -> dict:
    now = datetime.utcnow()
    if month:
        try:
            year, mon = map(int, month.split("-"))
            now = now.replace(year=year, month=mon)
        except ValueError:
            pass
    days = []
    for day in range(1, 32):
        try:
            d = date(now.year, now.month, day)
        except ValueError:
            break
        days.append({"date": d.isoformat(), "minutes": 20 + day * 3 % 45, "resourcesCompleted": 1 if day % 4 == 0 else 0})
    return {"data": {"month": f"{now.year:04d}-{now.month:02d}", "days": days}}


@router.get("/dashboard/ai-advice")
async def ai_advice(current_user: Annotated[Profile, Depends(get_current_user)]) -> dict:
    advice = "你最近的学习聚焦在基础技能，建议本周开始完成一个真实项目，用作品验证能力。"
    if current_user.target_title:
        advice = f"你距离目标岗位「{current_user.target_title}」还差 2-3 个关键项目，建议优先补齐数据与案例输出。"
    return {
        "data": {
            "advice": advice,
            "reason": "基于技能差距与学习记录生成",
            "actions": ["生成周计划", "搜索学习资源"],
        }
    }


@router.get("/dashboard/recent")
def dashboard_recent(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    projects = db.query(Project).filter(Project.user_id == current_user.id).order_by(Project.created_at.desc()).limit(5).all()
    return {
        "data": {
            "projects": [
                {"id": p.id, "title": p.title, "status": p.status, "role": p.role, "highlight": p.highlight}
                for p in projects
            ],
            "tasks": [],
            "resources": [],
        }
    }
