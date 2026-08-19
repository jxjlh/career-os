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
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """AI 推荐好书：每次随机推荐，且不与用户已添加/已读书籍重复。"""
    # 获取用户已添加书籍（标题+作者），用于排除重复推荐
    existing_books = db.query(ReadingBook).filter(ReadingBook.user_id == current_user.id).all()
    existing_titles = [
        f"《{b.title}》" + (f"({b.author})" if b.author else "")
        for b in existing_books
    ]
    # 随机选取主题方向，确保每次推荐有差异
    import random
    theme_pool = [
        "思维认知与决策科学",
        "文学经典与人性洞察",
        "自我成长与习惯养成",
        "历史文明与社会演变",
        "哲学思辨与人生智慧",
        "心理学与情绪管理",
        "经济学与财商启蒙",
        "科学技术与未来趋势",
        "传记与人物传奇",
        "艺术审美与生活美学",
    ]
    selected_themes = random.sample(theme_pool, k=min(4, len(theme_pool)))
    themes_text = "、".join(selected_themes)
    # 随机选取推荐数量（6-8本），增加变化
    recommend_count = random.randint(6, 8)
    # 构建排除列表（最多传 30 本，避免 prompt 过长）
    exclude_text = ""
    if existing_titles:
        exclude_text = f"\n严格禁止推荐以下用户已添加/已读的书籍：{', '.join(existing_titles[:30])}"
    prompt = (
        f"你是专业阅读顾问。本次请围绕以下主题方向随机推荐 {recommend_count} 本适合长期阅读的完整出版书籍：{themes_text}。"
        "要求：\n"
        "1. 必须是正式出版的完整书籍，优先经典、权威、可查到正式版本的书；\n"
        "2. 不要推荐文章、摘要、课程或只有节选的内容；\n"
        "3. 每次推荐需覆盖不同类别，确保多样性；\n"
        "4. 尽量推荐不同作者的作品，避免同一作者多本；\n"
        "5. 可包含中外书籍混合，适合用户语言阅读。"
        f"{exclude_text}\n"
        "严格返回 JSON："
        '{"books":[{"title":"","author":"","description":"","reason":"","category":"","isComplete":true,"searchQuery":""}]}'
        f"用户语言: {current_user.language}"
    )
    provider = ai_registry.get_ai_provider()
    try:
        parsed = extract_json(await provider.complete(
            [{"role": "user", "content": prompt}],
            temperature=0.85,  # 提高随机性
            max_tokens=1500,
        ))
    except Exception as exc:
        logger.error("Reading recommendation failed: %s", exc, exc_info=True)
        parsed = None
    books = parsed.get("books", []) if isinstance(parsed, dict) else []
    # 二次过滤：移除与用户已添加书籍重复的推荐（标题或作者匹配）
    if books and existing_books:
        existing_keys = {
            f"{b.title.strip().lower()}_{(b.author or '').strip().lower()}"
            for b in existing_books
        }
        existing_title_keys = {b.title.strip().lower() for b in existing_books}
        filtered = []
        for book in books:
            title = (book.get("title") or "").strip()
            author = (book.get("author") or "").strip()
            key = f"{title.lower()}_{author.lower()}"
            # 标题或标题+作者匹配则跳过
            if title.lower() in existing_title_keys or key in existing_keys:
                continue
            filtered.append(book)
        books = filtered
    if not books:
        # 仅当 AI 完全失败时才使用兜底，且随机打乱
        fallback_pool = [
            {"title": "The 7 Habits of Highly Effective People", "author": "Stephen R. Covey", "description": "建立个人效能与长期成长系统。", "reason": "适合建立目标、计划和复盘习惯。", "category": "成长", "isComplete": True, "searchQuery": "The 7 Habits of Highly Effective People full book publisher"},
            {"title": "深度工作", "author": "Cal Newport", "description": "训练专注力，减少浅层忙碌。", "reason": "适合需要长期学习和输出的人。", "category": "效率", "isComplete": True, "searchQuery": "深度工作 Cal Newport 正式出版书籍"},
            {"title": "思考，快与慢", "author": "Daniel Kahneman", "description": "理解判断、决策与认知偏差。", "reason": "帮助提升分析和决策质量。", "category": "思维", "isComplete": True, "searchQuery": "思考快与慢 丹尼尔·卡尼曼 正式出版书籍"},
            {"title": "活出生命的意义", "author": "维克多·弗兰克尔", "description": "在苦难中寻找意义。", "reason": "建立内在力量。", "category": "心理学", "isComplete": True, "searchQuery": "活出生命的意义 弗兰克尔"},
            {"title": "原子习惯", "author": "詹姆斯·克利尔", "description": "微小改变带来巨大成就。", "reason": "适合培养长期习惯。", "category": "成长", "isComplete": True, "searchQuery": "原子习惯 詹姆斯克利尔"},
            {"title": "百年孤独", "author": "加西亚·马尔克斯", "description": "魔幻现实主义经典。", "reason": "文学经典必读。", "category": "文学", "isComplete": True, "searchQuery": "百年孤独 马尔克斯"},
        ]
        random.shuffle(fallback_pool)
        books = fallback_pool[:6]
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
    """批量导入必读书单（126本），公版书自动搜索下载。"""
    # 必读书单：category, title, author, gutenberg_id(可选，已知公版书ID)
    books_data = [
        # 思想认知
        {"t": "人类简史", "a": "尤瓦尔·赫拉利", "c": "思想认知"},
        {"t": "枪炮、病菌与钢铁", "a": "贾雷德·戴蒙德", "c": "思想认知"},
        {"t": "穷查理宝典", "a": "彼得·考夫曼", "c": "思想认知"},
        {"t": "思考，快与慢", "a": "丹尼尔·卡尼曼", "c": "思想认知"},
        {"t": "乌合之众", "a": "古斯塔夫·勒庞", "c": "思想认知"},
        {"t": "自私的基因", "a": "理查德·道金斯", "c": "思想认知"},
        {"t": "影响力", "a": "罗伯特·西奥迪尼", "c": "思想认知"},
        {"t": "原则", "a": "瑞·达利欧", "c": "思想认知"},
        {"t": "批判性思维", "a": "布鲁克·诺埃尔·摩尔", "c": "思想认知"},
        {"t": "学会提问", "a": "尼尔·布朗", "c": "思想认知"},
        {"t": "乡土中国", "a": "费孝通", "c": "思想认知"},
        {"t": "基因传", "a": "悉达多·穆克吉", "c": "思想认知"},
        {"t": "事实", "a": "汉斯·罗斯林", "c": "思想认知"},
        {"t": "反脆弱", "a": "纳西姆·塔勒布", "c": "思想认知"},
        {"t": "随机漫步的傻瓜", "a": "纳西姆·塔勒布", "c": "思想认知"},
        {"t": "娱乐至死", "a": "尼尔·波兹曼", "c": "思想认知"},
        {"t": "童年的消逝", "a": "尼尔·波兹曼", "c": "思想认知"},
        {"t": "技术与文明", "a": "刘易斯·芒福德", "c": "思想认知"},
        {"t": "巨变", "a": "托尼·朱特", "c": "思想认知"},
        {"t": "身份与暴力", "a": "阿马蒂亚·森", "c": "思想认知"},
        # 文学经典
        {"t": "红楼梦", "a": "曹雪芹", "c": "文学经典", "g": None},
        {"t": "活着", "a": "余华", "c": "文学经典"},
        {"t": "平凡的世界", "a": "路遥", "c": "文学经典"},
        {"t": "围城", "a": "钱钟书", "c": "文学经典"},
        {"t": "白鹿原", "a": "陈忠实", "c": "文学经典"},
        {"t": "我与地坛", "a": "史铁生", "c": "文学经典"},
        {"t": "一句顶一万句", "a": "刘震云", "c": "文学经典"},
        {"t": "人生海海", "a": "麦家", "c": "文学经典"},
        {"t": "黄金时代", "a": "王小波", "c": "文学经典"},
        {"t": "边城", "a": "沈从文", "c": "文学经典"},
        {"t": "百年孤独", "a": "加西亚·马尔克斯", "c": "文学经典"},
        {"t": "月亮与六便士", "a": "毛姆", "c": "文学经典", "g": 42168},
        {"t": "局外人", "a": "加缪", "c": "文学经典"},
        {"t": "鼠疫", "a": "加缪", "c": "文学经典"},
        {"t": "悉达多", "a": "黑塞", "c": "文学经典", "g": 2500},
        {"t": "荒原狼", "a": "黑塞", "c": "文学经典", "g": 9217},
        {"t": "了不起的盖茨比", "a": "菲茨杰拉德", "c": "文学经典", "g": 64317},
        {"t": "杀死一只知更鸟", "a": "哈珀·李", "c": "文学经典"},
        {"t": "简·爱", "a": "夏洛蒂·勃朗特", "c": "文学经典", "g": 1260},
        {"t": "呼啸山庄", "a": "艾米莉·勃朗特", "c": "文学经典", "g": 768},
        {"t": "悲惨世界", "a": "雨果", "c": "文学经典", "g": 135},
        {"t": "红与黑", "a": "司汤达", "c": "文学经典", "g": 49047},
        {"t": "安娜·卡列尼娜", "a": "托尔斯泰", "c": "文学经典", "g": 1399},
        {"t": "复活", "a": "托尔斯泰", "c": "文学经典", "g": 2529},
        {"t": "老人与海", "a": "海明威", "c": "文学经典"},
        {"t": "小王子", "a": "圣埃克苏佩里", "c": "文学经典"},
        {"t": "人间失格", "a": "太宰治", "c": "文学经典"},
        {"t": "瓦尔登湖", "a": "梭罗", "c": "文学经典", "g": 205},
        {"t": "双城记", "a": "狄更斯", "c": "文学经典", "g": 98},
        {"t": "卡拉马佐夫兄弟", "a": "陀思妥耶夫斯基", "c": "文学经典", "g": 28054},
        # 自我成长
        {"t": "被讨厌的勇气", "a": "岸见一郎", "c": "自我成长"},
        {"t": "非暴力沟通", "a": "马歇尔·卢森堡", "c": "自我成长"},
        {"t": "高效能人士的七个习惯", "a": "史蒂芬·柯维", "c": "自我成长"},
        {"t": "少有人走的路", "a": "M·斯科特·派克", "c": "自我成长"},
        {"t": "活出生命的意义", "a": "维克多·弗兰克尔", "c": "自我成长"},
        {"t": "认知觉醒", "a": "周岭", "c": "自我成长"},
        {"t": "刻意练习", "a": "安德斯·艾利克森", "c": "自我成长"},
        {"t": "深度工作", "a": "卡尔·纽波特", "c": "自我成长"},
        {"t": "心流", "a": "米哈里·契克森米哈赖", "c": "自我成长"},
        {"t": "人性的弱点", "a": "戴尔·卡耐基", "c": "自我成长", "g": 6700},
        {"t": "关键对话", "a": "科里·帕特森", "c": "自我成长"},
        {"t": "也许你该找个人聊聊", "a": "洛莉·戈特利布", "c": "自我成长"},
        {"t": "情绪急救", "a": "盖伊·温奇", "c": "自我成长"},
        {"t": "当下的力量", "a": "埃克哈特·托利", "c": "自我成长"},
        {"t": "曾国藩家书", "a": "曾国藩", "c": "自我成长"},
        {"t": "你当像鸟飞往你的山", "a": "塔拉·韦斯特弗", "c": "自我成长"},
        {"t": "把时间当作朋友", "a": "李笑来", "c": "自我成长"},
        {"t": "终身成长", "a": "卡罗尔·德韦克", "c": "自我成长"},
        {"t": "原子习惯", "a": "詹姆斯·克利尔", "c": "自我成长"},
        {"t": "人生设计课", "a": "比尔·博内特", "c": "自我成长"},
        # 历史
        {"t": "史记", "a": "司马迁", "c": "历史"},
        {"t": "资治通鉴", "a": "司马光", "c": "历史"},
        {"t": "万历十五年", "a": "黄仁宇", "c": "历史"},
        {"t": "中国通史", "a": "吕思勉", "c": "历史"},
        {"t": "全球通史", "a": "斯塔夫里阿诺斯", "c": "历史"},
        {"t": "文明的冲突", "a": "亨廷顿", "c": "历史"},
        {"t": "秦制两千年", "a": "谌旭彬", "c": "历史"},
        {"t": "东晋门阀政治", "a": "田余庆", "c": "历史"},
        {"t": "长安的荔枝", "a": "马伯庸", "c": "历史"},
        {"t": "显微镜下的大明", "a": "马伯庸", "c": "历史"},
        {"t": "你一定爱读的极简欧洲史", "a": "约翰·赫斯特", "c": "历史"},
        {"t": "叫魂", "a": "孔飞力", "c": "历史"},
        {"t": "草原帝国", "a": "勒内·格鲁塞", "c": "历史"},
        {"t": "战国歧途", "a": "刘勃", "c": "历史"},
        {"t": "失败者的春秋", "a": "刘勃", "c": "历史"},
        {"t": "菊与刀", "a": "鲁思·本尼迪克特", "c": "历史"},
        # 哲学
        {"t": "苏菲的世界", "a": "乔斯坦·贾德", "c": "哲学"},
        {"t": "刘擎西方现代思想讲义", "a": "刘擎", "c": "哲学"},
        {"t": "大问题：简明哲学导论", "a": "罗伯特·所罗门", "c": "哲学"},
        {"t": "沉思录", "a": "马可·奥勒留", "c": "哲学", "g": 2680},
        {"t": "人生的智慧", "a": "叔本华", "c": "哲学", "g": 6043},
        {"t": "理想国", "a": "柏拉图", "c": "哲学", "g": 55201},
        {"t": "查拉图斯特拉如是说", "a": "尼采", "c": "哲学", "g": 7205},
        {"t": "道德经", "a": "老子", "c": "哲学"},
        {"t": "论语", "a": "孔子及其弟子", "c": "哲学"},
        {"t": "传习录", "a": "王阳明", "c": "哲学"},
        {"t": "西方哲学史", "a": "罗素", "c": "哲学"},
        {"t": "打开：周濂的100堂西方哲学课", "a": "周濂", "c": "哲学"},
        {"t": "存在主义是一种人道主义", "a": "萨特", "c": "哲学"},
        {"t": "何为良好生活", "a": "陈嘉映", "c": "哲学"},
        # 心理学
        {"t": "心理学与生活", "a": "理查德·格里格", "c": "心理学"},
        {"t": "自卑与超越", "a": "阿德勒", "c": "心理学"},
        {"t": "我们时代的神经症人格", "a": "卡伦·霍妮", "c": "心理学"},
        {"t": "依恋", "a": "鲍尔比", "c": "心理学"},
        {"t": "贪婪的多巴胺", "a": "丹尼尔·利伯曼", "c": "心理学"},
        {"t": "社会性动物", "a": "埃利奥特·阿伦森", "c": "心理学"},
        {"t": "内在小孩", "a": "伊贺列卡拉", "c": "心理学"},
        {"t": "情绪勒索", "a": "周慕姿", "c": "心理学"},
        {"t": "发展心理学", "a": "林崇德", "c": "心理学"},
        {"t": "躁郁之心", "a": "凯·雷德菲尔德", "c": "心理学"},
        {"t": "身份的焦虑", "a": "阿兰·德波顿", "c": "心理学"},
        {"t": "幸福的勇气", "a": "岸见一郎", "c": "心理学"},
        {"t": "自我、群体与社会", "a": "埃利奥特·阿伦森", "c": "心理学"},
        # 经济学
        {"t": "经济学原理", "a": "曼昆", "c": "经济学"},
        {"t": "小岛经济学", "a": "希夫", "c": "经济学"},
        {"t": "纳瓦尔宝典", "a": "埃里克·乔根森", "c": "经济学"},
        {"t": "富爸爸穷爸爸", "a": "罗伯特·清崎", "c": "经济学"},
        {"t": "国富论", "a": "亚当·斯密", "c": "经济学", "g": 3300},
        {"t": "道德情操论", "a": "亚当·斯密", "c": "经济学", "g": 9750},
        {"t": "经济学的思维方式", "a": "保罗·海恩", "c": "经济学"},
        {"t": "牛奶可乐经济学", "a": "罗伯特·弗兰克", "c": "经济学"},
        {"t": "贫穷的本质", "a": "班纳吉", "c": "经济学"},
        {"t": "置身事内", "a": "兰小欢", "c": "经济学"},
        {"t": "灰犀牛", "a": "米歇尔·渥克", "c": "经济学"},
        {"t": "货币简史", "a": "卡比尔·塞加尔", "c": "经济学"},
        {"t": "竞争战略", "a": "迈克尔·波特", "c": "经济学"},
    ]
    import asyncio
    added = []
    skipped = []
    downloadable = []
    # 批量查询用户已存在书籍，避免 126 次单独查询
    existing_books = db.query(ReadingBook).filter(ReadingBook.user_id == current_user.id).all()
    existing_keys = {f"{b.title}_{b.author or ''}" for b in existing_books}
    new_books_to_add = []
    download_jobs = []
    for item in books_data:
        key = f"{item['t']}_{item['a']}"
        if key in existing_keys:
            skipped.append(item["t"])
            continue
        gutenberg_id = item.get("g")
        source_url = f"https://www.gutenberg.org/ebooks/{gutenberg_id}" if gutenberg_id else None
        desc = f"{item['c']}必读"
        if gutenberg_id:
            desc += " · Project Gutenberg 公版书（可下载）"
        else:
            desc += " · 受版权保护，需自行购买"
        book = ReadingBook(
            user_id=current_user.id,
            title=item["t"],
            author=item["a"],
            description=desc,
            source_url=source_url,
            status="want",
            current_page=0,
            progress_percent=0,
            is_complete=False,
            ai_recommended=False,
        )
        new_books_to_add.append(book)
        added.append(item["t"])
        if gutenberg_id:
            download_jobs.append((book, gutenberg_id))
            downloadable.append(item["t"])
    # 批量添加并一次性 flush 获取 id
    if new_books_to_add:
        db.add_all(new_books_to_add)
        db.flush()
    # 公版书：后台下载（flush 后 book.id 已可用）
    for book, gutenberg_id in download_jobs:
        asyncio.create_task(
            _download_book_file_job(
                book.id,
                f"https://www.gutenberg.org/ebooks/{gutenberg_id}.epub.images",
                "epub",
            )
        )
    db.commit()
    logger.info(
        "populate_classics user=%s added=%d skipped=%d downloadable=%d",
        current_user.id, len(added), len(skipped), len(downloadable),
    )
    return {"data": {
        "added": added,
        "skipped": skipped,
        "total": len(added) + len(skipped),
        "downloadable": downloadable,
        "downloadableCount": len(downloadable),
        "copyrightProtected": len(added) - len(downloadable),
    }}
