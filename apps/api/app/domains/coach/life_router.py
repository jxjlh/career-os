"""Life AI Coach 路由 (Sprint 9).

注: 原 ``router.py`` 保留为职业教练 (Career OS) 路由, 路径前缀 ``/coach/*``.
本模块为 Sprint 9 新增的 Life AI Coach, 路径前缀 ``/ai/coach/*``, 与原模块隔离.
服务层抛出的 ``AppError`` 由全局异常处理器统一转换为 HTTP 响应.

AI 能力:
- POST /ai/coach/chat          多轮对话 (基于 LifeOS 全量上下文)
- POST /ai/coach/advice        今日建议 + 主动提醒
- POST /ai/coach/analyze       深度分析 (引用 Goal/Bucket/Map/YearReview)
- POST /ai/coach/weekly-review 周复盘
- POST /ai/coach/monthly-review 月复盘

会话 / 记忆 / 任务 管理:
- GET    /ai/coach/conversations
- GET    /ai/coach/conversations/{conversation_id}
- DELETE /ai/coach/conversations/{conversation_id}
- GET    /ai/coach/memory
- POST   /ai/coach/memory
- PATCH  /ai/coach/memory/{memory_id}
- DELETE /ai/coach/memory/{memory_id}
- GET    /ai/coach/tasks
- PATCH  /ai/coach/tasks/{task_id}
- DELETE /ai/coach/tasks/{task_id}
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.coach.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ChatRequest,
    ChatResponse,
    CoachAdviceResponse,
    CoachTaskItem,
    CoachTaskUpdate,
    ConversationDetail,
    ConversationItem,
    MemoryCreate,
    MemoryItem,
    MemoryUpdate,
    ReviewResponse,
)
from app.domains.coach.service import (
    CoachAdviceService,
    CoachAnalyzeService,
    CoachChatService,
    CoachConversationService,
    CoachMemoryService,
    CoachReviewService,
    CoachTaskService,
)

router = APIRouter(tags=["ai-coach"])


# ── AI 能力 ────────────────────────────────────────────────────────
@router.post("/ai/coach/chat", response_model=ChatResponse)
async def coach_chat(
    payload: ChatRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatResponse:
    return await CoachChatService(db).chat(
        current_user.id, payload.conversation_id, payload.message
    )


@router.post("/ai/coach/advice", response_model=CoachAdviceResponse)
async def coach_advice(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CoachAdviceResponse:
    return await CoachAdviceService(db).advice(current_user.id)


@router.post("/ai/coach/analyze", response_model=AnalyzeResponse)
async def coach_analyze(
    payload: AnalyzeRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AnalyzeResponse:
    return await CoachAnalyzeService(db).analyze(
        current_user.id, payload.topic, payload.conversation_id
    )


@router.post("/ai/coach/weekly-review", response_model=ReviewResponse)
async def coach_weekly_review(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ReviewResponse:
    return await CoachReviewService(db).review(current_user.id, period="week")


@router.post("/ai/coach/monthly-review", response_model=ReviewResponse)
async def coach_monthly_review(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ReviewResponse:
    return await CoachReviewService(db).review(current_user.id, period="month")


# ── 会话管理 ────────────────────────────────────────────────────────
@router.get("/ai/coach/conversations", response_model=list[ConversationItem])
def list_conversations(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ConversationItem]:
    return CoachConversationService(db).list(current_user.id)


@router.get(
    "/ai/coach/conversations/{conversation_id}",
    response_model=ConversationDetail,
)
def get_conversation(
    conversation_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ConversationDetail:
    return CoachConversationService(db).detail(current_user.id, conversation_id)


@router.delete("/ai/coach/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    CoachConversationService(db).delete(current_user.id, conversation_id)


# ── 长期记忆 ──────────────────────────────────────────────────────
@router.get("/ai/coach/memory", response_model=list[MemoryItem])
def list_memory(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[MemoryItem]:
    return CoachMemoryService(db).list(current_user.id)


@router.post("/ai/coach/memory", response_model=MemoryItem, status_code=201)
def create_memory(
    payload: MemoryCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MemoryItem:
    return CoachMemoryService(db).create(current_user.id, payload)


@router.patch("/ai/coach/memory/{memory_id}", response_model=MemoryItem)
def update_memory(
    memory_id: str,
    payload: MemoryUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MemoryItem:
    return CoachMemoryService(db).update(current_user.id, memory_id, payload)


@router.delete("/ai/coach/memory/{memory_id}", status_code=204)
def delete_memory(
    memory_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    CoachMemoryService(db).delete(current_user.id, memory_id)


# ── 教练任务 ───────────────────────────────────────────────────────
@router.get("/ai/coach/tasks", response_model=list[CoachTaskItem])
def list_tasks(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    status: Annotated[str | None, Query(description="按状态过滤: todo | done | postponed")] = None,
) -> list[CoachTaskItem]:
    return CoachTaskService(db).list(current_user.id, status=status)


@router.patch("/ai/coach/tasks/{task_id}", response_model=CoachTaskItem)
def update_task(
    task_id: str,
    payload: CoachTaskUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CoachTaskItem:
    return CoachTaskService(db).update(current_user.id, task_id, payload)


@router.delete("/ai/coach/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    CoachTaskService(db).delete(current_user.id, task_id)
