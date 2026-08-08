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


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(default="自定义", min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    currentLevel: int = Field(default=1, ge=1, le=10)
    targetLevel: int = Field(default=5, ge=1, le=10)


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)


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


@router.post("/skills", status_code=201)
def create_skill(
    payload: SkillCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    existing = db.query(Skill).filter(Skill.name == payload.name.strip()).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail={"code": "DUPLICATE", "message": "该技能已经存在"})
    skill = Skill(
        name=payload.name.strip(),
        category=payload.category.strip(),
        description=payload.description,
        is_ai_generated=False,
    )
    db.add(skill)
    db.flush()
    row = UserSkill(
        user_id=current_user.id,
        skill_id=skill.id,
        current_level=payload.currentLevel,
        target_level=payload.targetLevel,
    )
    db.add(row)
    db.commit()
    db.refresh(skill)
    db.refresh(row)
    return {"data": SkillService(db).update_progress(current_user, skill.id, row.current_level, row.target_level, row.confidence, row.notes)}


@router.patch("/skills/{skill_id}")
def update_skill(
    skill_id: str,
    payload: SkillUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"})
    if payload.name and payload.name.strip() != skill.name:
        duplicate = db.query(Skill).filter(Skill.name == payload.name.strip(), Skill.id != skill_id).first()
        if duplicate is not None:
            raise HTTPException(status_code=409, detail={"code": "DUPLICATE", "message": "该技能已经存在"})
        skill.name = payload.name.strip()
    if payload.category is not None:
        skill.category = payload.category.strip()
    if payload.description is not None:
        skill.description = payload.description
    db.commit()
    user_skill = db.query(UserSkill).filter(UserSkill.user_id == current_user.id, UserSkill.skill_id == skill_id).first()
    from app.domains.skills.service import skill_dict

    return {"data": skill_dict(skill, user_skill)}


@router.delete("/skills/{skill_id}", status_code=204)
def delete_skill(
    skill_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    row = db.query(UserSkill).filter(UserSkill.user_id == current_user.id, UserSkill.skill_id == skill_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "该技能不在你的学习列表中"})
    db.delete(row)
    if db.query(UserSkill).filter(UserSkill.skill_id == skill_id, UserSkill.user_id != current_user.id).count() == 0:
        skill = db.query(Skill).filter(Skill.id == skill_id, Skill.is_ai_generated.is_(False)).first()
        if skill is not None:
            db.delete(skill)
    db.commit()


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
