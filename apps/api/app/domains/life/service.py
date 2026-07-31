from datetime import date
from math import floor, sqrt

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.storage import upload_object
from app.db.models import LifeGoal, LifeRecord, UserLevel
from app.domains.life.repository import (
    LifeGoalRepository,
    LifeRecordRepository,
    UserLevelRepository,
)
from app.domains.life.schemas import LifeGoalCreate, LifeGoalUpdate

XP_BY_CATEGORY = {
    "travel": 100,
    "skill": 80,
    "career": 200,
    "health": 50,
    "relationship": 50,
    "finance": 100,
    "other": 50,
}

ALLOWED_TRANSITIONS = {
    "pending": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def life_goal_dict(goal: LifeGoal) -> dict:
    return {
        "id": goal.id,
        "title": goal.title,
        "category": goal.category,
        "description": goal.description,
        "goalType": goal.goal_type,
        "difficulty": goal.difficulty,
        "targetDate": goal.target_date.isoformat() if goal.target_date else None,
        "location": goal.location,
        "latitude": goal.latitude,
        "longitude": goal.longitude,
        "coverImage": goal.cover_image,
        "status": goal.status,
        "isAiGenerated": goal.is_ai_generated,
        "createdAt": goal.created_at.isoformat() if goal.created_at else None,
        "updatedAt": goal.updated_at.isoformat() if goal.updated_at else None,
    }


def life_record_dict(record: LifeRecord) -> dict:
    return {
        "id": record.id,
        "goalId": record.goal_id,
        "recordType": record.record_type,
        "photoUrl": record.photo_url,
        "watermarkUrl": record.watermark_url,
        "content": record.content,
        "latitude": record.latitude,
        "longitude": record.longitude,
        "city": record.city,
        "country": record.country,
        "location": " ".join(filter(None, [record.country, record.city])),
        "weather": record.weather,
        "altitude": record.altitude,
        "deviceInfo": record.device_info or {},
        "createdAt": record.created_at.isoformat() if record.created_at else None,
        "updatedAt": record.updated_at.isoformat() if record.updated_at else None,
    }


class LifeGoalService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = LifeGoalRepository(db)

    def list(self, user_id: str) -> list[dict]:
        return [life_goal_dict(goal) for goal in self.repository.list_by_user(user_id)]

    def get(self, user_id: str, goal_id: str) -> dict | None:
        goal = self.repository.get_owned(user_id, goal_id)
        return life_goal_dict(goal) if goal else None

    def create(self, user_id: str, payload: LifeGoalCreate) -> dict:
        data = payload.model_dump()
        data["goal_type"] = data.pop("goalType")
        data["target_date"] = parse_date(data.pop("targetDate", None))
        data["cover_image"] = data.pop("coverImage", None)
        data["is_ai_generated"] = data.pop("isAiGenerated", False)
        goal = self.repository.create(user_id, **data)
        if goal.status == "completed":
            self.award_xp(user_id, goal.category)
        return life_goal_dict(goal)

    def update(self, user_id: str, goal_id: str, payload: LifeGoalUpdate) -> dict | None:
        goal = self.repository.get_owned(user_id, goal_id)
        if goal is None:
            return None
        data = payload.model_dump(exclude_unset=True)
        previous_status = goal.status
        if (
            "status" in data
            and data["status"] != previous_status
            and data["status"] not in ALLOWED_TRANSITIONS.get(previous_status, set())
        ):
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message=f"Cannot transition from {previous_status} to {data['status']}",
                status=400,
            )
        if "goalType" in data:
            goal.goal_type = data.pop("goalType")
        if "targetDate" in data:
            goal.target_date = parse_date(data.pop("targetDate"))
        if "coverImage" in data:
            goal.cover_image = data.pop("coverImage")
        if "isAiGenerated" in data:
            goal.is_ai_generated = data.pop("isAiGenerated")
        for field, value in data.items():
            if value is not None:
                setattr(goal, field, value)
        self.db.commit()
        self.db.refresh(goal)
        if goal.status == "completed" and previous_status != "completed":
            self.award_xp(user_id, goal.category)
        return life_goal_dict(goal)

    def delete(self, user_id: str, goal_id: str) -> bool:
        goal = self.repository.get_owned(user_id, goal_id)
        if goal is None:
            return False
        self.db.delete(goal)
        self.db.commit()
        return True

    def award_xp(self, user_id: str, category: str) -> UserLevel:
        repository = UserLevelRepository(self.db)
        level = repository.get_by_user(user_id)
        if level is None:
            level = repository.create(user_id)
        level.experience += XP_BY_CATEGORY.get(category, XP_BY_CATEGORY["other"])
        level.level = floor(sqrt(level.experience / 100)) + 1
        self.db.commit()
        self.db.refresh(level)
        return level


