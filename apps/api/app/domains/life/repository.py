from app.core.repository import BaseRepository
from app.db.models import LifeGoal, LifeRecord, UserLevel


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


class LifeRecordRepository(BaseRepository[LifeRecord]):
    def __init__(self, db):
        super().__init__(db, LifeRecord)

    def list_by_goal(self, goal_id: str) -> list[LifeRecord]:
        return self.db.query(LifeRecord).filter(LifeRecord.goal_id == goal_id).order_by(LifeRecord.created_at.desc()).all()

    def list_by_user(self, user_id: str) -> list[LifeRecord]:
        return self.db.query(LifeRecord).filter(LifeRecord.user_id == user_id).order_by(LifeRecord.created_at.desc()).all()

    def get_owned(self, user_id: str, record_id: str) -> LifeRecord | None:
        return self.db.query(LifeRecord).filter(LifeRecord.id == record_id, LifeRecord.user_id == user_id).first()

    def create(self, user_id: str, goal_id: str, **values) -> LifeRecord:
        record = LifeRecord(user_id=user_id, goal_id=goal_id, **values)
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record
