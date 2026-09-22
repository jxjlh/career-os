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
    # 自由文本需求：用户用自然语言写下旅行想法（如「去大理 7 天，预算 5000，喜欢美食和徒步」）。
    # 提供了 requirement 就优先走自由文本生成，由 AI 自行推断目的地/天数/预算等，
    # 结构化字段（destination/days/...）作为可选补充，缺失维度由 AI 按默认补全。
    requirement: str | None = Field(default=None, max_length=2000)
    destination: str | None = None
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


class TravelPlanUpdateRequest(BaseModel):
    """人工修改已生成的旅行攻略：只传要改的字段，未传的保持不变。"""

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str | None = None
    summary: str | None = None
    bestTime: str | None = None
    route: list[dict] | None = None
    preparation: list[str] | None = None
    tips: list[str] | None = None


class TravelAssistantMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    role: str = "user"
    content: str


class TravelAssistantRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    goal_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("goalId", "goal_id"),
    )
    messages: list[TravelAssistantMessage] = []


class TravelAssistantResponse(TravelPlanResponse):
    reply: str = ""


class TravelChecklistItemCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    item: str = Field(min_length=1, max_length=200)
    note: str | None = None


class TravelChecklistItemUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    item: str | None = Field(default=None, min_length=1, max_length=200)
    note: str | None = None
    checked: bool | None = None


class TravelChecklistItemResponse(BaseModel):
    id: str
    aiContentId: str
    item: str
    note: str | None = None
    checked: bool = False
    sortOrder: int = 0
    createdAt: str | None = None


class GrowthPlanRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    goal_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("goalId", "goal_id"),
    )
    goal_title: str | None = Field(default=None, validation_alias=AliasChoices("goalTitle", "goal_title"))
    # 表单式生成（只给 goalId）时可为空 —— 服务端会从人生目标上读取描述与分类。
    target_description: str | None = Field(
        default=None,
        max_length=300,
        validation_alias=AliasChoices("targetDescription", "target_description"),
    )
    # 目标分类（travel/career/skill/health/finance/relationship/other）。
    # 只在目标详情页「AI 生成规划」入口使用；不给则从 goal 上取，再兜底 other。
    category: str | None = Field(default=None, max_length=40)
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
    # 规划所属目标分类，前端据此换文案/图标（如「健康生活」的规划不叫「成长计划」）
    category: str | None = None
    goalId: str | None = None
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


# ── Sprint 8 Life Social: AI 好友推荐 + 团队规划 ─────────────────────
class FriendRecommendationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    interests: list[str] = []
    growth_direction: str | None = Field(
        default=None, validation_alias=AliasChoices("growthDirection", "growth_direction")
    )
    city: str | None = None
    goal_title: str | None = Field(default=None, validation_alias=AliasChoices("goalTitle", "goal_title"))
    bucket_titles: list[str] = Field(
        default_factory=list, validation_alias=AliasChoices("bucketTitles", "bucket_titles")
    )


class FriendRecommendationItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    friend_id: str = Field(validation_alias=AliasChoices("friendId", "friend_id"))
    reason: str = ""
    confidence: float = 0.5


class SharedGoalSuggestion(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str
    category: str = "other"
    description: str = ""


class FriendRecommendationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    recommendations: list[FriendRecommendationItem] = []
    shared_goal_suggestions: list[SharedGoalSuggestion] = []
    source: str = "ai"  # "ai" | "fallback"


class TeamPlanRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    shared_goal_id: str = Field(validation_alias=AliasChoices("sharedGoalId", "shared_goal_id"))


class TeamTaskItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str
    assignee: str = ""
    estimated_days: int = 1
    start_at: str | None = None


class TeamMilestone(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    milestone: str
    target_date: str | None = None


class TeamRiskItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    risk: str
    mitigation: str = ""


class TeamPlanResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    tasks: list[TeamTaskItem] = []
    timeline: list[TeamMilestone] = []
    risks: list[TeamRiskItem] = []
    collaboration_tip: str | None = None
    source: str = "ai"  # "ai" | "fallback"
