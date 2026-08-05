"""English Learning 模块的 Pydantic 模型."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Rating = Literal["again", "hard", "good", "easy"]
WordStatus = Literal["new", "learning", "review", "mastered"]
Difficulty = Literal["easy", "medium", "hard"]


class ReviewRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    rating: Rating


class WordStarRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    is_starred: bool | None = None


class ListeningGenerateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    level: str = "CET-4"
    topic: str = "校园生活"


class ListeningAttemptRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    question_index: int = Field(ge=0)
    user_answer: str
    duration_seconds: int | None = None


class SessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    action: Literal["start", "end"]
