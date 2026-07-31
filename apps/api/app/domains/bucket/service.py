"""Bucket List 服务: 目录查询 / 加入人生目标 / 收藏心愿 / 完成授 XP."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from itertools import pairwise

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import BucketItem, LifeGoal, UserBucketItem, uuid_str
from app.domains.bucket.repository import (
    BucketCategoryRepository,
    BucketItemRepository,
    UserBucketItemRepository,
)
from app.domains.life.repository import LifeRecordRepository, UserLevelRepository
from app.domains.life.schemas import LifeGoalUpdate
from app.domains.life.service import LifeGoalService

# Bucket 分类 -> LifeGoal 分类(XP/统计按 life category)
CATEGORY_TO_LIFE = {
    "旅行": "travel",
    "成长": "skill",
    "学习": "skill",
    "摄影": "skill",
    "挑战": "other",
    "爱情": "relationship",
    "家庭": "relationship",
    "事业": "career",
    "财富": "finance",
    "公益": "other",
    "运动": "health",
    "体验": "other",
}

ASPIRATIONAL_TOTAL = 500


def bucket_category_dict(category, item_count: int = 0) -> dict:
    return {
        "id": category.id,
        "name": category.name,
        "icon": category.icon,
        "color": category.color,
        "coverImage": category.cover_image,
        "sort": category.sort,
        "itemCount": item_count,
    }


def _user_state_dict(user_bucket) -> dict | None:
    if user_bucket is None:
        return None
    return {
        "joined": True,
        "wishlist": user_bucket.wishlist,
        "favorite": user_bucket.favorite,
        "completed": user_bucket.completed,
        "lifeGoalId": user_bucket.life_goal_id,
        "joinedAt": user_bucket.joined_at.isoformat() if user_bucket.joined_at else None,
        "completedAt": user_bucket.completed_at.isoformat() if user_bucket.completed_at else None,
    }


def bucket_item_dict(item, user_bucket=None) -> dict:
    return {
        "id": item.id,
        "categoryId": item.category_id,
        "title": item.title,
        "subtitle": item.subtitle,
        "description": item.description,
        "story": item.story,
        "coverImage": item.cover_image,
        "galleryImages": item.gallery_images or [],
        "videoUrl": item.video_url,
        "difficulty": item.difficulty,
        "estimatedCost": item.estimated_cost,
        "estimatedDays": item.estimated_days,
        "bestSeason": item.best_season,
        "country": item.country,
        "city": item.city,
        "location": item.location,
        "latitude": item.latitude,
        "longitude": item.longitude,
        "address": item.address,
        "tags": item.tags or [],
        "tips": item.tips,
        "popularity": item.popularity,
        "completedCount": item.completed_count,
        "status": item.status,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
        "userState": _user_state_dict(user_bucket),
    }


class BucketService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.categories = BucketCategoryRepository(db)
        self.items = BucketItemRepository(db)
        self.user_items = UserBucketItemRepository(db)
        self.records = LifeRecordRepository(db)
        self.levels = UserLevelRepository(db)

    def list_categories(self, user_id: str) -> list[dict]:
        cats = self.categories.list_all()
        # 每分类已发布条目数
        counts = dict(
            self.db.query(BucketItem.category_id, func.count(BucketItem.id))
            .filter(BucketItem.status == "published")
            .group_by(BucketItem.category_id)
            .all()
        )
        return [bucket_category_dict(c, counts.get(c.id, 0)) for c in cats]

    def list_items(
        self,
        user_id: str,
        *,
        q: str | None = None,
        category_id: str | None = None,
        country: str | None = None,
        city: str | None = None,
        tag: str | None = None,
        difficulty: int | None = None,
        season: str | None = None,
        completed: bool | None = None,
        sort: str = "popular",
        lat: float | None = None,
        lng: float | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        offset = (page - 1) * page_size
        rows, total = self.items.search(
            user_id,
            q=q,
            category_id=category_id,
            country=country,
            city=city,
            tag=tag,
            difficulty=difficulty,
            season=season,
            completed=completed,
            sort=sort,
            lat=lat,
            lng=lng,
            offset=offset,
            limit=page_size,
        )
        return {
            "total": total,
            "page": page,
            "pageSize": page_size,
            "items": [bucket_item_dict(item, ub) for item, ub in rows],
        }

    def get_item(self, user_id: str, item_id: str) -> dict | None:
        row = self.items.get_with_state(item_id, user_id)
        if row is None:
            return None
        item, user_bucket = row
        return bucket_item_dict(item, user_bucket)

    def join(self, user_id: str, item_id: str) -> dict:
        item = self.items.get(item_id)
        if item is None:
            raise AppError(code="NOT_FOUND", message="Bucket item not found", status=404)
        if self.user_items.get_by_user_item(user_id, item_id) is not None:
            raise AppError(code="ALREADY_JOINED", message="Already joined this bucket item", status=409)

        life_category = "other"
        category = self.categories.get(item.category_id)
        if category is not None:
            life_category = CATEGORY_TO_LIFE.get(category.name, "other")
        location = item.location or " ".join(filter(None, [item.country, item.city])) or None

        # 单事务: 同时创建 LifeGoal 与 UserBucketItem, 一次 commit
        goal = LifeGoal(
            id=uuid_str(),
            user_id=user_id,
            title=item.title,
            category=life_category,
            description=item.description,
            goal_type="manual",
            difficulty=item.difficulty,
            location=location,
            latitude=item.latitude,
            longitude=item.longitude,
            cover_image=item.cover_image,
            status="pending",
            is_ai_generated=False,
        )
        self.db.add(goal)
        self.db.add(
            UserBucketItem(
                id=uuid_str(),
                user_id=user_id,
                bucket_item_id=item_id,
                life_goal_id=goal.id,
                status="joined",
                joined_at=datetime.utcnow(),
            )
        )
        self.db.commit()
        self.db.refresh(goal)
        return {"lifeGoalId": goal.id, "bucketItemId": item_id}

    def unjoin(self, user_id: str, item_id: str) -> bool:
        user_bucket = self.user_items.get_by_user_item(user_id, item_id)
        if user_bucket is None:
            return False
        self.db.delete(user_bucket)
        self.db.commit()
        return True

    def _toggle(self, user_id: str, item_id: str, field: str) -> dict | None:
        user_bucket = self.user_items.get_by_user_item(user_id, item_id)
        if user_bucket is None:
            return None
        setattr(user_bucket, field, not getattr(user_bucket, field))
        self.db.commit()
        self.db.refresh(user_bucket)
        return _user_state_dict(user_bucket)

    def toggle_favorite(self, user_id: str, item_id: str) -> dict | None:
        return self._toggle(user_id, item_id, "favorite")

    def toggle_wishlist(self, user_id: str, item_id: str) -> dict | None:
        return self._toggle(user_id, item_id, "wishlist")

    def complete(self, user_id: str, item_id: str) -> dict | None:
        user_bucket = self.user_items.get_by_user_item(user_id, item_id)
        if user_bucket is None:
            return None
        if user_bucket.completed:
            return _user_state_dict(user_bucket)

        # 驱动关联 LifeGoal 走到 completed, 经 LifeGoalService.update 触发 award_xp
        if user_bucket.life_goal_id:
            goal_service = LifeGoalService(self.db)
            goal = goal_service.repository.get_owned(user_id, user_bucket.life_goal_id)
            if goal is not None:
                if goal.status == "cancelled":
                    raise AppError(
                        code="INVALID_STATUS_TRANSITION",
                        message="Cannot complete a cancelled life goal",
                        status=400,
                    )
                if goal.status == "pending":
                    goal_service.update(user_id, goal.id, LifeGoalUpdate(status="in_progress"))
                if goal.status != "completed":
                    goal_service.update(user_id, goal.id, LifeGoalUpdate(status="completed"))

        user_bucket.completed = True
        user_bucket.completed_at = datetime.utcnow()
        # 目录完成计数 +1
        item = self.items.get(item_id)
        if item is not None:
            item.completed_count = (item.completed_count or 0) + 1
        self.db.commit()
        self.db.refresh(user_bucket)
        return _user_state_dict(user_bucket)

    def progress(self, user_id: str) -> dict:
        joined = self.user_items.count_joined(user_id)
        completed = self.user_items.count_completed(user_id)
        total_catalog = self._catalog_count()
        level = self.levels.get_by_user(user_id)
        if level is None:
            level = self.levels.create(user_id)
        return {
            "completedCount": completed,
            "joinedCount": joined,
            "totalCatalog": total_catalog,
            "aspirationalTotal": ASPIRATIONAL_TOTAL,
            "experience": level.experience,
            "level": level.level,
            "streak": self._streak(user_id),
        }

    def _catalog_count(self) -> int:
        return self.db.query(BucketItem).filter(BucketItem.status == "published").count()

    def _streak(self, user_id: str) -> int:
        """从 LifeRecord 创建日期计算连续打卡天数(截至今天或昨天)."""
        records = self.records.list_by_user(user_id)
        days = sorted({r.created_at.date() for r in records if r.created_at}, reverse=True)
        if not days:
            return 0
        today = date.today()
        # 连续链必须从今天或昨天起算
        if days[0] not in (today, today - timedelta(days=1)):
            return 0
        streak = 1
        for prev, cur in pairwise(days):
            if (prev - cur).days == 1:
                streak += 1
            else:
                break
        return streak
