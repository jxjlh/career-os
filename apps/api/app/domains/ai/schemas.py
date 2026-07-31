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
