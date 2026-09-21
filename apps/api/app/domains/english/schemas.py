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

    level: str = Field(default="CET-4", max_length=20)
    topic: str = Field(default="校园生活", max_length=40)
    difficulty: Difficulty | None = None
    # 指定用哪本词书挑词；不传则用用户正在背的词书，再退回按 level 映射
    book_id: str | None = None
    # 发音人: catherine(英式女声) / henry(美式男声)
    voice: str = Field(default="catherine", max_length=32)


class ListeningAttemptRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    question_index: int = Field(ge=0)
    user_answer: str
    duration_seconds: int | None = None


class SessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    action: Literal["start", "end"]
