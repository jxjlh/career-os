from datetime import date
from math import floor, sqrt

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import LifeGoal, UserLevel
from app.domains.life.repository import LifeGoalRepository, UserLevelRepository
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
