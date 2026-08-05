"""English Learning API 路由."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.english.schemas import (
    ListeningAttemptRequest,
    ListeningGenerateRequest,
    ReviewRequest,
    SessionRequest,
    WordStarRequest,
)
from app.domains.english.service import EnglishService, ListeningService

router = APIRouter(tags=["english"])


# ── 词书 ──────────────────────────────────────────────────────────
@router.get("/english/books")
def list_books(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": EnglishService(db).list_books(current_user.id)}


@router.get("/english/books/{book_id}")
def get_book(
    book_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    book = EnglishService(db).get_book(current_user.id, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Word book not found"})
    return {"data": book}


@router.get("/english/books/{book_id}/words")
def list_words(
    book_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> dict:
    return {"data": EnglishService(db).list_words(current_user.id, book_id, offset, limit)}


@router.post("/english/books/{book_id}/start", status_code=201)
def start_book(
    book_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = EnglishService(db).start_book(current_user.id, book_id)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Word book not found"})
    return {"data": result}


# ── 单词学习与复习 ────────────────────────────────────────────────
@router.get("/english/study/queue")
def get_study_queue(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    book_id: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    return {"data": EnglishService(db).get_study_queue(current_user.id, book_id, limit)}


@router.post("/english/words/{word_id}/review")
def review_word(
    word_id: str,
    payload: ReviewRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = EnglishService(db).review_word(current_user.id, word_id, payload.rating)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Word not found"})
    return {"data": result}


@router.patch("/english/words/{word_id}")
def update_word(
    word_id: str,
    payload: WordStarRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    starred = payload.is_starred if payload.is_starred is not None else False
    result = EnglishService(db).toggle_star(current_user.id, word_id, starred)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Word not found"})
    return {"data": result}


# ── 听力练习 ──────────────────────────────────────────────────────
@router.get("/english/listening")
def list_listening(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    book_id: str | None = Query(None),
    difficulty: str | None = Query(None),
) -> dict:
    return {"data": ListeningService(db).list_materials(book_id, difficulty)}


@router.get("/english/listening/{material_id}")
def get_listening(
    material_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    m = ListeningService(db).get_material(current_user.id, material_id)
    if m is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Material not found"})
    return {"data": m}


@router.post("/english/listening/{material_id}/attempts")
def submit_listening_attempt(
    material_id: str,
    payload: ListeningAttemptRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = ListeningService(db).submit_attempt(
        current_user.id,
        material_id,
        payload.question_index,
        payload.user_answer,
        payload.duration_seconds,
    )
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Material not found"})
    return {"data": result}


# ── 统计打卡 ──────────────────────────────────────────────────────
@router.get("/english/stats/today")
def get_today_stats(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": EnglishService(db).get_today_stats(current_user.id)}


@router.get("/english/stats/streak")
def get_streak_stats(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": EnglishService(db).get_streak_stats(current_user.id)}


# ── 单词发音 (TTS) ────────────────────────────────────────────────
@router.get("/english/words/{word_id}/pronunciation")
async def word_pronunciation(
    word_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """调讯飞 TTS 生成单词发音, 流式返回 mp3."""
    from app.domains.english.repository import WordRepository
    from app.providers.tts.xfyun_tts_provider import XfyunTTSProvider

    word = WordRepository(db).get(word_id)
    if word is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Word not found"})

    settings = get_settings()
    if not (settings.xfyun_api_key and settings.xfyun_api_secret and settings.xfyun_app_id):
        raise HTTPException(status_code=503, detail={"code": "TTS_NOT_CONFIGURED", "message": "TTS service not configured"})

    tts = XfyunTTSProvider()
    try:
        audio = await tts.synthesize(word.spelling, voice=settings.xfyun_tts_default_voice)
    except Exception as e:
        raise HTTPException(status_code=502, detail={"code": "TTS_ERROR", "message": str(e)}) from e

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )
