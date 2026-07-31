from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import AiChat, AiMessage, Profile, UserSkill

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
def send_message(
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
    reply = (
        f"我结合了你的技能矩阵（已覆盖 {skill_count} 项）与职业目标。建议下一步："
        "1) 完成一个实战项目；2) 输出作品集；3) 用模拟面试验证掌握程度。"
    )
    assistant_message = AiMessage(
        chat_id=chat_id,
        user_id=current_user.id,
        role="assistant",
        content=reply,
        provider="mock",
        model="Spark-X2-Flash",
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
