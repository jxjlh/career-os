from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.storage import resolve_object_url
from app.db.models import LifeRecord, Profile
from app.domains.goals.service import TaskService
from app.domains.life.schemas import LifeGoalCreate, LifeGoalUpdate
from app.domains.life.service import (
    CheckinStreakService,
    LifeDashboardService,
    LifeGoalService,
    LifeMapService,
    LifeRecordService,
)

router = APIRouter(tags=["life"])


GOAL_SUGGESTIONS = [
    {
        "id": "travel-iceland",
        "title": "去冰岛看一次极光",
        "category": "travel",
        "description": "在北极圈附近追一次极光，给自己一场硬核浪漫。",
        "suggested": {"location": "冰岛", "budget": "20000", "recommendedDays": 7, "bestSeason": "9-3月", "region": "北欧"},
    },
    {
        "id": "travel-xinjiang",
        "title": "自驾新疆独库公路",
        "category": "travel",
        "description": "穿越四季的公路旅行，雪山、草原与峡谷一路切换。",
        "suggested": {"location": "新疆独库公路", "budget": "8000", "recommendedDays": 8, "bestSeason": "6-9月", "region": "中国西北"},
    },
    {
        "id": "skill-photo",
        "title": "系统学习摄影与后期",
        "category": "skill",
        "description": "从构图、用光到 Lightroom 后期，建立可复用的影像能力。",
        "suggested": {"budget": "3000", "recommendedDays": 60},
    },
    {
        "id": "skill-english",
        "title": "英语口语达到流利交流",
        "category": "skill",
        "description": "坚持 90 天开口练习，让英语成为可随时使用的工具。",
        "suggested": {"budget": "1000", "recommendedDays": 90},
    },
    {
        "id": "health-marathon",
        "title": "完成一次半程马拉松",
        "category": "health",
        "description": "从 5 公里开始，用 16 周科学训练冲过终点线。",
        "suggested": {"budget": "2000", "recommendedDays": 112},
    },
    {
        "id": "finance-fund",
        "title": "建立自己的理财体系",
        "category": "finance",
        "description": "记账、预算、定投三步走，让每一分钱都有去向。",
        "suggested": {"budget": "500", "recommendedDays": 30},
    },
    {
        "id": "relationship-family",
        "title": "带父母完成一次长途旅行",
        "category": "relationship",
        "description": "趁时光正好，陪父母看一次他们念叨了很久的地方。",
        "suggested": {"budget": "12000", "recommendedDays": 6, "bestSeason": "4-5月"},
    },
    {
        "id": "career-side-project",
        "title": "做一个能写进简历的个人项目",
        "category": "career",
        "description": "把一个真实问题做成可演示的作品，面试时讲出完整故事。",
        "suggested": {"budget": "500", "recommendedDays": 45},
    },
    {
        "id": "travel-tibet",
        "title": "去西藏看一次星空",
        "category": "travel",
        "description": "高原的夜空没有光污染，银河会离你很近。",
        "suggested": {"location": "西藏", "budget": "10000", "recommendedDays": 10, "bestSeason": "6-9月", "region": "中国西南"},
    },
]


