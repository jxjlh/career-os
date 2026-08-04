"""聊天模块: 私聊 + 群聊 + 图片发送/下载."""

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import (
    ChatConversation,
    ChatMessage,
    ConversationMember,
    MessageRead,
    Profile,
    UserProfile,
)
from app.services.storage import StorageService

router = APIRouter(tags=["chat"])


# ── Schemas ─────────────────────────────────────────────────────────────
class CreateDirectConversation(BaseModel):
    user_id: str  # 对方用户ID


class CreateGroupConversation(BaseModel):
    name: str
    member_ids: list[str] = []


class SendMessage(BaseModel):
    content: str | None = None
    message_type: str = "text"  # text | image
    image_url: str | None = None
    reply_to_id: str | None = None


class AddGroupMembers(BaseModel):
    user_ids: list[str]


# ── Helpers ─────────────────────────────────────────────────────────────
def _profile_to_dict(p: Profile) -> dict:
    """将 Profile 转为前端友好的 dict."""
    return {
        "id": p.id,
        "displayName": p.display_name,
        "avatarUrl": p.avatar_url,
    }


def _conversation_to_dict(
    conv: ChatConversation,
    current_user_id: str,
    members: list[ConversationMember] | None = None,
) -> dict:
    """将会话转为 dict, 包含未读数和最后消息."""
    result = {
        "id": conv.id,
        "type": conv.conversation_type,
        "name": conv.name,
        "avatarUrl": conv.avatar_url,
        "lastMessageAt": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "lastMessage": conv.last_message_preview,
        "createdAt": conv.created_at.isoformat(),
    }

    # 未读数计算
    unread_count = 0
    member_info = None
    if members:
        for m in members:
            if m.user_id == current_user_id:
                member_info = m
                break
    if member_info and member_info.last_read_at and conv.last_message_at:
        # 未读数 = 最后消息时间 > 已读时间 的消息数
        # 简化处理: 直接返回布尔值
        unread_count = 1 if conv.last_message_at > member_info.last_read_at else 0

    result["unread"] = unread_count

    # 私聊: 补充对方信息作为 name/avatar
    if conv.conversation_type == "direct" and members:
        other_member = next((m for m in members if m.user_id != current_user_id), None)
        if other_member and other_member.user:
            other_profile = other_member.user
            result["name"] = other_profile.display_name or other_profile.email
            result["avatarUrl"] = other_profile.avatar_url
            result["otherUserId"] = other_profile.id

    return result


def _message_to_dict(msg: ChatMessage, current_user_id: str) -> dict:
    """将消息转为 dict."""
    return {
        "id": msg.id,
        "conversationId": msg.conversation_id,
        "senderId": msg.sender_id,
        "sender": _profile_to_dict(msg.sender) if msg.sender else None,
        "type": msg.message_type,
        "content": msg.content,
        "imageUrl": msg.image_url,
        "imageWidth": msg.image_width,
        "imageHeight": msg.image_height,
        "replyToId": msg.reply_to_id,
        "createdAt": msg.created_at.isoformat(),
        "deleted": msg.deleted_at is not None,
    }


