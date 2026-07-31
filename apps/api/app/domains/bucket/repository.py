from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.repository import BaseRepository
from app.db.models import BucketCategory, BucketItem, UserBucketItem


class BucketCategoryRepository(BaseRepository[BucketCategory]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, BucketCategory)

    def list_all(self) -> list[BucketCategory]:
        return self.db.query(BucketCategory).order_by(BucketCategory.sort.asc(), BucketCategory.created_at.asc()).all()

    def get_by_name(self, name: str) -> BucketCategory | None:
        return self.db.query(BucketCategory).filter(BucketCategory.name == name).first()

    def count(self) -> int:
        return self.db.query(BucketCategory).count()


class BucketItemRepository(BaseRepository[BucketItem]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, BucketItem)

    def get(self, entity_id: str) -> BucketItem | None:
        return self.db.get(BucketItem, entity_id)

    def get_with_state(
        self, entity_id: str, user_id: str
    ) -> tuple[BucketItem, UserBucketItem | None] | None:
        row = (
            self.db.query(BucketItem, UserBucketItem)
            .outerjoin(
                UserBucketItem,
                and_(
                    UserBucketItem.bucket_item_id == BucketItem.id,
                    UserBucketItem.user_id == user_id,
                ),
            )
            .filter(BucketItem.id == entity_id)
            .first()
        )
        return row if row else None

    def search(
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
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[tuple[BucketItem, UserBucketItem | None]], int]:
        query = (
            self.db.query(BucketItem, UserBucketItem)
            .outerjoin(
                UserBucketItem,
                and_(
                    UserBucketItem.bucket_item_id == BucketItem.id,
                    UserBucketItem.user_id == user_id,
                ),
            )
            .filter(BucketItem.status == "published")
        )

        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    BucketItem.title.ilike(like),
                    BucketItem.subtitle.ilike(like),
                    BucketItem.description.ilike(like),
                    BucketItem.location.ilike(like),
                    BucketItem.country.ilike(like),
                    BucketItem.city.ilike(like),
                )
            )
        if category_id:
            query = query.filter(BucketItem.category_id == category_id)
        if country:
            query = query.filter(BucketItem.country == country)
        if city:
            query = query.filter(BucketItem.city == city)
        if tag:
            query = query.filter(BucketItem.tags.like(f'%"{tag}"%'))
        if difficulty is not None:
            query = query.filter(BucketItem.difficulty == difficulty)
        if season:
            query = query.filter(BucketItem.best_season.ilike(f"%{season}%"))
        if completed is True:
            query = query.filter(UserBucketItem.completed.is_(True))
        elif completed is False:
            query = query.filter(or_(UserBucketItem.completed.is_(False), UserBucketItem.id.is_(None)))

        total = query.count()

        if sort == "latest":
            query = query.order_by(BucketItem.created_at.desc())
        elif sort == "nearest" and lat is not None and lng is not None:
            # 欧氏距离平方近似排序 (v1); 仅含坐标条目
            query = query.filter(
                BucketItem.latitude.is_not(None), BucketItem.longitude.is_not(None)
            ).order_by(
                ((BucketItem.latitude - lat) * (BucketItem.latitude - lat) + (BucketItem.longitude - lng) * (BucketItem.longitude - lng)).asc()
            )
            total = query.count()
        else:  # popular / recommended
            query = query.order_by(BucketItem.popularity.desc(), BucketItem.created_at.desc())

        items = query.offset(offset).limit(limit).all()
        return items, total

    def list_published(self, limit: int = 60) -> list[BucketItem]:
        """AI 推荐目录: 仅返回已发布条目, 按热度降序取前 N."""
        return (
            self.db.query(BucketItem)
            .filter(BucketItem.status == "published")
            .order_by(BucketItem.popularity.desc(), BucketItem.created_at.desc())
            .limit(limit)
            .all()
        )


class UserBucketItemRepository(BaseRepository[UserBucketItem]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, UserBucketItem)

    def get_by_user_item(self, user_id: str, bucket_item_id: str) -> UserBucketItem | None:
        return (
            self.db.query(UserBucketItem)
            .filter(
                UserBucketItem.user_id == user_id,
                UserBucketItem.bucket_item_id == bucket_item_id,
            )
            .first()
        )

    def list_by_user(self, user_id: str) -> list[UserBucketItem]:
        return (
            self.db.query(UserBucketItem)
            .filter(UserBucketItem.user_id == user_id)
            .order_by(UserBucketItem.created_at.desc())
            .all()
        )

    def count_joined(self, user_id: str) -> int:
        return self.db.query(func.count(UserBucketItem.id)).filter(UserBucketItem.user_id == user_id).scalar() or 0

    def count_completed(self, user_id: str) -> int:
        return (
            self.db.query(func.count(UserBucketItem.id))
            .filter(UserBucketItem.user_id == user_id, UserBucketItem.completed.is_(True))
            .scalar()
            or 0
        )
