"""Bucket List 模块的 Pydantic 模型.

输出模型仅作文档/类型契约, router 仍按 life 域约定返回 {"data": ...} 原始 dict
(由 service 的 dict helper 生成 camelCase 键).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class UserBucketState(BaseModel):
    """当前用户对某 bucket item 的关联状态(未加入时为 None)."""

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    joined: bool = False
    wishlist: bool = False
    favorite: bool = False
    completed: bool = False
    life_goal_id: str | None = None
    joined_at: str | None = None
    completed_at: str | None = None


class BucketCategoryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    id: str
    name: str
    icon: str | None = None
    color: str | None = None
    cover_image: str | None = None
    sort: int = 0
    item_count: int = 0


class BucketItemOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    id: str
    category_id: str
    title: str
    subtitle: str | None = None
    description: str | None = None
    story: str | None = None
    cover_image: str | None = None
    gallery_images: list[str] = []
    video_url: str | None = None
    difficulty: int = 3
    estimated_cost: str | None = None
    estimated_days: int | None = None
    best_season: str | None = None
    country: str | None = None
    city: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    address: str | None = None
    tags: list[str] = []
    tips: str | None = None
    popularity: int = 0
    completed_count: int = 0
    status: str = "published"
    created_at: str | None = None
    user_state: UserBucketState | None = None


class BucketItemListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    total: int
    page: int
    page_size: int
    items: list[BucketItemOut]


class JoinResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    life_goal_id: str
    bucket_item_id: str


class BucketProgressResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    completed_count: int
    joined_count: int
    total_catalog: int
    aspirational_total: int
    experience: int
    level: int
    streak: int
