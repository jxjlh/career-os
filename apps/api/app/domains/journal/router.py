import io
import logging
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
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
    """创建/更新某个时间段的日记. 按 (date, time_slot) upsert.
    逻辑: 先精确查找 (date+time_slot), 找到则更新; 否则尝试 INSERT 新记录;
    若 INSERT 因旧约束 (user_id, journal_date) 冲突失败, 则自动迁移约束并重试."""
    if payload.journal_date:
        try:
            target_date = date.fromisoformat(payload.journal_date)
        except ValueError:
            raise HTTPException(status_code=422, detail={"code": "INVALID_DATE", "message": "日期格式应为 YYYY-MM-DD"})
    else:
        target_date = date.today()

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
        existing.mood_index = payload.mood_index
        existing.content = payload.content
        existing.tags = payload.tags
        existing.goal_id = payload.goal_id
        existing.skill_id = payload.skill_id
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return {"data": _to_dict(existing)}

    # 3. 没找到 → 尝试新建 (带约束迁移容错)
    def _insert_journal() -> DailyJournal:
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
        return j

    try:
        j = _insert_journal()
        return {"data": _to_dict(j)}
    except Exception as e:
        db.rollback()
        logger.warning("Journal INSERT failed (constraint conflict), trying to migrate: %s", e)

        # 4. INSERT 失败 → 尝试迁移约束后重试
        try:
            with db.connection() as conn:
                # 查找并删除旧约束 (只含 user_id + journal_date, 不含 time_slot)
                result = conn.execute(text(
                    """
                    SELECT conname FROM pg_constraint
                    WHERE conrelid = 'daily_journals'::regclass AND contype = 'u'
                    AND conname != 'uq_daily_journal_user_date_slot'
                    """
                ))
                for row in result.fetchall():
                    conn.execute(text(f"ALTER TABLE daily_journals DROP CONSTRAINT IF EXISTS {row[0]}"))
                    logger.info("Dropped old constraint: %s", row[0])

                # 添加新约束 (含 time_slot)
                conn.execute(text(
                    "ALTER TABLE daily_journals ADD CONSTRAINT uq_daily_journal_user_date_slot "
                    "UNIQUE (user_id, journal_date, time_slot)"
                ))
                logger.info("Added new constraint uq_daily_journal_user_date_slot")

            # 重试 INSERT
            j = _insert_journal()
            return {"data": _to_dict(j)}
        except Exception as migrate_err:
            db.rollback()
            logger.error("Constraint migration + retry failed: %s", migrate_err)

            # 5. 最终 fallback: 更新同日第一条记录
            fallback = (
                db.query(DailyJournal)
                .filter(
                    DailyJournal.user_id == current_user.id,
                    DailyJournal.journal_date == target_date,
                )
                .order_by(DailyJournal.created_at.desc())
                .first()
            )
            if fallback:
                fallback.mood_index = payload.mood_index
                fallback.content = payload.content
                fallback.tags = payload.tags
                fallback.goal_id = payload.goal_id
                fallback.skill_id = payload.skill_id
                fallback.time_slot = payload.time_slot
                fallback.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(fallback)
                return {"data": _to_dict(fallback)}

            raise HTTPException(status_code=500, detail={"code": "CREATE_FAILED", "message": "保存失败，请重试"})


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
    if payload.time_slot is not None:
        j.time_slot = payload.time_slot
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
