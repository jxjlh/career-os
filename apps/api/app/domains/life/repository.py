from app.core.repository import BaseRepository
from app.db.models import LifeGoal, UserLevel


class LifeGoalRepository(BaseRepository[LifeGoal]):
    def __init__(self, db):
        super().__init__(db, LifeGoal)

    def list_by_user(self, user_id: str) -> list[LifeGoal]:
        return (
            self.db.query(LifeGoal)
            .filter(LifeGoal.user_id == user_id)
            .order_by(LifeGoal.created_at.desc())
            .all()
        )

    def get_owned(self, user_id: str, goal_id: str) -> LifeGoal | None:
        return self.db.query(LifeGoal).filter(LifeGoal.id == goal_id, LifeGoal.user_id == user_id).first()

    def create(self, user_id: str, **values) -> LifeGoal:
        goal = LifeGoal(user_id=user_id, **values)
        self.db.add(goal)
        self.db.commit()
        self.db.refresh(goal)
        return goal


class UserLevelRepository(BaseRepository[UserLevel]):
    def __init__(self, db):
        super().__init__(db, UserLevel)

    def get_by_user(self, user_id: str) -> UserLevel | None:
        return self.db.query(UserLevel).filter(UserLevel.user_id == user_id).first()

    def create(self, user_id: str) -> UserLevel:
        level = UserLevel(user_id=user_id, experience=0, level=1)
        self.db.add(level)
        self.db.commit()
        self.db.refresh(level)
        return level
