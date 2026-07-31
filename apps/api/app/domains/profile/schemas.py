from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

LIFE_STAGES = Literal[
    "college",
    "career_exploration",
    "professional",
    "entrepreneur",
    "exploration",
]


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    nickname: str | None = Field(default=None, max_length=120)
    avatar: str | None = None
    bio: str | None = None
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    current_stage: LIFE_STAGES | None = None
    strengths: list[str] = Field(default_factory=list, max_length=50)
    interests: list[str] = Field(default_factory=list, max_length=50)
    career_direction: str | None = Field(default=None, max_length=200)


class ProfileResponse(BaseModel):
    userId: str
    nickname: str | None
    avatar: str | None
    bio: str | None
    birthYear: int | None
    currentStage: str | None
    strengths: list[str]
    interests: list[str]
    careerDirection: str | None
    createdAt: str | None
    updatedAt: str | None
