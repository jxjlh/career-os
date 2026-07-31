from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

LifeCategory = Literal["travel", "career", "skill", "health", "relationship", "finance", "other"]
LifeGoalType = Literal["manual", "ai_generated"]
LifeGoalStatus = Literal["pending", "in_progress", "completed", "cancelled"]


class LifeGoalCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str = Field(min_length=1, max_length=200)
    category: LifeCategory = "other"
    description: str | None = None
    goalType: LifeGoalType = "manual"
    difficulty: int = Field(default=3, ge=1, le=5)
    targetDate: str | None = None
    location: str | None = Field(default=None, max_length=200)
    latitude: float | None = None
    longitude: float | None = None
    coverImage: str | None = None
    status: LifeGoalStatus = "pending"
    isAiGenerated: bool = False


class LifeGoalUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: LifeCategory | None = None
    description: str | None = None
    goalType: LifeGoalType | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    targetDate: str | None = None
    location: str | None = Field(default=None, max_length=200)
    latitude: float | None = None
    longitude: float | None = None
    coverImage: str | None = None
    status: LifeGoalStatus | None = None
    isAiGenerated: bool | None = None
