from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import AiChat, AiMessage, Profile, UserSkill
from app.providers.ai import registry as ai_registry

router = APIRouter(tags=["coach"])


class ChatCreate(BaseModel):
    channel: str = "coach"
    title: str | None = None
    context: dict = {}


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


def chat_dict(chat: AiChat) -> dict:
    return {
        "id": chat.id,
        "channel": chat.channel,
        "title": chat.title,
        "context": chat.context,
        "createdAt": chat.created_at.isoformat(),
    }


def message_dict(message: AiMessage) -> dict:
    return {
        "id": message.id,
        "chatId": message.chat_id,
        "role": message.role,
        "content": message.content,
        "toolCalls": message.tool_calls,
        "provider": message.provider,
        "model": message.model,
        "createdAt": message.created_at.isoformat(),
    }


def get_owned_chat(db: Session, user_id: str, chat_id: str) -> AiChat:
    chat = db.query(AiChat).filter(AiChat.id == chat_id, AiChat.user_id == user_id).first()
    if chat is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Chat not found"})
    return chat


@router.get("/coach/chats")
def list_chats(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    chats = (
        db.query(AiChat)
        .filter(AiChat.user_id == current_user.id)
        .order_by(AiChat.created_at.desc())
        .all()
    )
    return {"data": [chat_dict(c) for c in chats]}


@router.post("/coach/chats", status_code=201)
def create_chat(
    payload: ChatCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    chat = AiChat(
        user_id=current_user.id,
        channel=payload.channel,
        title=payload.title or "AI Coach",
        context=payload.context,
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return {"data": chat_dict(chat)}


@router.get("/coach/chats/{chat_id}")
def get_chat(
    chat_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": chat_dict(get_owned_chat(db, current_user.id, chat_id))}


@router.delete("/coach/chats/{chat_id}", status_code=204)
def delete_chat(
    chat_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    chat = get_owned_chat(db, current_user.id, chat_id)
    db.delete(chat)
    db.commit()


@router.get("/coach/chats/{chat_id}/messages")
def list_messages(
    chat_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    get_owned_chat(db, current_user.id, chat_id)
    messages = (
        db.query(AiMessage)
        .filter(AiMessage.chat_id == chat_id)
        .order_by(AiMessage.created_at)
        .all()
    )
    return {"data": [message_dict(m) for m in messages]}


@router.post("/coach/chats/{chat_id}/messages", status_code=201)
async def send_message(
    chat_id: str,
    payload: MessageCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    get_owned_chat(db, current_user.id, chat_id)
    user_message = AiMessage(chat_id=chat_id, user_id=current_user.id, role="user", content=payload.content)
    db.add(user_message)
    db.flush()

    skill_count = db.query(UserSkill).filter(UserSkill.user_id == current_user.id).count()
    history = (
        db.query(AiMessage)
        .filter(AiMessage.chat_id == chat_id)
        .order_by(AiMessage.created_at.desc())
        .limit(6)
        .all()
    )
    history.reverse()

    system_prompt = (
        "你是 Career OS 的 AI 职业教练，基于用户的全量上下文"
        "（技能矩阵、职业目标、学习历史、项目、面试记录）给出具体、可执行、个性化的建议。"
        f"用户当前职位：{current_user.current_title or '未知'}；"
        f"目标职位：{current_user.target_title or '未设定'}；"
        f"已录入技能：{skill_count} 项。"
        "回复用中文，控制在 300 字以内，聚焦下一步行动。"
    )
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for msg in history:
        if msg.role in ("user", "assistant") and msg.content:
            messages.append({"role": msg.role, "content": msg.content})

    provider = ai_registry.get_ai_provider()
    try:
        reply = await provider.complete(messages, temperature=0.6, max_tokens=512)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail={"code": "AI_UNAVAILABLE", "message": f"AI 服务暂时不可用，请稍后重试。原因：{exc}"},
        ) from exc

    if not reply:
        reply = "（AI 未返回内容，请重试。）"

    assistant_message = AiMessage(
        chat_id=chat_id,
        user_id=current_user.id,
        role="assistant",
        content=reply,
        provider=provider.name,
        model=get_settings().spark_model,
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    return {"data": {"userMessage": message_dict(user_message), "assistantMessage": message_dict(assistant_message)}}


@router.get("/coach/context")
def coach_context(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    skill_count = db.query(UserSkill).filter(UserSkill.user_id == current_user.id).count()
    return {
        "data": {
            "dataSources": ["skills", "learning_history", "projects", "jobs", "interviews"],
            "includedAt": current_user.updated_at.isoformat() if current_user.updated_at else None,
            "targetTitle": current_user.target_title,
            "skillCount": skill_count,
        }
    }
