from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.timeutil import today, week_start
from app.db.models import (
    BackgroundJob,
    DailyReview,
    EnglishStudySession,
    LearningHistory,
    Okr,
    PlanTask,
    Profile,
    Project,
    StudySession,
    UserSkill,
    WeeklyPlan,
)
from app.domains.skills.service import build_evidence_map, compute_effective_mastery

router = APIRouter(tags=["analytics"])

# 掌握度换算基准，与技能矩阵保持一致
MINUTES_PER_LEVEL = 300


def _task_minutes_by_week(db: Session, user_id: str, start: date) -> dict[date, dict]:
    """按周聚合「已完成学习任务」的分钟数（真实数据，来自周计划任务）。"""
    rows = (
        db.query(
            WeeklyPlan.week_start,
            func.count(PlanTask.id),
            func.sum(PlanTask.estimated_minutes),
        )
        .join(PlanTask, PlanTask.plan_id == WeeklyPlan.id)
        .filter(
            WeeklyPlan.user_id == user_id,
            WeeklyPlan.week_start >= start,
            PlanTask.status == "done",
        )
        .group_by(WeeklyPlan.week_start)
        .all()
    )
    return {
        week_start: {"doneTasks": count or 0, "minutes": int(minutes or 0)}
        for week_start, count, minutes in rows
    }


def _english_minutes_by_week(db: Session, user_id: str, start: date) -> dict[date, int]:
    rows = (
        db.query(EnglishStudySession.session_date, func.sum(EnglishStudySession.duration_minutes))
        .filter(
            EnglishStudySession.user_id == user_id,
            EnglishStudySession.session_date >= start,
        )
        .group_by(EnglishStudySession.session_date)
        .all()
    )
    by_week: dict[date, int] = {}
    for session_date, minutes in rows:
        if session_date is None:
            continue
        week_start = session_date - timedelta(days=session_date.weekday())
        by_week[week_start] = by_week.get(week_start, 0) + int(minutes or 0)
    return by_week


@router.get("/analytics/weekly")
def analytics_weekly(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    weeks: int = Query(default=8, ge=1, le=52),
) -> dict:
    """近 N 周真实学习投入（周计划完成任务 + 英语学习分钟）。无数据即返回 0，不编造。"""
    this_week = week_start()
    start = this_week - timedelta(weeks=weeks - 1)
    task_stats = _task_minutes_by_week(db, current_user.id, start)
    english_by_week = _english_minutes_by_week(db, current_user.id, start)

    items = []
    for index in range(weeks):
        ws = start + timedelta(weeks=index)
        task_info = task_stats.get(ws, {"doneTasks": 0, "minutes": 0})
        english_minutes = english_by_week.get(ws, 0)
        items.append(
            {
                "weekStart": ws.isoformat(),
                "label": ws.strftime("%m/%d"),
                "isCurrent": ws == this_week,
                "minutes": task_info["minutes"] + english_minutes,
                "taskMinutes": task_info["minutes"],
                "englishMinutes": english_minutes,
                "doneTasks": task_info["doneTasks"],
            }
        )
    return {"data": {"weeks": weeks, "items": items}}


@router.get("/analytics/overview")
def analytics_overview(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """总览。所有数字都来自真实记录，没有记录就是 0。"""
    done_tasks = (
        db.query(PlanTask)
        .filter(PlanTask.user_id == current_user.id, PlanTask.status == "done")
        .all()
    )
    task_minutes = sum(t.estimated_minutes or 0 for t in done_tasks)
    study_minutes = (
        db.query(func.sum(StudySession.duration_minutes))
        .filter(StudySession.user_id == current_user.id)
        .scalar()
        or 0
    )
    english_minutes = (
        db.query(func.sum(EnglishStudySession.duration_minutes))
        .filter(EnglishStudySession.user_id == current_user.id)
        .scalar()
        or 0
    )
    total_minutes = task_minutes + int(study_minutes) + int(english_minutes)

    # 有学习痕迹的天数（完成任务当天 / 英语学习当天 / 写过每日总结当天）
    active_days = {
        (t.completed_at.date() if isinstance(t.completed_at, datetime) else t.completed_at)
        for t in done_tasks
        if t.completed_at is not None
    }
    english_days = {
        row[0]
        for row in db.query(EnglishStudySession.session_date)
        .filter(EnglishStudySession.user_id == current_user.id)
        .distinct()
        .all()
        if row[0] is not None
    }
    review_days = {
        row[0]
        for row in db.query(DailyReview.review_date)
        .filter(DailyReview.user_id == current_user.id)
        .distinct()
        .all()
        if row[0] is not None
    }
    active_days |= english_days | review_days

    total_tasks = db.query(PlanTask).filter(PlanTask.user_id == current_user.id).count()
    projects = db.query(Project).filter(Project.user_id == current_user.id).count()

    # 技能平均掌握度：有学习证据用真实数据，无记录但"已掌握"用自评，与技能矩阵一致
    user_skills = db.query(UserSkill).filter(UserSkill.user_id == current_user.id).all()
    evidence_map = build_evidence_map(db, current_user.id)
    mastery_values = [
        compute_effective_mastery(
            evidence_map.get(s.skill_id, {}),
            s.target_level or 10,
            s.current_level or 0,
            s.learning_status or "learning",
        )[0]
        for s in user_skills
    ]
    avg_mastery = round(sum(mastery_values) / len(mastery_values), 1) if mastery_values else 0

    return {
        "data": {
            "totalMinutes": int(total_minutes),
            "taskMinutes": int(task_minutes),
            "englishMinutes": int(english_minutes),
            "avgMinutesPerDay": round(total_minutes / len(active_days), 1) if active_days else 0,
            "activeDays": len(active_days),
            "resourcesCompleted": len(done_tasks),
            "completionRate": round(100 * len(done_tasks) / total_tasks, 2) if total_tasks else 0,
            "skillGrowth": len(user_skills),
            "avgMasteryPercent": avg_mastery,
            "projectCount": projects,
            "reviewDays": len(review_days),
        }
    }


@router.get("/analytics/time")
def analytics_time(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period: str = Query(default="30d", alias="range"),
) -> dict:
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    start = today() - timedelta(days=days)
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
