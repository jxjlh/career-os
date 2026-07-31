from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import (
    BackgroundJob,
    LearningHistory,
    Okr,
    PlanTask,
    Profile,
    Project,
    StudySession,
    UserSkill,
)

router = APIRouter(tags=["analytics"])


@router.get("/analytics/overview")
def analytics_overview(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    skills = db.query(UserSkill).filter(UserSkill.user_id == current_user.id).count()
    projects = db.query(Project).filter(Project.user_id == current_user.id).count()
    total_sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id, StudySession.duration_minutes.isnot(None))
        .all()
    )
    total_minutes = sum(s.duration_minutes or 0 for s in total_sessions)
    done = db.query(PlanTask).filter(PlanTask.user_id == current_user.id, PlanTask.status == "done").count()
    total_tasks = db.query(PlanTask).filter(PlanTask.user_id == current_user.id).count()
    completion = round(100 * done / total_tasks, 2) if total_tasks else 0
    return {
        "data": {
            "totalMinutes": total_minutes,
            "avgMinutesPerDay": round(total_minutes / max(len(total_sessions), 1), 1),
            "resourcesCompleted": done,
            "completionRate": completion,
            "skillGrowth": skills,
            "projectCount": projects,
        }
    }


@router.get("/analytics/time")
def analytics_time(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period: str = Query(default="30d", alias="range"),
) -> dict:
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    start = date.today() - timedelta(days=days)
    events = (
        db.query(LearningHistory)
        .filter(
            LearningHistory.user_id == current_user.id,
            LearningHistory.occurred_at >= start.isoformat(),
        )
        .all()
    )
    minutes = sum(e.duration_minutes or 0 for e in events)
    return {"data": {"range": period, "totalMinutes": minutes, "eventCount": len(events)}}


@router.get("/analytics/skills")
def analytics_skills(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    skills = db.query(UserSkill).filter(UserSkill.user_id == current_user.id).all()
    return {
        "data": {
            "items": [
                {
                    "skillId": s.skill_id,
                    "currentLevel": s.current_level,
                    "targetLevel": s.target_level,
                    "updatedAt": s.updated_at.isoformat() if s.updated_at else None,
                }
                for s in skills
            ]
        }
    }


@router.get("/analytics/completion")
def analytics_completion(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    tasks = db.query(PlanTask).filter(PlanTask.user_id == current_user.id).all()
    done = sum(1 for t in tasks if t.status == "done")
    skipped = sum(1 for t in tasks if t.status == "skipped")
    return {
        "data": {
            "total": len(tasks),
            "done": done,
            "skipped": skipped,
            "completionRate": round(100 * done / len(tasks), 2) if tasks else 0,
        }
    }


@router.get("/analytics/okr")
def analytics_okr(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    okrs = (
        db.query(Okr)
        .filter(Okr.user_id == current_user.id, Okr.status == "active")
        .all()
    )
    return {
        "data": [
            {"id": o.id, "title": o.title, "progress": o.progress, "status": o.status} for o in okrs
        ]
    }


@router.post("/analytics/export", status_code=202)
def export_analytics(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    job = BackgroundJob(user_id=current_user.id, job_type="export", payload={"kind": "analytics_csv"})
    db.add(job)
    db.commit()
    db.refresh(job)
    return {
        "data": {
            "jobId": job.id,
            "status": job.status,
            "pollUrl": f"/api/v1/downloads/{job.id}",
        }
    }
