from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.goals.schemas import GoalCreate, GoalUpdate, TaskCreate, TaskUpdate
from app.domains.goals.service import GoalService, TaskService, task_dict

router = APIRouter(tags=["goals"])


@router.get("/goals")
def list_goals(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": GoalService(db).list(current_user.id)}


@router.post("/goals", status_code=201)
def create_goal(
    payload: GoalCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    service = GoalService(db)
    goal = service.create(current_user.id, payload)
    return {"data": service.detail(current_user.id, goal.id)}


@router.get("/goals/{goal_id}")
def get_goal(
    goal_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    service = GoalService(db)
    detail = service.detail(current_user.id, goal_id)
    if detail is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Goal not found"})
    return {"data": detail}


@router.patch("/goals/{goal_id}")
def update_goal(
    goal_id: str,
    payload: GoalUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    service = GoalService(db)
    goal = service.update(current_user.id, goal_id, payload)
    if goal is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Goal not found"})
    return {"data": service.detail(current_user.id, goal_id)}


@router.delete("/goals/{goal_id}", status_code=204)
def delete_goal(
    goal_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if not GoalService(db).delete(current_user.id, goal_id):
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Goal not found"})


@router.get("/goals/{goal_id}/tasks")
def list_tasks(
    goal_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    tasks = TaskService(db).list(current_user.id, goal_id)
    if not tasks and GoalService(db).get(current_user.id, goal_id) is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Goal not found"})
    return {"data": tasks}


@router.post("/goals/{goal_id}/tasks", status_code=201)
def create_task(
    goal_id: str,
    payload: TaskCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    task = TaskService(db).create(current_user.id, goal_id, payload)
    if task is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Goal not found"})
    return {"data": task_dict(task)}


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: str,
    payload: TaskUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    task = TaskService(db).update(current_user.id, task_id, payload)
    if task is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Task not found"})
    return {"data": task_dict(task)}


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if not TaskService(db).delete(current_user.id, task_id):
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Task not found"})
