from datetime import datetime

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.repository import BaseRepository
from app.db.models import AIConversation, AIMessage, CoachMemory, CoachTask


class ConversationRepository(BaseRepository[AIConversation]):
    def __init__(self, db: Session):
        super().__init__(db, AIConversation)

    def get_owned(self, user_id: str, conversation_id: str) -> AIConversation | None:
        return (
            self.db.query(AIConversation)
            .filter(AIConversation.id == conversation_id, AIConversation.user_id == user_id)
            .first()
        )

    def list_by_user(self, user_id: str, limit: int = 50) -> list[AIConversation]:
        return (
            self.db.query(AIConversation)
            .filter(AIConversation.user_id == user_id)
            .order_by(desc(AIConversation.last_message_at), desc(AIConversation.created_at))
            .limit(limit)
            .all()
        )

    def create(self, user_id: str, title: str | None = None) -> AIConversation:
        conv = AIConversation(user_id=user_id, title=title)
        self.db.add(conv)
        self.db.commit()
        self.db.refresh(conv)
        return conv

    def touch(self, conversation_id: str) -> None:
        conv = self.db.get(AIConversation, conversation_id)
        if conv is not None:
            conv.last_message_at = datetime.utcnow()
            self.db.commit()


class MessageRepository(BaseRepository[AIMessage]):
    def __init__(self, db: Session):
        super().__init__(db, AIMessage)

    def list_by_conversation(self, conversation_id: str, limit: int = 30) -> list[AIMessage]:
        return (
            self.db.query(AIMessage)
            .filter(AIMessage.conversation_id == conversation_id)
            .order_by(AIMessage.created_at.desc())
            .limit(limit)
            .all()
        )[::-1]  # 反转为时间正序, 便于拼装上下文

    def add(
        self,
        conversation_id: str,
        role: str,
        content: str,
        tool_calls: list[dict] | None = None,
        tokens: int = 0,
        provider: str | None = None,
        model: str | None = None,
    ) -> AIMessage:
        msg = AIMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            tool_calls=tool_calls or [],
            tokens=tokens,
            provider=provider,
            model=model,
        )
        self.db.add(msg)
        self.db.commit()
        self.db.refresh(msg)
        return msg


class MemoryRepository(BaseRepository[CoachMemory]):
    def __init__(self, db: Session):
        super().__init__(db, CoachMemory)

    def list_by_user(self, user_id: str) -> list[CoachMemory]:
        return (
            self.db.query(CoachMemory)
            .filter(CoachMemory.user_id == user_id)
            .order_by(desc(CoachMemory.importance), desc(CoachMemory.updated_at))
            .all()
        )

    def list_by_type(self, user_id: str, memory_type: str) -> list[CoachMemory]:
        return (
            self.db.query(CoachMemory)
            .filter(CoachMemory.user_id == user_id, CoachMemory.memory_type == memory_type)
            .order_by(desc(CoachMemory.importance))
            .all()
        )

    def get_owned(self, user_id: str, memory_id: str) -> CoachMemory | None:
        return (
            self.db.query(CoachMemory)
            .filter(CoachMemory.id == memory_id, CoachMemory.user_id == user_id)
            .first()
        )

    def upsert_by_type(self, user_id: str, memory_type: str, content: str, importance: int = 5) -> CoachMemory:
        """同类型记忆合并更新, 避免重复堆积."""
        existing = (
            self.db.query(CoachMemory)
            .filter(CoachMemory.user_id == user_id, CoachMemory.memory_type == memory_type)
            .order_by(desc(CoachMemory.importance))
            .first()
        )
        if existing is not None:
            existing.content = content
            existing.importance = max(existing.importance, importance)
            self.db.commit()
            self.db.refresh(existing)
            return existing
        mem = CoachMemory(
            user_id=user_id,
            memory_type=memory_type,
            content=content,
            importance=importance,
            source="ai",
        )
        self.db.add(mem)
        self.db.commit()
        self.db.refresh(mem)
        return mem

    def create(
        self, user_id: str, memory_type: str, content: str, importance: int = 5, source: str = "ai"
    ) -> CoachMemory:
        mem = CoachMemory(
            user_id=user_id,
            memory_type=memory_type,
            content=content,
            importance=importance,
            source=source,
        )
        self.db.add(mem)
        self.db.commit()
        self.db.refresh(mem)
        return mem


class CoachTaskRepository(BaseRepository[CoachTask]):
    def __init__(self, db: Session):
        super().__init__(db, CoachTask)

    def list_by_user(self, user_id: str, status: str | None = None) -> list[CoachTask]:
        query = self.db.query(CoachTask).filter(CoachTask.user_id == user_id)
        if status:
            query = query.filter(CoachTask.status == status)
        return query.order_by(CoachTask.created_at.desc()).all()

    def get_owned(self, user_id: str, task_id: str) -> CoachTask | None:
        return (
            self.db.query(CoachTask)
            .filter(CoachTask.id == task_id, CoachTask.user_id == user_id)
            .first()
        )

    def create(
        self,
        user_id: str,
        title: str,
        description: str | None = None,
        priority: str = "medium",
        source: str = "coach",
        life_goal_id: str | None = None,
        due_date=None,
    ) -> CoachTask:
        task = CoachTask(
            user_id=user_id,
            title=title,
            description=description,
            priority=priority,
            source=source,
            life_goal_id=life_goal_id,
            due_date=due_date,
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def delete(self, task: CoachTask) -> None:
        self.db.delete(task)
        self.db.commit()
