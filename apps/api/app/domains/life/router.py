from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.life.schemas import LifeGoalCreate, LifeGoalUpdate
from app.domains.life.service import LifeDashboardService, LifeGoalService

router = APIRouter(tags=["life"])


@router.get("/life/dashboard")
def life_dashboard(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": LifeDashboardService(db).get(current_user.id)}


@router.get("/life/goals")
def list_life_goals(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": LifeGoalService(db).list(current_user.id)}


@router.post("/life/goals", status_code=201)
def create_life_goal(
    payload: LifeGoalCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": LifeGoalService(db).create(current_user.id, payload)}


@router.get("/life/goals/{goal_id}")
def get_life_goal(
    goal_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = LifeGoalService(db).get(current_user.id, goal_id)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Life goal not found"})
    return {"data": result}


@router.patch("/life/goals/{goal_id}")
def update_life_goal(
    goal_id: str,
    payload: LifeGoalUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = LifeGoalService(db).update(current_user.id, goal_id, payload)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Life goal not found"})
    return {"data": result}


@router.delete("/life/goals/{goal_id}", status_code=204)
def delete_life_goal(
    goal_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if not LifeGoalService(db).delete(current_user.id, goal_id):
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Life goal not found"})
