from datetime import date, datetime
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


# ── 对话 / 消息 ────────────────────────────────────────────────────
class ChatRequest(CamelModel):
    """AI 教练对话: 基于 conversation_id 续聊, 不传则新建会话."""

    conversation_id: str | None = Field(
        default=None, validation_alias=AliasChoices("conversationId", "conversation_id")
    )
    message: str = Field(min_length=1, max_length=4000)


class ToolCallInfo(CamelModel):
    tool: str
    result: dict[str, Any] | None = None


class MessageItem(CamelModel):
    id: str
    role: str
    content: str
    tool_calls: list[ToolCallInfo] = []
    created_at: str


class ChatResponse(CamelModel):
    conversation_id: str
    message: MessageItem
    title: str | None = None


class ConversationItem(CamelModel):
    id: str
    title: str | None = None
    summary: str | None = None
    last_message_at: str | None = None
    created_at: str


class ConversationDetail(CamelModel):
    conversation: ConversationItem
    messages: list[MessageItem] = []


# ── 今日建议 / 提醒 ────────────────────────────────────────────────
class CoachAdviceItem(CamelModel):
    """单条行动建议."""

    title: str
    description: str = ""
    priority: str = "medium"  # low | medium | high
    category: str = "general"  # goal | bucket | record | social | health | growth
    life_goal_id: str | None = None


class CoachReminder(CamelModel):
    """主动提醒项."""

    type: str  # streak | overdue | travel | backlog | achievement
    title: str
    detail: str = ""
    severity: str = "info"  # info | warning | urgent


class CoachAdviceResponse(CamelModel):
    date: str
    greeting: str | None = None
    advice: list[CoachAdviceItem] = []
    reminders: list[CoachReminder] = []
    motivation: str | None = None
    source: str = "ai"  # ai | fallback


# ── 周报 / 月报 ────────────────────────────────────────────────────
class ReviewResponse(CamelModel):
    period: str  # week | month
    title: str | None = None
    summary: str | None = None
    highlights: list[str] = []
    metrics: dict[str, Any] = {}
    suggestions: list[str] = []
    reflection: str | None = None
    source: str = "ai"


# ── 分析 ──────────────────────────────────────────────────────────
class AnalyzeRequest(CamelModel):
    topic: str = Field(min_length=1, max_length=300)
    conversation_id: str | None = Field(
        default=None, validation_alias=AliasChoices("conversationId", "conversation_id")
    )


class AnalyzeResponse(CamelModel):
    topic: str
    analysis: str
    references: list[dict[str, Any]] = []
    source: str = "ai"


# ── 长期记忆 ──────────────────────────────────────────────────────
class MemoryItem(CamelModel):
    id: str
    memory_type: str
    content: str
    importance: int = 5
    source: str = "ai"
    created_at: str
    updated_at: str | None = None


class MemoryCreate(CamelModel):
    memory_type: str = Field(
        validation_alias=AliasChoices("memoryType", "memory_type")
    )
    content: str = Field(min_length=1, max_length=1000)
    importance: int = Field(default=5, ge=1, le=10)
    source: str = "user"


class MemoryUpdate(CamelModel):
    content: str | None = None
    importance: int | None = Field(default=None, ge=1, le=10)


# ── 教练任务 ──────────────────────────────────────────────────────
class CoachTaskItem(CamelModel):
    id: str
    title: str
    description: str | None = None
    status: str = "todo"
    priority: str = "medium"
    source: str = "coach"
    life_goal_id: str | None = None
    due_date: str | None = None
    created_at: str


class CoachTaskUpdate(CamelModel):
    status: str | None = None  # todo | done | postponed
    priority: str | None = None
