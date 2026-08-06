from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Notification, Profile

router = APIRouter(tags=["notifications"])


@router.get("/notifications")
def list_notifications(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    items = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "data": [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "readAt": n.read_at.isoformat() if n.read_at else None,
                "link": n.link,
                "createdAt": n.created_at.isoformat(),
            }
            for n in items
        ]
    }


@router.post("/notifications/{notification_id}/read")
def mark_as_read(
    notification_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    n = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if n:
        n.read_at = datetime.utcnow()
        db.commit()
    return {"data": {"ok": True}}


@router.post("/notifications/read-all")
def mark_all_as_read(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
        .update({"read_at": datetime.utcnow()})
    )
    db.commit()
    return {"data": {"ok": True}}


@router.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    n = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if n:
        db.delete(n)
        db.commit()
    return {"data": {"ok": True}}
