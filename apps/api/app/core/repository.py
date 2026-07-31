from sqlalchemy.orm import Session

from app.db.base import Base


class BaseRepository[ModelT: Base]:
    """Generic SQLAlchemy repository used by feature services."""

    def __init__(self, db: Session, model: type[ModelT]) -> None:
        self.db = db
        self.model = model

    def get(self, entity_id: str) -> ModelT | None:
        return self.db.get(self.model, entity_id)

    def list(self, **filters: object) -> list[ModelT]:
        query = self.db.query(self.model)
        for key, value in filters.items():
            query = query.filter(getattr(self.model, key) == value)
        return query.all()

    def add(self, entity: ModelT) -> ModelT:
        self.db.add(entity)
        return entity

    def commit(self) -> None:
        self.db.commit()
