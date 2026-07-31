from app.core.repository import BaseRepository
from app.db.models import AIContent


class AIContentRepository(BaseRepository[AIContent]):
    def __init__(self, db):
        super().__init__(db, AIContent)

    def create(
        self,
        user_id: str,
        content_type: str,
        input_json: dict,
        output_json: dict,
        provider: str,
        model: str,
    ) -> AIContent:
        record = AIContent(
            user_id=user_id,
            content_type=content_type,
            input_json=input_json,
            output_json=output_json,
            provider=provider,
            model=model,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_by_id(self, user_id: str, content_id: str) -> AIContent | None:
        return (
            self.db.query(AIContent)
            .filter(AIContent.id == content_id, AIContent.user_id == user_id)
            .first()
        )

    def get_by_user(self, user_id: str, limit: int = 50) -> list[AIContent]:
        return (
            self.db.query(AIContent)
            .filter(AIContent.user_id == user_id)
            .order_by(AIContent.created_at.desc())
            .limit(limit)
            .all()
        )

    def list_by_type(self, user_id: str, content_type: str, limit: int = 50) -> list[AIContent]:
        return (
            self.db.query(AIContent)
            .filter(AIContent.user_id == user_id, AIContent.content_type == content_type)
            .order_by(AIContent.created_at.desc())
            .limit(limit)
            .all()
        )
