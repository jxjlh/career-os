from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import PlanTask, Profile, Skill, UserSkill, WeeklyPlan

router = APIRouter(tags=["planner"])


class GeneratePlanRequest(BaseModel):
    weekStart: date | None = None
    weeklyStudyMinutes: int = 420
    prioritySkills: list[str] = []


def _week_start(day: date | None = None) -> date:
    target = day or date.today()
    return target - timedelta(days=target.weekday())


def _plan_dict(db: Session, plan: WeeklyPlan) -> dict:
    tasks = (
        db.query(PlanTask)
        .filter(PlanTask.plan_id == plan.id)
        .order_by(PlanTask.day, PlanTask.sort_order)
        .all()
    )
    return {
        "id": plan.id,
        "weekStart": plan.week_start.isoformat(),
        "title": plan.title,
        "status": plan.status,
        "aiGenerated": plan.ai_generated,
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "day": t.day,
                "estimatedMinutes": t.estimated_minutes,
                "resourceId": t.resource_id,
                "status": t.status,
                "sortOrder": t.sort_order,
                "notes": t.notes,
            }
            for t in tasks
        ],
    }


@router.get("/planner/current")
def current_plan(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    start = _week_start()
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id, WeeklyPlan.week_start == start)
        .order_by(WeeklyPlan.created_at.desc())
        .first()
    )
    if plan is None:
        plan = WeeklyPlan(user_id=current_user.id, week_start=start, title="本周计划", status="draft")
        db.add(plan)
        db.commit()
        db.refresh(plan)
    return {"data": _plan_dict(db, plan)}


@router.post("/planner/generate")
def generate_plan(
    payload: GeneratePlanRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    start = payload.weekStart or _week_start()
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id, WeeklyPlan.week_start == start)
        .first()
    )
    if plan is None:
        plan = WeeklyPlan(user_id=current_user.id, week_start=start, title="AI 本周计划")
        db.add(plan)
        db.flush()

    focus = payload.prioritySkills or [
        skill.name
        for skill in db.query(Skill)
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .filter(UserSkill.user_id == current_user.id)
        .all()
    ]
    topics = focus[:3] or ["职业规划"]
    db.query(PlanTask).filter(PlanTask.plan_id == plan.id).delete()
    for day in range(1, 8):
        topic = topics[(day - 1) % len(topics)]
        db.add(
            PlanTask(
                plan_id=plan.id,
                user_id=current_user.id,
                title=f"学习 {topic} 基础与实战",
                day=day,
                estimated_minutes=max(30, payload.weeklyStudyMinutes // 7),
                status="todo",
                sort_order=day,
            )
        )
    plan.ai_generated = True
    plan.status = "active"
    db.commit()
    db.refresh(plan)
    return {"data": _plan_dict(db, plan)}
