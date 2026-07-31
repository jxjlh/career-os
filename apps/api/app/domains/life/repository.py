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

    def list_geotagged(self, user_id: str) -> list[LifeGoal]:
        # 带经纬度的人生目标(如旅行目的地), 用于地图目的地标记
        return (
            self.db.query(LifeGoal)
            .filter(
                LifeGoal.user_id == user_id,
                LifeGoal.latitude.is_not(None),
                LifeGoal.longitude.is_not(None),
            )
            .order_by(LifeGoal.created_at.desc())
            .all()
        )

    def get_owned(self, user_id: str, goal_id: str) -> LifeGoal | None:
        return self.db.query(LifeGoal).filter(LifeGoal.id == goal_id, LifeGoal.user_id == user_id).first()

    def get_active(self, user_id: str) -> LifeGoal | None:
        goal = (
            self.db.query(LifeGoal)
            .filter(LifeGoal.user_id == user_id, LifeGoal.status == "in_progress")
            .order_by(LifeGoal.updated_at.desc(), LifeGoal.created_at.desc())
            .first()
        )
        if goal is None:
            goal = (
                self.db.query(LifeGoal)
                .filter(LifeGoal.user_id == user_id, LifeGoal.status == "pending")
                .order_by(LifeGoal.updated_at.desc(), LifeGoal.created_at.desc())
                .first()
            )
        return goal

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

    def list_recent_by_user(self, user_id: str, limit: int = 5) -> list[LifeRecord]:
        return (
            self.db.query(LifeRecord)
            .filter(LifeRecord.user_id == user_id)
            .order_by(LifeRecord.created_at.desc())
            .limit(limit)
            .all()
        )

    def list_geotagged(self, user_id: str, limit: int = 200) -> list[LifeRecord]:
        # 带经纬度的人生记录, 用于地图图钉; 按创建时间倒序, 取最新一页(个人记录量有限)
        return (
            self.db.query(LifeRecord)
            .filter(
                LifeRecord.user_id == user_id,
                LifeRecord.latitude.is_not(None),
                LifeRecord.longitude.is_not(None),
            )
            .order_by(LifeRecord.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_owned(self, user_id: str, record_id: str) -> LifeRecord | None:
        return self.db.query(LifeRecord).filter(LifeRecord.id == record_id, LifeRecord.user_id == user_id).first()

    def get_by_id_with_goal(self, user_id: str, record_id: str) -> tuple[LifeRecord, str | None] | None:
        row = (
            self.db.query(LifeRecord, LifeGoal.title)
            .join(LifeGoal, LifeGoal.id == LifeRecord.goal_id)
            .filter(LifeRecord.id == record_id, LifeRecord.user_id == user_id)
            .first()
        )
        return row if row else None

    def get_all_by_user_paginated(
        self,
        user_id: str,
        offset: int,
        limit: int,
        goal_id: str | None = None,
    ) -> tuple[list[LifeRecord], int]:
        query = self.db.query(LifeRecord).filter(LifeRecord.user_id == user_id)
        if goal_id:
            query = query.filter(LifeRecord.goal_id == goal_id)
        total = query.count()
        items = query.order_by(LifeRecord.created_at.desc()).offset(offset).limit(limit).all()
        return items, total

    def create(self, user_id: str, goal_id: str, **values) -> LifeRecord:
        record = LifeRecord(user_id=user_id, goal_id=goal_id, **values)
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record
