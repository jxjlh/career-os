from datetime import date

from sqlalchemy.orm import Session

from app.db.models import LifeGoal
from app.domains.life.repository import LifeGoalRepository
from app.domains.life.schemas import LifeGoalCreate, LifeGoalUpdate


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
        return life_goal_dict(goal)

    def update(self, user_id: str, goal_id: str, payload: LifeGoalUpdate) -> dict | None:
        goal = self.repository.get_owned(user_id, goal_id)
        if goal is None:
            return None
        data = payload.model_dump(exclude_unset=True)
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
        return life_goal_dict(goal)

    def delete(self, user_id: str, goal_id: str) -> bool:
        goal = self.repository.get_owned(user_id, goal_id)
        if goal is None:
            return False
        self.db.delete(goal)
        self.db.commit()
        return True
