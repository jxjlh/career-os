from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
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
