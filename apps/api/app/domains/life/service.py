from datetime import date
from itertools import pairwise
from math import floor, sqrt

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.storage import upload_object
from app.db.models import (
    BucketItem,
    LifeGoal,
    LifeMapVisit,
    LifeRecord,
    UserBucketItem,
    UserLevel,
)
from app.domains.life.repository import (
    LifeGoalRepository,
    LifeMapVisitRepository,
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
        "startDate": goal.start_date.isoformat() if goal.start_date else None,
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
        data["start_date"] = parse_date(data.pop("startDate", None))
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
        if "startDate" in data:
            goal.start_date = parse_date(data.pop("startDate"))
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


class LifeMapService:
    """聚合人生地图: 统一 markers 来自 LifeRecord / LifeGoal / BucketItem / LifeMapVisit.

    支持按 年份/分类/国家/城市 过滤, 计算 统计(城市/国家/公里/Bucket/XP) 与 路线距离.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.records = LifeRecordRepository(db)
        self.goals = LifeGoalRepository(db)
        self.visits = LifeMapVisitRepository(db)

    def get(
        self,
        user_id: str,
        *,
        year: int | None = None,
        category: str | None = None,
        country: str | None = None,
        city: str | None = None,
    ) -> dict:
        markers = self._collect_markers(user_id)
        markers = self._filter(markers, year=year, category=category, country=country, city=city)
        markers.sort(key=lambda m: (m["visitTime"] or m["createdAt"] or ""), reverse=True)

        # 城市聚合 (用于城市列表)
        cities: dict[tuple, dict] = {}
        for m in markers:
            key = (m["country"], m["city"])
            entry = cities.setdefault(
                key,
                {
                    "city": m["city"] or "未知城市",
                    "country": m["country"],
                    "latitude": m["latitude"],
                    "longitude": m["longitude"],
                    "markerCount": 0,
                    "latestTitle": None,
                },
            )
            entry["markerCount"] += 1
            if entry["latestTitle"] is None:
                entry["latestTitle"] = m["title"]

        return {
            "markers": markers,
            "cities": sorted(cities.values(), key=lambda c: c["markerCount"], reverse=True),
        }

    def statistics(self, user_id: str) -> dict:
        markers = self._collect_markers(user_id)
        countries = {m["country"] for m in markers if m["country"]}
        city_keys = {(m["country"], m["city"]) for m in markers if m["city"]}
        bucket_completed = sum(1 for m in markers if m["sourceType"] == "bucket" and m["status"] == "completed")
        records_count = sum(1 for m in markers if m["sourceType"] == "record")
        goals_count = sum(1 for m in markers if m["sourceType"] == "goal")

        # 按时间升序计算旅行距离 (haversine)
        ordered = sorted(markers, key=lambda m: (m["visitTime"] or m["createdAt"] or ""))
        distance_km = 0.0
        for prev, cur in pairwise(ordered):
            if prev["latitude"] is None or cur["latitude"] is None:
                continue
            distance_km += _haversine_km(
                prev["latitude"], prev["longitude"], cur["latitude"], cur["longitude"]
            )

        level = UserLevelRepository(self.db).get_by_user(user_id)
        experience = level.experience if level else 0
        level_num = level.level if level else 1

        return {
            "totalMarkers": len(markers),
            "totalCities": len(city_keys),
            "totalCountries": len(countries),
            "totalDistance": round(distance_km, 1),
            "bucketCompleted": bucket_completed,
            "totalRecords": records_count,
            "totalGoals": goals_count,
            "experience": experience,
            "level": level_num,
        }

    def get_detail(self, user_id: str, marker_id: str) -> dict | None:
        """marker_id 形如 record-xxx / goal-xxx / bucket-xxx / visit-xxx."""
        source_type, source_id = _parse_marker_id(marker_id)
        if source_type == "record":
            row = self.records.get_by_id_with_goal(user_id, source_id)
            if row is None:
                return None
            record, goal_title = row
            return {**life_record_dict(record), "goalTitle": goal_title, "markerType": "record"}
        if source_type == "goal":
            goal = self.goals.get_owned(user_id, source_id)
            return {**life_goal_dict(goal), "markerType": "goal"} if goal else None
        if source_type == "bucket":
            return self._bucket_detail(user_id, source_id)
        if source_type == "visit":
            visit = self.visits.get_owned(user_id, source_id)
            return _visit_dict(visit) if visit else None
        return None

    # ── 内部: marker 聚合 ──────────────────────────────────────────
    def _collect_markers(self, user_id: str) -> list[dict]:
        markers: list[dict] = []

        # 1. LifeRecord → 绿色 (已完成的人生瞬间)
        for record in self.records.list_geotagged(user_id):
            markers.append(
                {
                    "id": f"record-{record.id}",
                    "sourceType": "record",
                    "sourceId": record.id,
                    "title": (record.content or "人生瞬间")[:60],
                    "subtitle": " · ".join(filter(None, [record.country, record.city])),
                    "coverImage": record.photo_url,
                    "latitude": record.latitude,
                    "longitude": record.longitude,
                    "country": record.country,
                    "province": None,
                    "city": record.city,
                    "address": None,
                    "visitTime": record.created_at.isoformat() if record.created_at else None,
                    "createdAt": record.created_at.isoformat() if record.created_at else None,
                    "photosCount": 1 if record.photo_url else 0,
                    "videosCount": 0,
                    "status": "completed",
                    "category": "record",
                    "lifeGoalId": record.goal_id,
                    "lifeRecordId": record.id,
                    "bucketItemId": None,
                    "weather": record.weather,
                    "temperature": None,
                }
            )

        # 2. LifeGoal → 按状态着色
        for goal in self.goals.list_geotagged(user_id):
            markers.append(
                {
                    "id": f"goal-{goal.id}",
                    "sourceType": "goal",
                    "sourceId": goal.id,
                    "title": goal.title,
                    "subtitle": goal.location,
                    "coverImage": goal.cover_image,
                    "latitude": goal.latitude,
                    "longitude": goal.longitude,
                    "country": None,
                    "province": None,
                    "city": None,
                    "address": goal.location,
                    "visitTime": goal.target_date.isoformat() if goal.target_date else None,
                    "createdAt": goal.created_at.isoformat() if goal.created_at else None,
                    "photosCount": 0,
                    "videosCount": 0,
                    "status": goal.status,
                    "category": goal.category,
                    "lifeGoalId": goal.id,
                    "lifeRecordId": None,
                    "bucketItemId": None,
                    "weather": None,
                    "temperature": None,
                }
            )

        # 3. BucketItem (用户已加入/已完成) → 按完成状态着色
        markers.extend(self._bucket_markers(user_id))

        # 4. LifeMapVisit → 绿色 (显式访问点)
        for visit in self.visits.list_geotagged(user_id):
            markers.append(_visit_marker(visit))

        return markers

    def _bucket_markers(self, user_id: str) -> list[dict]:
        rows = (
            self.db.query(BucketItem, UserBucketItem)
            .outerjoin(
                UserBucketItem,
                (UserBucketItem.bucket_item_id == BucketItem.id)
                & (UserBucketItem.user_id == user_id),
            )
            .filter(
                BucketItem.latitude.is_not(None),
                BucketItem.longitude.is_not(None),
                BucketItem.status == "published",
            )
            .all()
        )
        markers = []
        for item, ub in rows:
            status = "pending"  # 未加入 = 灰色
            if ub is not None:
                status = "completed" if ub.completed else "in_progress"
            markers.append(
                {
                    "id": f"bucket-{item.id}",
                    "sourceType": "bucket",
                    "sourceId": item.id,
                    "title": item.title,
                    "subtitle": " · ".join(filter(None, [item.country, item.city])),
                    "coverImage": item.cover_image,
                    "latitude": item.latitude,
                    "longitude": item.longitude,
                    "country": item.country,
                    "province": None,
                    "city": item.city,
                    "address": item.location,
                    "visitTime": ub.completed_at.isoformat() if ub and ub.completed_at else None,
                    "createdAt": item.created_at.isoformat() if item.created_at else None,
                    "photosCount": 0,
                    "videosCount": 0,
                    "status": status,
                    "category": "bucket",
                    "lifeGoalId": ub.life_goal_id if ub else None,
                    "lifeRecordId": None,
                    "bucketItemId": item.id,
                    "weather": None,
                    "temperature": None,
                }
            )
        return markers

    def _bucket_detail(self, user_id: str, item_id: str) -> dict | None:
        row = (
            self.db.query(BucketItem, UserBucketItem)
            .outerjoin(
                UserBucketItem,
                (UserBucketItem.bucket_item_id == BucketItem.id)
                & (UserBucketItem.user_id == user_id),
            )
            .filter(BucketItem.id == item_id)
            .first()
        )
        if row is None:
            return None
        item, ub = row
        return {
            "markerType": "bucket",
            "id": item.id,
            "title": item.title,
            "subtitle": item.subtitle,
            "description": item.description,
            "coverImage": item.cover_image,
            "latitude": item.latitude,
            "longitude": item.longitude,
            "country": item.country,
            "city": item.city,
            "address": item.location,
            "difficulty": item.difficulty,
            "estimatedCost": item.estimated_cost,
            "bestSeason": item.best_season,
            "tags": item.tags,
            "userState": {
                "joined": ub is not None,
                "completed": ub.completed if ub else False,
                "favorite": ub.favorite if ub else False,
                "lifeGoalId": ub.life_goal_id if ub else None,
            }
            if ub
            else None,
        }

    @staticmethod
    def _filter(
        markers: list[dict],
        *,
        year: int | None,
        category: str | None,
        country: str | None,
        city: str | None,
    ) -> list[dict]:
        result = markers
        if year is not None:
            result = [m for m in result if (m["visitTime"] or m["createdAt"] or "").startswith(str(year))]
        if category:
            cat = category.lower()
            result = [m for m in result if (m["category"] or "").lower() == cat or m["sourceType"] == cat]
        if country:
            result = [m for m in result if (m["country"] or "") == country]
        if city:
            result = [m for m in result if (m["city"] or "") == city]
        return result


def _parse_marker_id(marker_id: str) -> tuple[str, str]:
    """拆分 record-xxx / goal-xxx / bucket-xxx / visit-xxx."""
    if "-" not in marker_id:
        return "", marker_id
    prefix, _, rest = marker_id.partition("-")
    return prefix, rest


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """两点球面距离 (km), 用于旅行里程统计."""
    from math import asin, cos, radians, sin, sqrt

    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _visit_marker(visit: LifeMapVisit) -> dict:
    return {
        "id": f"visit-{visit.id}",
        "sourceType": "visit",
        "sourceId": visit.id,
        "title": visit.title or "访问点",
        "subtitle": " · ".join(filter(None, [visit.country, visit.city])),
        "coverImage": visit.cover_image,
        "latitude": visit.latitude,
        "longitude": visit.longitude,
        "country": visit.country,
        "province": visit.province,
        "city": visit.city,
        "address": visit.address,
        "visitTime": visit.visit_time.isoformat() if visit.visit_time else None,
        "createdAt": visit.created_at.isoformat() if visit.created_at else None,
        "photosCount": visit.photos_count,
        "videosCount": visit.videos_count,
        "status": "completed",
        "category": visit.category,
        "lifeGoalId": visit.life_goal_id,
        "lifeRecordId": visit.life_record_id,
        "bucketItemId": visit.bucket_item_id,
        "weather": visit.weather,
        "temperature": visit.temperature,
    }


def _visit_dict(visit: LifeMapVisit) -> dict:
    return {
        "markerType": "visit",
        "id": visit.id,
        "title": visit.title or "访问点",
        "latitude": visit.latitude,
        "longitude": visit.longitude,
        "country": visit.country,
        "province": visit.province,
        "city": visit.city,
        "district": visit.district,
        "address": visit.address,
        "visitTime": visit.visit_time.isoformat() if visit.visit_time else None,
        "photosCount": visit.photos_count,
        "videosCount": visit.videos_count,
        "weather": visit.weather,
        "temperature": visit.temperature,
        "coverImage": visit.cover_image,
        "category": visit.category,
        "lifeGoalId": visit.life_goal_id,
        "lifeRecordId": visit.life_record_id,
        "bucketItemId": visit.bucket_item_id,
        "createdAt": visit.created_at.isoformat() if visit.created_at else None,
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

    def get_record_detail(self, user_id: str, record_id: str) -> dict | None:
        row = self.repository.get_by_id_with_goal(user_id, record_id)
        if row is None:
            return None
        record, goal_title = row
        item = life_record_dict(record)
        item["userId"] = record.user_id
        item["goalTitle"] = goal_title
        return item

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
