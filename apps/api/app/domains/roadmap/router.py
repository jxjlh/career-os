from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import PlanTask, Profile, Roadmap, RoadmapMilestone, WeeklyPlan

router = APIRouter(tags=["roadmap"])


class RoadmapCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    horizon_years: int = Field(default=5, ge=3, le=10)


class RoadmapUpdate(BaseModel):
    title: str | None = None
    status: str | None = None


class MilestoneCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    phase: str | None = None
    target_date: str | None = None
    sort_order: int = 0


class MilestoneUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    phase: str | None = None
    target_date: str | None = None
    sort_order: int | None = None
    status: str | None = None


def milestone_dict(m: RoadmapMilestone) -> dict:
    return {
        "id": m.id,
        "title": m.title,
        "description": m.description,
        "phase": m.phase,
        "targetDate": m.target_date.isoformat() if m.target_date else None,
        "sortOrder": m.sort_order,
        "status": m.status,
    }


def roadmap_dict(db: Session, roadmap: Roadmap) -> dict:
    milestones = (
        db.query(RoadmapMilestone)
        .filter(RoadmapMilestone.roadmap_id == roadmap.id)
        .order_by(RoadmapMilestone.sort_order)
        .all()
    )
    return {
        "id": roadmap.id,
        "title": roadmap.title,
        "horizonYears": roadmap.horizon_years,
        "status": roadmap.status,
        "source": roadmap.source,
        "milestones": [milestone_dict(m) for m in milestones],
    }


def get_owned_roadmap(db: Session, user_id: str, roadmap_id: str) -> Roadmap:
    roadmap = db.query(Roadmap).filter(Roadmap.id == roadmap_id, Roadmap.user_id == user_id).first()
    if roadmap is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Roadmap not found"})
    return roadmap


@router.get("/roadmaps")
def list_roadmaps(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    roadmaps = (
        db.query(Roadmap)
        .filter(Roadmap.user_id == current_user.id)
        .order_by(Roadmap.created_at.desc())
        .all()
    )
    return {"data": [roadmap_dict(db, r) for r in roadmaps]}


@router.post("/roadmaps", status_code=201)
def create_roadmap(
    payload: RoadmapCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    roadmap = Roadmap(
        user_id=current_user.id,
        title=payload.title,
        horizon_years=payload.horizon_years,
        source="custom",
    )
    db.add(roadmap)
    db.commit()
    db.refresh(roadmap)
    return {"data": roadmap_dict(db, roadmap)}


@router.get("/roadmaps/{roadmap_id}")
def get_roadmap(
    roadmap_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": roadmap_dict(db, get_owned_roadmap(db, current_user.id, roadmap_id))}


@router.patch("/roadmaps/{roadmap_id}")
def update_roadmap(
    roadmap_id: str,
    payload: RoadmapUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    roadmap = get_owned_roadmap(db, current_user.id, roadmap_id)
    if payload.title is not None:
        roadmap.title = payload.title
    if payload.status is not None:
        roadmap.status = payload.status
    db.commit()
    db.refresh(roadmap)
    return {"data": roadmap_dict(db, roadmap)}


@router.delete("/roadmaps/{roadmap_id}", status_code=204)
def delete_roadmap(
    roadmap_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    roadmap = get_owned_roadmap(db, current_user.id, roadmap_id)
    db.delete(roadmap)
    db.commit()


@router.post("/roadmaps/{roadmap_id}/generate")
def generate_roadmap(
    roadmap_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    roadmap = get_owned_roadmap(db, current_user.id, roadmap_id)
    roadmap.source = "ai"
    roadmap.status = "active"
    db.query(RoadmapMilestone).filter(RoadmapMilestone.roadmap_id == roadmap.id).delete()
    templates = [
        ("建立技能基线", "补齐目标岗位的硬技能与工具", "基础"),
        ("完成 3 个实战项目", "用真实数据输出可展示的作品", "实战"),
        ("整理作品集与案例", "形成面试可讲的完整故事线", "实战"),
        ("模拟面试与差距补强", "针对薄弱项做专项练习", "求职"),
        ("跳槽到目标岗位", "投递、面试、复盘并落地", "成果"),
    ]
    for index, (title, description, phase) in enumerate(templates):
        db.add(
            RoadmapMilestone(
                roadmap_id=roadmap.id,
                user_id=current_user.id,
                title=title,
                description=description,
                phase=phase,
                sort_order=index,
                status="done" if index == 0 else "planned",
            )
        )
    db.commit()
    return {"data": roadmap_dict(db, roadmap)}


@router.post("/roadmaps/{roadmap_id}/milestones", status_code=201)
def create_milestone(
    roadmap_id: str,
    payload: MilestoneCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    roadmap = get_owned_roadmap(db, current_user.id, roadmap_id)
    milestone = RoadmapMilestone(
        roadmap_id=roadmap.id,
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        phase=payload.phase,
        sort_order=payload.sort_order,
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return {"data": milestone_dict(milestone)}


@router.patch("/roadmaps/{roadmap_id}/milestones/{milestone_id}")
def update_milestone(
    roadmap_id: str,
    milestone_id: str,
    payload: MilestoneUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    get_owned_roadmap(db, current_user.id, roadmap_id)
    milestone = (
        db.query(RoadmapMilestone)
        .filter(RoadmapMilestone.id == milestone_id, RoadmapMilestone.user_id == current_user.id)
        .first()
    )
    if milestone is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Milestone not found"})
    for field in ("title", "description", "phase", "status"):
        value = getattr(payload, field)
        if value is not None:
            setattr(milestone, field, value)
    if payload.sort_order is not None:
        milestone.sort_order = payload.sort_order
    db.commit()
    db.refresh(milestone)
    return {"data": milestone_dict(milestone)}


@router.delete("/roadmaps/{roadmap_id}/milestones/{milestone_id}", status_code=204)
def delete_milestone(
    roadmap_id: str,
    milestone_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    get_owned_roadmap(db, current_user.id, roadmap_id)
    milestone = db.get(RoadmapMilestone, milestone_id)
    if milestone is None or milestone.user_id != current_user.id:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Milestone not found"})
    db.delete(milestone)
    db.commit()


@router.get("/roadmaps/milestones/{milestone_id}/weekly-tasks")
def list_milestone_weekly_tasks(
    milestone_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """返回关联到该里程碑的本周 PlanTask, 用于里程碑详情页展示「本周推进」."""
    milestone = (
        db.query(RoadmapMilestone)
        .filter(RoadmapMilestone.id == milestone_id, RoadmapMilestone.user_id == current_user.id)
        .first()
    )
    if milestone is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Milestone not found"})

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    rows = (
        db.query(PlanTask)
        .join(WeeklyPlan, WeeklyPlan.id == PlanTask.plan_id)
        .filter(
            WeeklyPlan.user_id == current_user.id,
            WeeklyPlan.week_start == week_start,
            PlanTask.milestone_id == milestone_id,
        )
        .order_by(PlanTask.day, PlanTask.sort_order)
        .all()
    )
    return {
        "data": {
            "milestoneId": milestone_id,
            "milestoneTitle": milestone.title,
            "weekStart": week_start.isoformat(),
            "total": len(rows),
            "done": sum(1 for t in rows if t.status == "done"),
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
