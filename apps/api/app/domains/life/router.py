from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.goals.service import TaskService
from app.domains.life.schemas import LifeGoalCreate, LifeGoalUpdate
from app.domains.life.service import LifeDashboardService, LifeGoalService, LifeRecordService

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


@router.post("/life/goals/{goal_id}/records", status_code=201)
async def create_life_record(
    goal_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    file: Annotated[UploadFile | None, File()] = None,
    content: Annotated[str | None, Form()] = None,
    latitude: Annotated[float | None, Form()] = None,
    longitude: Annotated[float | None, Form()] = None,
    city: Annotated[str | None, Form()] = None,
    country: Annotated[str | None, Form()] = None,
    weather: Annotated[str | None, Form()] = None,
    altitude: Annotated[float | None, Form()] = None,
    record_type: Annotated[str, Form()] = "photo",
) -> dict:
    record = await LifeRecordService(db).create(
        current_user.id,
        goal_id,
        record_type,
        file,
        content,
        latitude,
        longitude,
        city,
        country,
        weather,
        altitude,
        {},
    )
    return {"data": {"id": record.id, "goalId": record.goal_id, "status": "created"}}


@router.get("/life/goals/{goal_id}/records")
def list_life_goal_records(
    goal_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    records = LifeRecordService(db).list_by_goal(current_user.id, goal_id)
    if not records and LifeGoalService(db).get(current_user.id, goal_id) is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Life goal not found"})
    return {"data": records}


@router.get("/life/goals/{goal_id}/tasks")
def list_life_goal_tasks(
    goal_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    # 校验 life goal 归属: 不存在或不属于当前用户一律 404, 避免泄露他人任务
    if LifeGoalService(db).get(current_user.id, goal_id) is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Life goal not found"})
    tasks = TaskService(db).list_by_life_goal(goal_id)
    return {"data": tasks}


@router.get("/life/records")
def life_record_timeline(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    goal_id: str | None = None,
) -> dict:
    return {"data": LifeRecordService(db).get_user_records(current_user.id, page, page_size, goal_id)}


@router.get("/life/records/{record_id}")
def get_life_record_detail(
    record_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = LifeRecordService(db).get_record_detail(current_user.id, record_id)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Life record not found"})
    return {"data": result}


@router.delete("/life/records/{record_id}", status_code=204)
def delete_life_record(
    record_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if not LifeRecordService(db).delete(current_user.id, record_id):
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Life record not found"})