@router.get("/life/goal-suggestions")
def life_goal_suggestions(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    existing = {goal["title"] for goal in LifeGoalService(db).list(current_user.id)}
    items = [
        item
        for item in GOAL_SUGGESTIONS
        if item["title"] not in existing
    ]
    return {"data": items}


@router.get("/life/dashboard")
def life_dashboard(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": LifeDashboardService(db).get(current_user.id)}


@router.get("/life/map")
def life_map(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: Annotated[int | None, Query()] = None,
    category: Annotated[str | None, Query(max_length=40)] = None,
    country: Annotated[str | None, Query(max_length=80)] = None,
    city: Annotated[str | None, Query(max_length=120)] = None,
) -> dict:
    return {
        "data": LifeMapService(db).get(
            current_user.id, year=year, category=category, country=country, city=city
        )
    }


@router.get("/life/map/statistics")
def life_map_statistics(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": LifeMapService(db).statistics(current_user.id)}


@router.get("/life/map/{marker_id}")
def life_map_detail(
    marker_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = LifeMapService(db).get_detail(current_user.id, marker_id)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Map marker not found"})
    return {"data": result}


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
    # ── Sprint 7: 视频日志 + AI 场景 ──
    video: Annotated[UploadFile | None, File()] = None,
    thumbnail: Annotated[UploadFile | None, File()] = None,
    duration_seconds: Annotated[int | None, Form()] = None,
    scene_type: Annotated[str | None, Form()] = None,
    ai_tags: Annotated[str | None, Form()] = None,
    temperature: Annotated[float | None, Form()] = None,
    bucket_item_id: Annotated[str | None, Form()] = None,
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
        video_file=video,
        thumbnail=thumbnail,
        duration_seconds=duration_seconds,
        scene_type=scene_type,
        ai_tags=ai_tags,
        temperature=temperature,
        bucket_item_id=bucket_item_id,
    )
    return {"data": {"id": record.id, "goalId": record.goal_id, "status": "created"}}


@router.get("/life/checkin")
def get_checkin_streak(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": CheckinStreakService(db).get(current_user.id)}


@router.post("/life/checkin")
def trigger_checkin(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": CheckinStreakService(db).checkin(current_user.id)}


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


@router.get("/life/goals/{goal_id}/weekly-tasks")
def list_life_goal_weekly_tasks(
    goal_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """返回关联到该人生目标的本周 PlanTask, 用于目标详情页展示「本周推进」."""
    from datetime import date, timedelta

    from app.db.models import PlanTask, WeeklyPlan

    if LifeGoalService(db).get(current_user.id, goal_id) is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Life goal not found"})

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    rows = (
        db.query(PlanTask)
        .join(WeeklyPlan, WeeklyPlan.id == PlanTask.plan_id)
        .filter(
            WeeklyPlan.user_id == current_user.id,
            WeeklyPlan.week_start == week_start,
            PlanTask.life_goal_id == goal_id,
        )
        .order_by(PlanTask.day, PlanTask.sort_order)
        .all()
    )
    return {
        "data": {
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


@router.get("/life/records/media")
async def life_record_media(
    path: Annotated[str, Query(min_length=1, max_length=1000)],
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    import logging
    logger = logging.getLogger(__name__)

    logger.info("life_record_media: requesting media", extra={"path": path, "user_id": current_user.id})

    # 1. 精确匹配
    record = (
        db.query(LifeRecord)
        .filter(
            or_(
                LifeRecord.watermark_url == path,
                LifeRecord.photo_url == path,
                LifeRecord.video_url == path,
                LifeRecord.thumbnail_url == path,
            )
        )
        .first()
    )

    # 2. 如果精确匹配失败，尝试模糊匹配（path 包含子串）
    if record is None:
        logger.warning("life_record_media: exact match failed, trying fuzzy match", extra={"path": path})
        # 从路径中提取文件名进行模糊匹配
        filename = path.split("/")[-1] if "/" in path else path
        record = (
            db.query(LifeRecord)
            .filter(
                LifeRecord.user_id == current_user.id,
                or_(
                    LifeRecord.watermark_url.contains(filename),
                    LifeRecord.photo_url.contains(filename),
                    LifeRecord.video_url.contains(filename),
                    LifeRecord.thumbnail_url.contains(filename),
                ),
            )
            .first()
        )

    if record is None or record.user_id != current_user.id:
        logger.error("life_record_media: record not found", extra={"path": path})
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Media not found"})

    url = resolve_object_url(path)
    if url is None:
        # 尝试从 record 中找可用的 URL
        for field_name, field_value in [
            ("watermark_url", record.watermark_url),
            ("photo_url", record.photo_url),
            ("video_url", record.video_url),
            ("thumbnail_url", record.thumbnail_url),
        ]:
            if field_value and field_value.startswith(("http://", "https://", "/media/")):
                logger.info("life_record_media: using fallback URL", extra={"field": field_name})
                return {"data": {"url": field_value}}

        logger.error("life_record_media: resolve_object_url failed and no fallback", extra={"path": path})
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Media not found"})

    return {"data": {"url": url}}


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
