"""阅读书单：AI 推荐、搜索、进度记忆和个人阅读计划."""

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.security import get_current_user
from app.db.models import BackgroundJob, Profile, ReadingBook
from app.domains.reading.sources import search_book_sources
from app.providers.ai import registry as ai_registry
from app.providers.ai.base import extract_json

router = APIRouter(tags=["reading"])


async def run_book_source_search_job(job_id: str, query: str, limit: int, language: str) -> None:
    db = SessionLocal()
    try:
        job = db.get(BackgroundJob, job_id)
        if job is None:
            return
        job.result = await search_book_sources(query, limit=limit, language=language)
        job.status = "succeeded"
        db.commit()
    except Exception as exc:  # pragma: no cover - background/network boundary
        job = db.get(BackgroundJob, job_id)
        if job is not None:
            job.status = "failed"
            job.error = str(exc)
            db.commit()
    finally:
        db.close()


class ReadingBookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    author: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    coverUrl: str | None = None
    sourceUrl: str | None = None
    isbn: str | None = Field(default=None, max_length=32)
    status: str = Field(default="want", pattern="^(want|reading|finished|unread)$")
    currentPage: int = Field(default=0, ge=0)
    totalPages: int | None = Field(default=None, ge=1)
    targetDate: date | None = None
    dailyMinutes: int | None = Field(default=None, ge=5, le=600)
    planNote: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=5000)
    isComplete: bool = False
    aiRecommended: bool = False


class ReadingBookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    author: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    coverUrl: str | None = None
    sourceUrl: str | None = None
    isbn: str | None = Field(default=None, max_length=32)
    status: str | None = Field(default=None, pattern="^(want|reading|finished|unread)$")
    currentPage: int | None = Field(default=None, ge=0)
    totalPages: int | None = Field(default=None, ge=1)
    targetDate: date | None = None
    dailyMinutes: int | None = Field(default=None, ge=5, le=600)
    planNote: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=5000)
    isComplete: bool | None = None


class ReadingSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    limit: int = Field(default=10, ge=1, le=20)


def book_dict(book: ReadingBook) -> dict:
    progress = book.progress_percent
    if book.total_pages:
        progress = round(min(100, max(0, book.current_page * 100 / book.total_pages)), 1)
    return {
        "id": book.id,
        "title": book.title,
        "author": book.author,
        "description": book.description,
        "coverUrl": book.cover_url,
        "sourceUrl": book.source_url,
        "isbn": book.isbn,
        "status": book.status,
        "currentPage": book.current_page,
        "totalPages": book.total_pages,
        "progressPercent": progress,
        "targetDate": book.target_date.isoformat() if book.target_date else None,
        "dailyMinutes": book.daily_minutes,
        "planNote": book.plan_note,
        "notes": book.notes,
        "isComplete": book.is_complete,
        "aiRecommended": book.ai_recommended,
        "lastReadAt": book.last_read_at.isoformat() if book.last_read_at else None,
        "finishedAt": book.finished_at.isoformat() if book.finished_at else None,
        "createdAt": book.created_at.isoformat() if book.created_at else None,
    }


def apply_payload(book: ReadingBook, payload: ReadingBookCreate | ReadingBookUpdate) -> None:
    values = payload.model_dump(exclude_unset=True, by_alias=False)
    aliases = {
        "coverUrl": "cover_url",
        "sourceUrl": "source_url",
        "currentPage": "current_page",
        "totalPages": "total_pages",
        "targetDate": "target_date",
        "dailyMinutes": "daily_minutes",
        "planNote": "plan_note",
        "isComplete": "is_complete",
        "aiRecommended": "ai_recommended",
    }
    for key, value in values.items():
        setattr(book, aliases.get(key, key), value)
    if book.total_pages:
        book.progress_percent = round(min(100, max(0, book.current_page * 100 / book.total_pages)), 1)
    else:
        book.progress_percent = 100 if book.status == "finished" else book.progress_percent
    if book.current_page > 0 and book.status in {"want", "unread"}:
        book.status = "reading"
    if book.total_pages and book.current_page >= book.total_pages:
        book.current_page = book.total_pages
        book.progress_percent = 100
        book.status = "finished"
        book.finished_at = book.finished_at or datetime.utcnow()
    if book.current_page > 0:
        book.last_read_at = datetime.utcnow()


