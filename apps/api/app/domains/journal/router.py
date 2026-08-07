import io
import logging
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import DailyJournal, Profile

logger = logging.getLogger("app.domains.journal")
router = APIRouter(tags=["journal"])

# 时间段定义
TIME_SLOTS = ["morning", "afternoon", "evening", "night"]
SLOT_LABELS = {
    "morning": "上午",
    "afternoon": "下午",
    "evening": "晚上",
    "night": "深夜",
}
SLOT_ICONS = {
    "morning": "🌅",
    "afternoon": "☀️",
    "evening": "🌆",
    "night": "🌙",
}
MOOD_EMOJIS = ["😵", "😐", "🙂", "😎", "✨"]


# ── Schemas ────────────────────────────────────────────────────────

class JournalCreate(BaseModel):
    mood_index: int = Field(ge=0, le=4)
    content: str | None = None
    tags: list[str] = Field(default_factory=list)
    goal_id: str | None = None
    skill_id: str | None = None
    time_slot: str = Field(default="morning")  # 接受任意字符串, 前端控制格式
    journal_date: str | None = None  # YYYY-MM-DD, 默认今天


class JournalUpdate(BaseModel):
    mood_index: int | None = Field(default=None, ge=0, le=4)
    content: str | None = None
    tags: list[str] | None = None
    goal_id: str | None = None
    skill_id: str | None = None
    time_slot: str | None = None


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


