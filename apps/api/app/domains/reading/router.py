"""阅读书单：AI 推荐、搜索、进度记忆和个人阅读计划."""

import logging
from datetime import date, datetime
from typing import Annotated

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.errors import AppError
from app.core.security import get_current_user
from app.core.storage import resolve_object_url, upload_object
from app.db.models import BackgroundJob, Profile, ReadingBook
from app.domains.reading.sources import search_book_sources
from app.providers.ai import registry as ai_registry
from app.providers.ai.base import extract_json

logger = logging.getLogger("app.reading.router")

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
    file_url = resolve_object_url(book.file_path) if book.file_path else None
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
        "filePath": book.file_path,
        "fileFormat": book.file_format,
        "fileUrl": file_url,
        "hasFile": bool(book.file_path),
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


class DownloadBookRequest(BaseModel):
    downloadUrl: str = Field(min_length=10, max_length=2000)
    downloadFormat: str | None = None


async def _download_book_file_job(book_id: str, download_url: str, file_format: str) -> None:
    """后台下载书籍文件并上传到 Supabase Storage."""
    db = SessionLocal()
    try:
        book = db.get(ReadingBook, book_id)
        if book is None:
            return
        fmt = (file_format or "epub").lower()
        if fmt not in {"epub", "pdf", "txt", "html"}:
            fmt = "epub"
        # 下载文件
        timeout = httpx.Timeout(connect=15, read=120, write=30, pool=15)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(download_url)
            resp.raise_for_status()
            content = resp.content
        if not content or len(content) < 100:
            raise AppError(code="BOOK_DOWNLOAD_FAILED", message="下载的文件为空", status=502)
        # 上传到 Supabase Storage
        content_type_map = {
            "epub": "application/epub+zip",
            "pdf": "application/pdf",
            "txt": "text/plain; charset=utf-8",
            "html": "text/html; charset=utf-8",
        }
        ext = fmt
        object_path = f"books/{book_id}.{ext}"
        stored_path = await upload_object(object_path, content, content_type_map.get(fmt, "application/octet-stream"))
        book.file_path = stored_path
        book.file_format = fmt
        db.commit()
        logger.info("Book %s downloaded: %s (%d bytes)", book_id, stored_path, len(content))
    except Exception as exc:
        logger.error("Book download failed for %s: %s", book_id, exc)
    finally:
        db.close()


@router.post("/library/reading/books/{book_id}/download", status_code=202)
async def download_book_file(
    book_id: str,
    payload: DownloadBookRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """下载书籍文件到系统存储（后台异步执行）。"""
    book = db.query(ReadingBook).filter(ReadingBook.id == book_id, ReadingBook.user_id == current_user.id).first()
    if book is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "书籍不存在"})
    if book.file_path:
        return {"data": {"status": "already_downloaded", "fileUrl": resolve_object_url(book.file_path)}}
    import asyncio
    asyncio.create_task(_download_book_file_job(book_id, payload.downloadUrl, payload.downloadFormat or "epub"))
    return {"data": {"status": "downloading", "message": "正在后台下载，请稍后刷新查看"}}


@router.post("/library/reading/populate-classics")
async def populate_classic_books(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """预装经典公版书籍到用户书单，并自动下载文件。"""
    classics = [
        {"title": "Pride and Prejudice", "author": "Jane Austen", "gutenberg_id": 1342, "category": "经典文学"},
        {"title": "Alice's Adventures in Wonderland", "author": "Lewis Carroll", "gutenberg_id": 11, "category": "经典文学"},
        {"title": "A Tale of Two Cities", "author": "Charles Dickens", "gutenberg_id": 98, "category": "经典文学"},
        {"title": "The Adventures of Sherlock Holmes", "author": "Arthur Conan Doyle", "gutenberg_id": 1661, "category": "推理小说"},
        {"title": "The Art of War", "author": "Sun Tzu", "gutenberg_id": 132, "category": "经典哲学"},
        {"title": "Meditations", "author": "Marcus Aurelius", "gutenberg_id": 2680, "category": "经典哲学"},
        {"title": "The Time Machine", "author": "H. G. Wells", "gutenberg_id": 35, "category": "科幻小说"},
        {"title": "Frankenstein", "author": "Mary Wollstonecraft Shelley", "gutenberg_id": 84, "category": "经典文学"},
        {"title": "Dracula", "author": "Bram Stoker", "gutenberg_id": 345, "category": "经典文学"},
        {"title": "The Prince", "author": "Niccolò Machiavelli", "gutenberg_id": 1232, "category": "经典哲学"},
        {"title": "Narrative of the Life of Frederick Douglass", "author": "Frederick Douglass", "gutenberg_id": 23, "category": "传记"},
        {"title": "The Yellow Wallpaper", "author": "Charlotte Perkins Gilman", "gutenberg_id": 1952, "category": "经典文学"},
    ]
    added = []
    skipped = []
    for item in classics:
        existing = db.query(ReadingBook).filter(
            ReadingBook.user_id == current_user.id,
            ReadingBook.title == item["title"],
            ReadingBook.author == item["author"],
        ).first()
        if existing:
            skipped.append(item["title"])
            continue
        book = ReadingBook(
            user_id=current_user.id,
            title=item["title"],
            author=item["author"],
            description=f"{item['category']} · Project Gutenberg 公版书",
            source_url=f"https://www.gutenberg.org/ebooks/{item['gutenberg_id']}",
            status="want",
            current_page=0,
            progress_percent=0,
            is_complete=False,
            ai_recommended=False,
        )
        db.add(book)
        db.flush()
        added.append(item["title"])
        # 后台下载书籍文件
        import asyncio
        gutenberg_id = item["gutenberg_id"]
        asyncio.create_task(
            _download_book_file_job(
                book.id,
                f"https://www.gutenberg.org/ebooks/{gutenberg_id}.epub.images",
                "epub",
            )
        )
    db.commit()
    return {"data": {"added": added, "skipped": skipped, "total": len(added) + len(skipped)}}