@router.get("/library/reading/books")
def list_reading_books(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    status: str | None = Query(None),
) -> dict:
    query = db.query(ReadingBook).filter(ReadingBook.user_id == current_user.id)
    if status:
        query = query.filter(ReadingBook.status == status)
    books = query.order_by(ReadingBook.updated_at.desc(), ReadingBook.created_at.desc()).all()
    return {"data": [book_dict(book) for book in books]}


@router.post("/library/reading/books", status_code=201)
def create_reading_book(
    payload: ReadingBookCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    existing = (
        db.query(ReadingBook)
        .filter(ReadingBook.user_id == current_user.id, ReadingBook.title == payload.title, ReadingBook.author == payload.author)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail={"code": "DUPLICATE", "message": "这本书已经在你的书单中"})
    book = ReadingBook(
        user_id=current_user.id,
        title=payload.title,
        author=payload.author,
        status="want",
        current_page=0,
        progress_percent=0,
        is_complete=False,
        ai_recommended=False,
    )
    apply_payload(book, payload)
    db.add(book)
    db.commit()
    db.refresh(book)
    return {"data": book_dict(book)}


@router.patch("/library/reading/books/{book_id}")
def update_reading_book(
    book_id: str,
    payload: ReadingBookUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    book = db.query(ReadingBook).filter(ReadingBook.id == book_id, ReadingBook.user_id == current_user.id).first()
    if book is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "书籍不存在"})
    apply_payload(book, payload)
    db.commit()
    db.refresh(book)
    return {"data": book_dict(book)}


@router.delete("/library/reading/books/{book_id}", status_code=204)
def delete_reading_book(
    book_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    book = db.query(ReadingBook).filter(ReadingBook.id == book_id, ReadingBook.user_id == current_user.id).first()
    if book is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "书籍不存在"})
    db.delete(book)
    db.commit()


@router.post("/library/reading/recommendations")
async def reading_recommendations(
    current_user: Annotated[Profile, Depends(get_current_user)],
) -> dict:
    prompt = (
        "你是专业阅读顾问。推荐 6 本适合长期阅读的完整出版书籍，优先经典、权威、可查到正式版本的书，"
        "不要推荐文章、摘要、课程或只有节选的内容。严格返回 JSON："
        '{"books":[{"title":"","author":"","description":"","reason":"","category":"","isComplete":true,"searchQuery":""}]}。'
        f"用户语言: {current_user.language}"
    )
    provider = ai_registry.get_ai_provider()
    try:
        parsed = extract_json(await provider.complete([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=1200))
    except Exception:
        parsed = None
    books = parsed.get("books", []) if isinstance(parsed, dict) else []
    if not books:
        books = [
            {"title": "The 7 Habits of Highly Effective People", "author": "Stephen R. Covey", "description": "建立个人效能与长期成长系统。", "reason": "适合建立目标、计划和复盘习惯。", "category": "成长", "isComplete": True, "searchQuery": "The 7 Habits of Highly Effective People full book publisher"},
            {"title": "深度工作", "author": "Cal Newport", "description": "训练专注力，减少浅层忙碌。", "reason": "适合需要长期学习和输出的人。", "category": "效率", "isComplete": True, "searchQuery": "深度工作 Cal Newport 正式出版书籍"},
            {"title": "思考，快与慢", "author": "Daniel Kahneman", "description": "理解判断、决策与认知偏差。", "reason": "帮助提升分析和决策质量。", "category": "思维", "isComplete": True, "searchQuery": "思考快与慢 丹尼尔·卡尼曼 正式出版书籍"},
        ]
    return {"data": {"books": books[:8], "provider": "ai" if parsed else "fallback"}}


@router.post("/library/reading/search", status_code=202)
def search_reading_books(
    payload: ReadingSearchRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    job = BackgroundJob(user_id=current_user.id, job_type="reading_search", payload={"query": payload.query})
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_book_source_search_job, job.id, payload.query, payload.limit, current_user.language)
    return {"data": {"jobId": job.id, "pollUrl": f"/api/v1/explore/jobs/{job.id}"}}