@router.get("/journal/export")
def export_journals(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: int | None = Query(None, description="年份, 默认全部"),
    start: str | None = Query(None, description="开始日期 YYYY-MM-DD"),
    end: str | None = Query(None, description="结束日期 YYYY-MM-DD"),
) -> StreamingResponse:
    """导出小记为 Markdown 文件. 支持 year 或 start/end 日期范围."""
    query = db.query(DailyJournal).filter(DailyJournal.user_id == current_user.id)

    if start and end:
        try:
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end)
            query = query.filter(
                DailyJournal.journal_date >= start_date,
                DailyJournal.journal_date <= end_date,
            )
        except ValueError:
            pass
    elif year:
        query = query.filter(
            text("EXTRACT(YEAR FROM journal_date) = :year")
        ).params(year=year)

    rows = query.order_by(DailyJournal.journal_date.desc(), DailyJournal.time_slot).all()

    # 生成 Markdown
    lines = [
        f"# 我的每日小记",
        f"",
        f"> 导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"> 共 {len(rows)} 条记录",
        f"",
    ]

    current_date = None
    for j in rows:
        date_str = j.journal_date.isoformat()
        if date_str != current_date:
            current_date = date_str
            lines.append(f"---")
            lines.append(f"")
            lines.append(f"## 📅 {date_str}")
            lines.append(f"")

        slot_label = SLOT_LABELS.get(j.time_slot, j.time_slot)
        slot_icon = SLOT_ICONS.get(j.time_slot, "")
        # 处理子时段 key: "morning_06" → "上午 06-08"
        if "_" in j.time_slot:
            main_key = j.time_slot.split("_")[0]
            slot_label = SLOT_LABELS.get(main_key, main_key)
            slot_icon = SLOT_ICONS.get(main_key, "")
            sub_hour = j.time_slot.split("_")[1] if len(j.time_slot.split("_")) > 1 else ""
            if sub_hour:
                slot_label = f"{slot_label} {sub_hour}-{int(sub_hour)+2:02d}" if sub_hour.isdigit() else slot_label
        mood = MOOD_EMOJIS[j.mood_index] if 0 <= j.mood_index < len(MOOD_EMOJIS) else "🙂"

        lines.append(f"### {slot_icon} {slot_label} {mood}")
        lines.append(f"")
        if j.content:
            lines.append(j.content)
            lines.append(f"")
        if j.tags:
            lines.append(f"标签: {' · '.join(j.tags)}")
            lines.append(f"")
        if j.created_at:
            lines.append(f"<sub>记录于 {j.created_at.strftime('%Y-%m-%d %H:%M')}</sub>")
            lines.append(f"")

    markdown = "\n".join(lines)

    if start and end:
        filename = f"journals-{start}_to_{end}.md"
    elif year:
        filename = f"journals-{year}.md"
    else:
        filename = "journals-all.md"
    return StreamingResponse(
        io.BytesIO(markdown.encode("utf-8")),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
        .order_by(DailyJournal.time_slot)
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
    try:
        if payload.journal_date:
            try:
                target_date = date.fromisoformat(payload.journal_date)
            except ValueError:
                raise HTTPException(status_code=422, detail={"code": "INVALID_DATE", "message": "日期格式应为 YYYY-MM-DD"})
        else:
            target_date = date.today()

        logger.info("Creating journal: user=%s, date=%s, slot=%s, mood=%s",
                     current_user.id, target_date, payload.time_slot, payload.mood_index)

        # 1. 精确查找 (user_id, journal_date, time_slot)
        existing = (
            db.query(DailyJournal)
            .filter(
                DailyJournal.user_id == current_user.id,
                DailyJournal.journal_date == target_date,
                DailyJournal.time_slot == payload.time_slot,
            )
            .first()
        )

        # 2. 找到 → 更新
        if existing:
            logger.info("Updating existing journal: id=%s", existing.id)
            existing.mood_index = payload.mood_index
            existing.content = payload.content
            existing.tags = payload.tags or []
            existing.goal_id = payload.goal_id
            existing.skill_id = payload.skill_id
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return {"data": _to_dict(existing)}

        # 3. 没找到 → 尝试新建
        logger.info("Creating new journal entry")
        j = DailyJournal(
            user_id=current_user.id,
            journal_date=target_date,
            time_slot=payload.time_slot,
            mood_index=payload.mood_index,
            content=payload.content,
            tags=payload.tags or [],
            goal_id=payload.goal_id,
            skill_id=payload.skill_id,
        )
        db.add(j)
        db.commit()
        db.refresh(j)
        logger.info("Created journal: id=%s", j.id)
        return {"data": _to_dict(j)}

    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        error_msg = str(e)
        logger.warning("Journal INSERT integrity error: %s", error_msg)

        # 4. 约束冲突 → 查找同日同时间段记录进行更新
        try:
            existing_same_slot = (
                db.query(DailyJournal)
                .filter(
                    DailyJournal.user_id == current_user.id,
                    DailyJournal.journal_date == target_date,
                    DailyJournal.time_slot == payload.time_slot,
                )
                .first()
            )
            if existing_same_slot:
                logger.info("Found same slot record, updating: id=%s", existing_same_slot.id)
                existing_same_slot.mood_index = payload.mood_index
                existing_same_slot.content = payload.content
                existing_same_slot.tags = payload.tags or []
                existing_same_slot.goal_id = payload.goal_id
                existing_same_slot.skill_id = payload.skill_id
                existing_same_slot.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(existing_same_slot)
                return {"data": _to_dict(existing_same_slot)}

            # 如果没找到同时间段，说明旧约束可能还存在，迁移后重试
            # 触发约束迁移
            try:
                from app.core.database import migrate_journal_constraints
                migrate_journal_constraints()
                logger.info("Constraint migration completed, retrying insert")
                
                # 迁移后重试
                j = DailyJournal(
                    user_id=current_user.id,
                    journal_date=target_date,
                    time_slot=payload.time_slot,
                    mood_index=payload.mood_index,
                    content=payload.content,
                    tags=payload.tags or [],
                    goal_id=payload.goal_id,
                    skill_id=payload.skill_id,
                )
                db.add(j)
                db.commit()
                db.refresh(j)
                logger.info("Created journal after migration: id=%s", j.id)
                return {"data": _to_dict(j)}
            except Exception as retry_err:
                db.rollback()
                logger.error("Retry after migration failed: %s", retry_err, exc_info=True)

        except Exception as fallback_err:
            db.rollback()
            logger.error("Journal fallback error: %s", fallback_err, exc_info=True)

        # 返回更具体的错误信息
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DUPLICATE",
                "message": "该时间段已存在记录，请刷新页面后重试",
                "detail": error_msg[:200] if error_msg else None
            }
        )
    except SQLAlchemyError as e:
        db.rollback()
        logger.error("Journal DB error: %s", str(e)[:500], exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "DB_ERROR",
                "message": "数据库操作失败，请稍后重试",
                "detail": str(e)[:200] if str(e) else None
            }
        )
    except Exception as e:
        db.rollback()
        logger.error("Journal create unexpected error: %s", str(e)[:500], exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "CREATE_FAILED",
                "message": f"保存失败：{str(e)[:100]}",
                "detail": str(e)[:200] if str(e) else None
            }
        )


@router.put("/journal/{journal_id}")
def update_journal(
    journal_id: str,
    payload: JournalUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    try:
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
            j.tags = payload.tags or []
        if payload.goal_id is not None:
            j.goal_id = payload.goal_id
        if payload.skill_id is not None:
            j.skill_id = payload.skill_id
        if payload.time_slot is not None:
            j.time_slot = payload.time_slot
        j.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(j)
        return {"data": _to_dict(j)}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error("Journal update DB error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail={"code": "DB_ERROR", "message": "数据库错误，请稍后重试"})
    except Exception as e:
        db.rollback()
        logger.error("Journal update unexpected error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail={"code": "UPDATE_FAILED", "message": "更新失败，请重试"})


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
