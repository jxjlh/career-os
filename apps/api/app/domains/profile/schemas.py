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
    life_motto: str | None = Field(default=None, max_length=300)


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
    lifeMotto: str | None
    createdAt: str | None
    updatedAt: str | None


class MottoSegment(BaseModel):
    """座右铭的一个文字片段：可以带自己的颜色 / 字号，没带就继承默认。

    单个片段不设 300 上限（整段就是一段时也会超），总长度由 service 统一校验，
    这样超长返回的是 MOTTO_TOO_LONG 而不是 Pydantic 的 422 detail。
    """

    t: str = Field(max_length=1000)
    c: str | None = Field(default=None, max_length=32)
    s: int | None = Field(default=None, ge=8, le=200)


class MottoStyleIn(BaseModel):
    segs: list[MottoSegment] = Field(default_factory=list, max_length=200)
    # 前端可能直接传 data URL（后端会落到对象存储换成公开 URL），
    # 也可能是已有的 http(s) / /media 路径。
    image: str | None = None


class MottoStyleOut(BaseModel):
    segs: list[MottoSegment]
    image: str | None
    updatedAt: str | None