# ── 会话列表 ────────────────────────────────────────────────────────────
@router.get("/chat/conversations")
def list_conversations(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """获取当前用户的所有会话列表（私聊+群聊）."""
    # 查询用户所属的所有会话
    memberships = (
        db.query(ConversationMember)
        .options(
            joinedload(ConversationMember.conversation),
            joinedload(ConversationMember.user),
        )
        .filter(ConversationMember.user_id == current_user.id)
        .all()
    )

    conv_ids = [m.conversation_id for m in memberships]
    if not conv_ids:
        return {"data": []}

    # 批量查询所有成员（用于私聊显示对方信息）
    all_members = (
        db.query(ConversationMember)
        .options(joinedload(ConversationMember.user))
        .filter(ConversationMember.conversation_id.in_(conv_ids))
        .all()
    )

    # 按会话ID分组
    members_by_conv: dict[str, list[ConversationMember]] = {}
    for m in all_members:
        members_by_conv.setdefault(m.conversation_id, []).append(m)

    result = []
    for m in memberships:
        conv = m.conversation
        members = members_by_conv.get(conv.id, [])
        result.append(_conversation_to_dict(conv, current_user.id, members))

    # 按最后消息时间倒序
    result.sort(key=lambda x: x.get("lastMessageAt") or "", reverse=True)

    return {"data": result}


@router.get("/chat/conversations/{conversation_id}")
def get_conversation(
    conversation_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """获取单个会话详情."""
    member = (
        db.query(ConversationMember)
        .options(joinedload(ConversationMember.conversation))
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(404, "会话不存在")

    # 获取所有成员
    members = (
        db.query(ConversationMember)
        .options(joinedload(ConversationMember.user))
        .filter(ConversationMember.conversation_id == conversation_id)
        .all()
    )

    return {"data": _conversation_to_dict(member.conversation, current_user.id, members)}


# ── 私聊 ────────────────────────────────────────────────────────────────
@router.post("/chat/direct", status_code=201)
def create_or_get_direct_conversation(
    payload: CreateDirectConversation,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """创建或获取与某用户的私聊会话."""
    if payload.user_id == current_user.id:
        raise HTTPException(400, "不能与自己创建会话")

    # 查找已存在的私聊
    existing = (
        db.query(ConversationMember)
        .join(ChatConversation, ConversationMember.conversation_id == ChatConversation.id)
        .filter(
            ChatConversation.conversation_type == "direct",
            ConversationMember.user_id == current_user.id,
        )
        .all()
    )

    for m in existing:
        # 查找对方的成员记录
        other = (
            db.query(ConversationMember)
            .filter(
                ConversationMember.conversation_id == m.conversation_id,
                ConversationMember.user_id == payload.user_id,
            )
            .first()
        )
        if other:
            # 已存在, 返回
            conv = db.query(ChatConversation).get(m.conversation_id)
            members = (
                db.query(ConversationMember)
                .options(joinedload(ConversationMember.user))
                .filter(ConversationMember.conversation_id == conv.id)
                .all()
            )
            return {"data": _conversation_to_dict(conv, current_user.id, members)}

    # 创建新的私聊会话
    conv = ChatConversation(conversation_type="direct")
    db.add(conv)
    db.flush()

    # 添加两个成员
    db.add(ConversationMember(conversation_id=conv.id, user_id=current_user.id))
    db.add(ConversationMember(conversation_id=conv.id, user_id=payload.user_id))
    db.commit()

    # 获取成员信息
    members = (
        db.query(ConversationMember)
        .options(joinedload(ConversationMember.user))
        .filter(ConversationMember.conversation_id == conv.id)
        .all()
    )

    return {"data": _conversation_to_dict(conv, current_user.id, members)}


# ── 群聊 ────────────────────────────────────────────────────────────────
@router.post("/chat/groups", status_code=201)
def create_group(
    payload: CreateGroupConversation,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """创建群聊."""
    if not payload.name:
        raise HTTPException(400, "群名不能为空")

    conv = ChatConversation(
        conversation_type="group",
        name=payload.name,
        owner_id=current_user.id,
    )
    db.add(conv)
    db.flush()

    # 添加创建者（群主）
    db.add(
        ConversationMember(
            conversation_id=conv.id,
            user_id=current_user.id,
            role="owner",
        )
    )

    # 添加其他成员
    for uid in payload.member_ids:
        if uid != current_user.id:
            db.add(
                ConversationMember(
                    conversation_id=conv.id,
                    user_id=uid,
                )
            )

    db.commit()

    members = (
        db.query(ConversationMember)
        .options(joinedload(ConversationMember.user))
        .filter(ConversationMember.conversation_id == conv.id)
        .all()
    )

    return {"data": _conversation_to_dict(conv, current_user.id, members)}


@router.post("/chat/groups/{conversation_id}/members", status_code=201)
def add_group_members(
    conversation_id: str,
    payload: AddGroupMembers,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """添加群成员."""
    # 验证权限
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member or member.role not in ("owner", "admin"):
        raise HTTPException(403, "无权操作")

    conv = db.query(ChatConversation).get(conversation_id)
    if not conv or conv.conversation_type != "group":
        raise HTTPException(404, "群不存在")

    added = []
    for uid in payload.user_ids:
        # 检查是否已存在
        exists = (
            db.query(ConversationMember)
            .filter(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == uid,
            )
            .first()
        )
        if not exists:
            db.add(ConversationMember(conversation_id=conversation_id, user_id=uid))
            added.append(uid)

    # 发送系统消息
    if added:
        system_msg = ChatMessage(
            conversation_id=conversation_id,
            sender_id=None,
            message_type="system",
            system_action="added_members",
            system_meta={"added": added, "by": current_user.id},
        )
        db.add(system_msg)

    db.commit()

    return {"data": {"added": added}}


@router.delete("/chat/groups/{conversation_id}/members/{user_id}")
def remove_group_member(
    conversation_id: str,
    user_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """移除群成员（或退出群聊）."""
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(404, "成员不存在")

    # 可以移除自己（退群）或有权限的人移除他人
    if user_id != current_user.id and member.role not in ("owner", "admin"):
        raise HTTPException(403, "无权操作")

    target = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
        .first()
    )
    if target:
        db.delete(target)

        # 系统消息
        action = "left" if user_id == current_user.id else "removed"
        system_msg = ChatMessage(
            conversation_id=conversation_id,
            sender_id=None,
            message_type="system",
            system_action=action,
            system_meta={"user_id": user_id},
        )
        db.add(system_msg)

    db.commit()

    return {"data": {"ok": True}}


# ── 消息 ────────────────────────────────────────────────────────────────
@router.get("/chat/conversations/{conversation_id}/messages")
def list_messages(
    conversation_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    before: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> dict:
    """获取会话消息列表（支持分页）."""
    # 验证成员
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(404, "会话不存在")

    query = (
        db.query(ChatMessage)
        .options(joinedload(ChatMessage.sender))
        .filter(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.deleted_at.is_(None),
        )
        .order_by(desc(ChatMessage.created_at))
    )

    if before:
        # cursor-based pagination
        before_dt = datetime.fromisoformat(before)
        query = query.filter(ChatMessage.created_at < before_dt)

    messages = query.limit(limit).all()

    # 标记已读
    if messages:
        member.last_read_at = datetime.utcnow()
        db.commit()

    return {
        "data": [_message_to_dict(m, current_user.id) for m in reversed(messages)],
        "hasMore": len(messages) == limit,
    }


@router.post("/chat/conversations/{conversation_id}/messages", status_code=201)
def send_message(
    conversation_id: str,
    payload: SendMessage,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """发送消息."""
    # 验证成员
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(404, "会话不存在")

    if not payload.content and not payload.image_url:
        raise HTTPException(400, "消息内容不能为空")

    msg = ChatMessage(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        message_type=payload.message_type,
        content=payload.content,
        image_url=payload.image_url,
        reply_to_id=payload.reply_to_id,
    )
    db.add(msg)

    # 更新会话最后消息
    conv = db.query(ChatConversation).get(conversation_id)
    if conv:
        conv.last_message_at = datetime.utcnow()
        preview = payload.content or "[图片]"
        conv.last_message_preview = preview[:500]

    db.commit()
    db.refresh(msg)

    return {"data": _message_to_dict(msg, current_user.id)}


@router.post("/chat/conversations/{conversation_id}/images", status_code=201)
def upload_chat_image(
    conversation_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    file: Annotated[UploadFile, File()],
) -> dict:
    """上传聊天图片."""
    # 验证成员
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(404, "会话不存在")

    # 上传到存储
    storage = StorageService()
    url = storage.upload_chat_image(file.file, file.filename or "image.jpg", current_user.id, conversation_id)

    return {"data": {"url": url}}


@router.delete("/chat/messages/{message_id}")
def delete_message(
    message_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """删除消息（软删除）."""
    msg = db.query(ChatMessage).get(message_id)
    if not msg:
        raise HTTPException(404, "消息不存在")

    if msg.sender_id != current_user.id:
        raise HTTPException(403, "无权删除")

    msg.deleted_at = datetime.utcnow()
    db.commit()

    return {"data": {"ok": True}}


# ── 群成员列表 ───────────────────────────────────────────────────────────
@router.get("/chat/groups/{conversation_id}/members")
def list_group_members(
    conversation_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """获取群成员列表."""
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(404, "群不存在")

    members = (
        db.query(ConversationMember)
        .options(joinedload(ConversationMember.user))
        .filter(ConversationMember.conversation_id == conversation_id)
        .all()
    )

    result = []
    for m in members:
        if m.user:
            result.append({
                "id": m.user.id,
                "displayName": m.user.display_name,
                "avatarUrl": m.user.avatar_url,
                "role": m.role,
                "joinedAt": m.joined_at.isoformat(),
            })

    return {"data": result}