class LifeDashboardService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = LifeGoalRepository(db)
        self.levels = UserLevelRepository(db)

    def get(self, user_id: str) -> dict:
        goals = self.repository.list_by_user(user_id)
        total = len(goals)
        completed = sum(1 for goal in goals if goal.status == "completed")
        completion_rate = round(completed * 100 / total, 1) if total else 0

        category_stats: dict[str, dict[str, int]] = {}
        for goal in goals:
            stat = category_stats.setdefault(goal.category, {"total": 0, "completed": 0})
            stat["total"] += 1
            if goal.status == "completed":
                stat["completed"] += 1

        level = self.levels.get_by_user(user_id)
        if level is None:
            level = self.levels.create(user_id)

        recent = [goal for goal in goals if goal.status == "completed"][:5]
        return {
            "totalGoals": total,
            "completedGoals": completed,
            "completionRate": completion_rate,
            "experience": level.experience,
            "level": level.level,
            "categoryStats": category_stats,
            "recentCompleted": [life_goal_dict(goal) for goal in recent],
        }


async def upload_record_file(
    user_id: str,
    goal_id: str,
    filename: str,
    content: bytes,
    content_type: str,
) -> str:
    path = f"{user_id}/{goal_id}/watermark/{filename}"
    return await upload_object(path, content, content_type)


class LifeRecordService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = LifeRecordRepository(db)
        self.goals = LifeGoalRepository(db)

    def list_by_goal(self, user_id: str, goal_id: str) -> list[dict]:
        if self.goals.get_owned(user_id, goal_id) is None:
            return []
        return [life_record_dict(record) for record in self.repository.list_by_goal(goal_id)]

    def timeline(self, user_id: str) -> list[dict]:
        goals = {goal.id: goal.title for goal in self.goals.list_by_user(user_id)}
        records = self.repository.list_by_user(user_id)
        items = []
        for record in records:
            item = life_record_dict(record)
            item["goalTitle"] = goals.get(record.goal_id)
            items.append(item)
        return items

    def get_user_records(
        self,
        user_id: str,
        page: int,
        page_size: int,
        goal_id: str | None = None,
    ) -> dict:
        offset = (page - 1) * page_size
        items, total = self.repository.get_all_by_user_paginated(user_id, offset, page_size, goal_id)
        goals = {goal.id: goal.title for goal in self.goals.list_by_user(user_id)}
        payload = []
        for record in items:
            item = life_record_dict(record)
            item["goalTitle"] = goals.get(record.goal_id)
            payload.append(item)
        return {"total": total, "page": page, "pageSize": page_size, "items": payload}

    async def create(
        self,
        user_id: str,
        goal_id: str,
        record_type: str,
        file: object | None,
        content: str | None,
        latitude: float | None,
        longitude: float | None,
        city: str | None,
        country: str | None,
        weather: str | None,
        altitude: float | None,
        device_info: dict,
    ) -> LifeRecord:
        goal = self.goals.get_owned(user_id, goal_id)
        if goal is None:
            raise AppError(code="NOT_FOUND", message="Life goal not found", status=404)
        photo_url = None
        watermark_url = None
        if file is not None:
            filename = file.filename or f"{record_type}.jpg"
            content_bytes = await file.read()
            path = await upload_record_file(user_id, goal_id, filename, content_bytes, file.content_type or "image/jpeg")
            photo_url = path
            watermark_url = path
        return self.repository.create(
            user_id,
            goal_id,
            record_type=record_type,
            photo_url=photo_url,
            watermark_url=watermark_url,
            content=content,
            latitude=latitude,
            longitude=longitude,
            city=city,
            country=country,
            weather=weather,
            altitude=altitude,
            device_info=device_info,
        )

    def delete(self, user_id: str, record_id: str) -> bool:
        record = self.repository.get_owned(user_id, record_id)
        if record is None:
            return False
        self.db.delete(record)
        self.db.commit()
        return True
