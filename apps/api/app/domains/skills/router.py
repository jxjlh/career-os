from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import PlanTask, Profile, Skill, UserSkill, WeeklyPlan
from app.domains.skills.service import SkillService

router = APIRouter(tags=["skills"])


class SkillProgressUpdate(BaseModel):
    currentLevel: int = Field(ge=1, le=10)
    targetLevel: int = Field(ge=1, le=10)
    confidence: float = Field(default=0, ge=0, le=100)
    notes: str | None = None


@router.get("/skills")
def list_skills(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SkillService(db).catalog()}


@router.get("/skills/matrix")
def skill_matrix(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": {"items": SkillService(db).matrix(current_user)}}


@router.put("/skills/{skill_id}/progress")
def update_skill_progress(
    skill_id: str,
    payload: SkillProgressUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    try:
        result = SkillService(db).update_progress(
            current_user,
            skill_id,
            payload.currentLevel,
            payload.targetLevel,
            payload.confidence,
            payload.notes,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"}) from exc
    return {"data": result}


@router.get("/skills/{skill_id}/weekly-tasks")
def list_skill_weekly_tasks(
    skill_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """返回关联到该技能的本周 PlanTask, 用于技能详情页展示「本周练习」."""
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"})

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    rows = (
        db.query(PlanTask)
        .join(WeeklyPlan, WeeklyPlan.id == PlanTask.plan_id)
        .filter(
            WeeklyPlan.user_id == current_user.id,
            WeeklyPlan.week_start == week_start,
            PlanTask.skill_id == skill_id,
        )
        .order_by(PlanTask.day, PlanTask.sort_order)
        .all()
    )

    # 累计本周该技能的学习时长 (分钟)
    total_minutes = sum(t.estimated_minutes for t in rows)
    done_minutes = sum(t.estimated_minutes for t in rows if t.status == "done")

    # 用户技能差距 (用于显示进度上下文)
    us = (
        db.query(UserSkill)
        .filter(UserSkill.user_id == current_user.id, UserSkill.skill_id == skill_id)
        .first()
    )
    return {
        "data": {
            "skillId": skill_id,
            "skillName": skill.name,
            "weekStart": week_start.isoformat(),
            "currentLevel": us.current_level if us else 0,
            "targetLevel": us.target_level if us else 0,
            "total": len(rows),
            "done": sum(1 for t in rows if t.status == "done"),
            "totalMinutes": total_minutes,
            "doneMinutes": done_minutes,
            "tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "day": t.day,
                    "status": t.status,
                    "taskType": t.task_type,
                    "priority": t.priority,
                    "estimatedMinutes": t.estimated_minutes,
                    "planId": t.plan_id,
                }
                for t in rows
            ],
        }
    }
