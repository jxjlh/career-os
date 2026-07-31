from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class AIContentCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    type: str
    inputJson: dict
    outputJson: dict
    provider: str
    model: str


class AIContentResponse(BaseModel):
    id: str
    type: str
    inputJson: dict
    outputJson: dict
    provider: str
    model: str
    createdAt: str | None = None


class TravelPlanRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    goal_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("goalId", "goal_id"),
    )
    destination: str
    days: int = 7
    budget: str | None = None
    people: str | None = None
    interests: list[str] = []


class TravelPlanResponse(BaseModel):
    id: str
    aiContentId: str
    title: str | None = None
    summary: str | None = None
    bestTime: str | None = None
    route: list[dict] = []
    preparation: list[str] = []
    tips: list[str] = []


class GrowthPlanRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    goal_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("goalId", "goal_id"),
    )
    goal_title: str | None = Field(default=None, validation_alias=AliasChoices("goalTitle", "goal_title"))
    target_description: str = Field(
        min_length=1,
        max_length=300,
        validation_alias=AliasChoices("targetDescription", "target_description"),
    )
    current_status: str | None = Field(
        default=None,
        validation_alias=AliasChoices("currentStatus", "current_status"),
    )
    available_time: str | None = Field(
        default=None,
        validation_alias=AliasChoices("availableTime", "available_time"),
    )
    difficulty: str | None = Field(default=None, validation_alias=AliasChoices("difficulty", "difficulty"))


class GrowthPlanResponse(BaseModel):
    id: str
    aiContentId: str
    title: str | None = None
    summary: str | None = None
    phases: list[dict] = []
    dailyPlan: list[dict] = []
    milestones: list[str] = []
    tips: list[str] = []


class GenerateTasksResponse(BaseModel):
    createdCount: int
    taskIds: list[str]


class LifeAssistantResponse(BaseModel):
    greeting: str | None = None
    focusGoal: dict | None = None
    todayTasks: list[dict] = []
    progress: dict = {}
    suggestions: list[str] = []
    motivation: str | None = None
    dailySummary: str | None = None


class YearSummaryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    year: int | None = Field(default=None, ge=2000, le=2100)


class YearSummaryResponse(BaseModel):
    id: str
    aiContentId: str
    year: int
    title: str | None = None
    summary: str | None = None
    highlights: list[str] = []
    growth: dict = {}
    versions: dict = {}
    createdAt: str | None = None


class YearReviewRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    year: int = Field(ge=2000, le=2100)
    style: Literal["personal", "social", "xiaohongshu"] | None = None


class YearReviewResponse(BaseModel):
    id: str
    aiContentId: str
    year: int
    style: str | None = None
    title: str | None = None
    summary: str | None = None
    statistics: dict = {}
    achievements: list[str] = []
    growth: dict = {}
    memories: list[dict] = []
    reflection: str | None = None
    nextYearPlan: list[str] = []


class BucketRecommendationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    career: str | None = None
    interests: list[str] = []
    budget: str | None = None
    city: str | None = None
    time: str | None = None
    growth_direction: str | None = Field(
        default=None, validation_alias=AliasChoices("growthDirection", "growth_direction")
    )


class BucketRecommendationItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    item_id: str = Field(validation_alias=AliasChoices("itemId", "item_id"))
    title: str
    cover_image: str | None = Field(
        default=None, validation_alias=AliasChoices("coverImage", "cover_image")
    )
    reason: str = ""
    match_score: int = Field(default=0, validation_alias=AliasChoices("matchScore", "match_score"))
    priority: str = "medium"
    category: str | None = None


class BucketRecommendationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    recommendations: list[BucketRecommendationItem] = []
    source: str = "ai"  # "ai" | "fallback"


# ── Sprint 7 Life Camera: AI 场景识别 ────────────────────────────────
class PhotoAnalysisRequest(BaseModel):
    """基于上下文(GPS/时间/天气/海拔)的拍照场景识别.

    照片本身不上传到 AI(现有 provider 仅文本), 前端可附 photo_description 帮助 AI 理解画面.
    """

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    country: str | None = None
    weather: str | None = None
    temperature: float | None = None
    altitude: float | None = None
    captured_at: str | None = Field(default=None, validation_alias=AliasChoices("capturedAt", "captured_at"))
    photo_description: str | None = Field(
        default=None, validation_alias=AliasChoices("photoDescription", "photo_description")
    )
    goal_id: str | None = Field(default=None, validation_alias=AliasChoices("goalId", "goal_id"))


class RelatedBucketItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    bucket_id: str = Field(validation_alias=AliasChoices("bucketId", "bucket_id"))
    title: str | None = None
    reason: str = ""


class RelatedGoalItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    goal_id: str = Field(validation_alias=AliasChoices("goalId", "goal_id"))
    title: str | None = None
    reason: str = ""


class SuggestedRecord(BaseModel):
    type: str = "travel"
    content: str = ""


class PhotoAnalysisResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    sceneType: str | None = None
    tags: list[str] = []
    description: str | None = None
    relatedBuckets: list[RelatedBucketItem] = []
    relatedGoals: list[RelatedGoalItem] = []
    suggestedRecord: SuggestedRecord | None = None
    source: str = "ai"  # "ai" | "fallback"


# ── Sprint 7 Life Camera: AI Journal 生成 ────────────────────────────
class JournalRequest(BaseModel):
    """根据照片/视频描述 + 上下文生成人生日志."""

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    media_type: str = Field(default="photo", validation_alias=AliasChoices("mediaType", "media_type"))
    media_description: str = Field(
        default="", validation_alias=AliasChoices("mediaDescription", "media_description")
    )
    city: str | None = None
    country: str | None = None
    weather: str | None = None
    temperature: float | None = None
    altitude: float | None = None
    captured_at: str | None = Field(default=None, validation_alias=AliasChoices("capturedAt", "captured_at"))
    goal_id: str | None = Field(default=None, validation_alias=AliasChoices("goalId", "goal_id"))
    goal_title: str | None = Field(default=None, validation_alias=AliasChoices("goalTitle", "goal_title"))


class JournalResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str | None = None
    body: str | None = None
    reflection: str | None = None
    keywords: list[str] = []
    source: str = "ai"  # "ai" | "fallback"
