from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

LifeGoalType = Literal["manual", "ai_generated"]
LifeGoalStatus = Literal["pending", "in_progress", "completed", "cancelled"]


class LifeGoalCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str = Field(min_length=1, max_length=200)
    category: str = Field(default="other", min_length=1, max_length=80)
    description: str | None = None
    goalType: LifeGoalType = "manual"
    difficulty: int = Field(default=3, ge=1, le=5)
    startDate: str | None = None
    targetDate: str | None = None
    location: str | None = Field(default=None, max_length=200)
    latitude: float | None = None
    longitude: float | None = None
    coverImage: str | None = None
    budget: str | None = Field(default=None, max_length=120)
    recommendedDays: int | None = Field(default=None, ge=1, le=365)
    bestSeason: str | None = Field(default=None, max_length=80)
    region: str | None = Field(default=None, max_length=120)
    friends: list[str] = Field(default_factory=list)
    aiPlanMeta: dict = {}
    status: LifeGoalStatus = "pending"
    isAiGenerated: bool = False


class LifeGoalUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None
    goalType: LifeGoalType | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    startDate: str | None = None
    targetDate: str | None = None
    location: str | None = Field(default=None, max_length=200)
    latitude: float | None = None
    longitude: float | None = None
    coverImage: str | None = None
    budget: str | None = Field(default=None, max_length=120)
    recommendedDays: int | None = Field(default=None, ge=1, le=365)
    bestSeason: str | None = Field(default=None, max_length=80)
    region: str | None = Field(default=None, max_length=120)
    friends: list[str] | None = None
    aiPlanMeta: dict | None = None
    status: LifeGoalStatus | None = None
    isAiGenerated: bool | None = None


class LifeRecordListItem(BaseModel):
    id: str
    goalId: str
    goalTitle: str | None = None
    recordType: str
    photoUrl: str | None = None
    watermarkUrl: str | None = None
    videoUrl: str | None = None
    thumbnailUrl: str | None = None
    durationSeconds: int | None = None
    sceneType: str | None = None
    aiTags: list[str] = []
    aiDescription: str | None = None
    temperature: float | None = None
    bucketItemId: str | None = None
    content: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    country: str | None = None
    createdAt: str | None = None


class LifeRecordListResponse(BaseModel):
    total: int
    page: int
    pageSize: int
    items: list[LifeRecordListItem]


class LifeRecordDetailResponse(BaseModel):
    id: str
    userId: str
    goalId: str
    goalTitle: str | None = None
    recordType: str
    photoUrl: str | None = None
    watermarkUrl: str | None = None
    videoUrl: str | None = None
    thumbnailUrl: str | None = None
    durationSeconds: int | None = None
    sceneType: str | None = None
    aiTags: list[str] = []
    aiDescription: str | None = None
    temperature: float | None = None
    bucketItemId: str | None = None
    content: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    country: str | None = None
    weather: str | None = None
    altitude: float | None = None
    deviceInfo: dict[str, str] = {}
    createdAt: str | None = None
    updatedAt: str | None = None


class CheckinStreakResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    currentStreak: int = 0
    longestStreak: int = 0
    lastCheckinDate: str | None = None
    totalCheckins: int = 0
    checkedInToday: bool = False
