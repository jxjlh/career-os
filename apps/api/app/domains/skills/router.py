from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile, Skill, UserSkill

router = APIRouter(tags=["skills"])

SEED_SKILLS = [
    ("Marketing", "Marketing", "品牌与营销基础"),
    ("Growth", "Growth Marketing", "增长营销与 A/B 测试"),
    ("Data", "SQL", "数据分析查询"),
    ("Data", "Power BI", "数据可视化"),
    ("Data", "Python", "数据处理与自动化"),
    ("Data", "GA4", "网站数据分析"),
    ("AI", "AI Agent", "智能体应用开发"),
    ("Marketing", "Product Marketing", "产品上市与定位"),
    ("Ops", "Marketing Ops", "营销运营与自动化"),
    ("CRM", "HubSpot", "CRM 管理与自动化"),
    ("Engineering", "System Design", "系统设计"),
    ("Product", "Product Planning", "产品规划"),
]


class SkillProgressUpdate(BaseModel):
    currentLevel: int = Field(ge=1, le=10)
    targetLevel: int = Field(ge=1, le=10)
    confidence: float = Field(default=0, ge=0, le=100)
    notes: str | None = None


def _skill_dict(skill: Skill, user_skill: UserSkill | None) -> dict:
    return {
        "skillId": skill.id,
        "name": skill.name,
        "category": skill.category,
        "description": skill.description,
        "icon": skill.icon,
        "currentLevel": user_skill.current_level if user_skill else 0,
        "targetLevel": user_skill.target_level if user_skill else 0,
        "gap": (user_skill.target_level - user_skill.current_level) if user_skill else 0,
        "confidence": user_skill.confidence if user_skill else 0,
        "notes": user_skill.notes if user_skill else None,
    }


def ensure_seed_skills(db: Session) -> None:
    for category, name, description in SEED_SKILLS:
        if db.query(Skill).filter(Skill.name == name).first() is None:
            db.add(Skill(name=name, category=category, description=description))
    db.commit()


@router.get("/skills")
def list_skills(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    ensure_seed_skills(db)
    skills = db.query(Skill).order_by(Skill.category, Skill.name).all()
    return {"data": [_skill_dict(s, None) for s in skills]}


@router.get("/skills/matrix")
def skill_matrix(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    ensure_seed_skills(db)
    skills = db.query(Skill).order_by(Skill.category, Skill.name).all()
    user_skills = {us.skill_id: us for us in db.query(UserSkill).filter(UserSkill.user_id == current_user.id).all()}
    return {"data": {"items": [_skill_dict(s, user_skills.get(s.id)) for s in skills]}}


@router.put("/skills/{skill_id}/progress")
def update_skill_progress(
    skill_id: str,
    payload: SkillProgressUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    skill = db.get(Skill, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"})
    user_skill = (
        db.query(UserSkill).filter(UserSkill.user_id == current_user.id, UserSkill.skill_id == skill_id).first()
    )
    if user_skill is None:
        user_skill = UserSkill(user_id=current_user.id, skill_id=skill_id)
        db.add(user_skill)
    user_skill.current_level = payload.currentLevel
    user_skill.target_level = payload.targetLevel
    user_skill.confidence = payload.confidence
    user_skill.notes = payload.notes
    db.commit()
    db.refresh(user_skill)
    return {"data": _skill_dict(skill, user_skill)}
