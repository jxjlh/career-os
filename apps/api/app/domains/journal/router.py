from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import DailyJournal, Profile

router = APIRouter(tags=["journal"])

# 时间段定义
TIME_SLOTS = ["morning", "afternoon", "evening", "night"]


# ── Schemas ────────────────────────────────────────────────────────

class JournalCreate(BaseModel):
    mood_index: int = Field(ge=0, le=4)
    content: str | None = None
    tags: list[str] = Field(default_factory=list)
    goal_id: str | None = None
    skill_id: str | None = None
    time_slot: str = Field(default="morning", pattern="^(morning|afternoon|evening|night)$")
    journal_date: str | None = None  # YYYY-MM-DD, 默认今天


class JournalUpdate(BaseModel):
    mood_index: int | None = Field(default=None, ge=0, le=4)
    content: str | None = None
    tags: list[str] | None = None
    goal_id: str | None = None
    skill_id: str | None = None


# ── Helpers ────────────────────────────────────────────────────────

def _to_dict(j: DailyJournal) -> dict:
    return {
        "id": j.id,
        "journalDate": j.journal_date.isoformat(),
        "timeSlot": j.time_slot,
        "moodIndex": j.mood_index,
        "content": j.content,
        "tags": j.tags,
        "goalId": j.goal_id,
        "skillId": j.skill_id,
        "createdAt": j.created_at.isoformat() if j.created_at else None,
        "updatedAt": j.updated_at.isoformat() if j.updated_at else None,
    }


# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/journal/month")
def list_month_journals(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: int = Query(..., description="Year, e.g. 2026"),
    month: int = Query(..., ge=1, le=12, description="Month 1-12"),
) -> dict:
    """获取指定月份的所有日记. 用于日历渲染."""
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    rows = (
        db.query(DailyJournal)
        .filter(
            DailyJournal.user_id == current_user.id,
            DailyJournal.journal_date >= start_date,
            DailyJournal.journal_date < end_date,
        )
        .order_by(DailyJournal.journal_date, DailyJournal.time_slot)
        .all()
    )

    return {
        "data": {
            "year": year,
            "month": month,
            "journals": [_to_dict(j) for j in rows],
        }
    }


@router.get("/journal/{journal_date}")
def get_journal_by_date(
    journal_date: date,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """获取指定日期的所有时间段日记. 返回列表."""
    rows = (
        db.query(DailyJournal)
        .filter(
            DailyJournal.user_id == current_user.id,
            DailyJournal.journal_date == journal_date,
        )
        .order_by(
            # 按时间段排序: morning → afternoon → evening → night
            DailyJournal.time_slot,
        )
        .all()
    )
    return {"data": [_to_dict(j) for j in rows]}


@router.post("/journal")
def create_journal(
    payload: JournalCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """创建/更新某个时间段的日记. 按 (date, time_slot) upsert."""
    # 解析日期, 默认今天
    if payload.journal_date:
        try:
            target_date = date.fromisoformat(payload.journal_date)
        except ValueError:
            raise HTTPException(status_code=422, detail={"code": "INVALID_DATE", "message": "日期格式应为 YYYY-MM-DD"})
    else:
        target_date = date.today()

    existing = (
        db.query(DailyJournal)
        .filter(
            DailyJournal.user_id == current_user.id,
            DailyJournal.journal_date == target_date,
            DailyJournal.time_slot == payload.time_slot,
        )
        .first()
    )
    if existing:
        existing.mood_index = payload.mood_index
        existing.content = payload.content
        existing.tags = payload.tags
        existing.goal_id = payload.goal_id
        existing.skill_id = payload.skill_id
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return {"data": _to_dict(existing)}

    j = DailyJournal(
        user_id=current_user.id,
        journal_date=target_date,
        time_slot=payload.time_slot,
        mood_index=payload.mood_index,
        content=payload.content,
        tags=payload.tags,
        goal_id=payload.goal_id,
        skill_id=payload.skill_id,
    )
    db.add(j)
    db.commit()
    db.refresh(j)
    return {"data": _to_dict(j)}


@router.put("/journal/{journal_id}")
def update_journal(
    journal_id: str,
    payload: JournalUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    j = (
        db.query(DailyJournal)
        .filter(DailyJournal.id == journal_id, DailyJournal.user_id == current_user.id)
        .first()
    )
    if j is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Journal not found"})

    if payload.mood_index is not None:
        j.mood_index = payload.mood_index
    if payload.content is not None:
        j.content = payload.content
    if payload.tags is not None:
        j.tags = payload.tags
    if payload.goal_id is not None:
        j.goal_id = payload.goal_id
    if payload.skill_id is not None:
        j.skill_id = payload.skill_id
    j.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(j)
    return {"data": _to_dict(j)}


@router.delete("/journal/{journal_id}")
def delete_journal(
    journal_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    j = (
        db.query(DailyJournal)
        .filter(DailyJournal.id == journal_id, DailyJournal.user_id == current_user.id)
        .first()
    )
    if j is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Journal not found"})

    db.delete(j)
    db.commit()
    return {"ok": True}
