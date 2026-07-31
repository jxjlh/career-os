from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class ProfileSummary(CamelModel):
    id: str
    display_name: str
    avatar_url: str | None = None
    current_title: str | None = None


class FriendRequestCreate(CamelModel):
    """发起好友申请: 按邮箱或用户 ID."""

    to_user_id: str | None = Field(default=None, validation_alias=AliasChoices("toUserId", "to_user_id"))
    email: str | None = None
    message: str | None = None


class FriendRequestItem(CamelModel):
    id: str
    from_user: ProfileSummary
    message: str | None = None
    status: str = "pending"
    created_at: str


class FriendItem(CamelModel):
    profile: ProfileSummary
    created_at: str


class ProfileSearchItem(CamelModel):
    id: str
    display_name: str
    avatar_url: str | None = None
    current_title: str | None = None
    is_friend: bool = False
    request_pending: bool = False


class CreatePostRequest(CamelModel):
    content: str | None = None
    photos: list[str] = []
    videos: list[str] = []
    visibility: str = "friends"  # public/friends/private/link
    life_record_id: str | None = Field(default=None, validation_alias=AliasChoices("lifeRecordId", "life_record_id"))
    bucket_item_id: str | None = Field(default=None, validation_alias=AliasChoices("bucketItemId", "bucket_item_id"))


class CommentItem(CamelModel):
    id: str
    user: ProfileSummary
    content: str
    created_at: str


class PostItem(CamelModel):
    id: str
    user: ProfileSummary
    content: str | None = None
    photos: list[str] = []
    videos: list[str] = []
    visibility: str = "friends"
    likes_count: int = 0
    comments_count: int = 0
    liked_by_me: bool = False
    life_record_id: str | None = None
    bucket_item_id: str | None = None
    created_at: str


class CreateCommentRequest(CamelModel):
    content: str


class CreateSharedGoalRequest(CamelModel):
    life_goal_id: str = Field(validation_alias=AliasChoices("lifeGoalId", "life_goal_id"))
    visibility: str = "friends"
    invite_user_ids: list[str] = Field(
        default_factory=list, validation_alias=AliasChoices("inviteUserIds", "invite_user_ids")
    )


class SharedGoalItem(CamelModel):
    id: str
    life_goal_id: str
    life_goal_title: str | None = None
    owner: ProfileSummary
    visibility: str = "friends"
    share_code: str | None = None
    members_count: int = 0
    joined: bool = False
    created_at: str


class RankingItem(CamelModel):
    user: ProfileSummary
    rank: int
    value: int | float = 0
    metric: str
    extra: dict | None = None


class RankingResponse(CamelModel):
    metric: str
    period: str
    items: list[RankingItem] = []


class SocialOverview(CamelModel):
    friends_count: int = 0
    pending_requests: int = 0
    shared_goals_count: int = 0
    today_growth: int = 0  # 今日记录/动态数
    checkin_streak: int = 0
    friends_recent_completions: list[dict] = []
