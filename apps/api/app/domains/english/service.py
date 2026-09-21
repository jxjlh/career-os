"""English Learning 业务逻辑层."""

from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import ListeningMaterial, UserWord, Word, WordBook
from app.domains.english.prompts import LISTENING_MATERIAL_PROMPT
from app.domains.english.repository import (
    ListeningAttemptRepository,
    ListeningRepository,
    StudySessionRepository,
    UserWordRepository,
    WordBookRepository,
    WordRepository,
)
from app.domains.english.srs import SRSInput, initial_state, schedule
from app.providers.ai.base import extract_json
from app.providers.ai.registry import get_ai_provider

logger = logging.getLogger("app.english.listening")

# 每日学习目标：新词量
DEFAULT_DAILY_NEW_WORDS = 15
# 最大队列长度
MAX_QUEUE_SIZE = 50

# 听力材料默认发音人（英式女声, 讯飞已授权）
DEFAULT_LISTENING_VOICE = "catherine"
# 补位选词时跳过词书最前面的基础词条数（避开 a/an/man 这类凑数词）
SKIP_BASIC_WORDS = 60

# level 文案 → 种子词书 code
LEVEL_TO_BOOK_CODE = {
    "CET-4": "cet4",
    "CET-6": "cet6",
    "考研": "kaoyan",
    "雅思": "ielts",
    "托福": "toefl",
    "cet4": "cet4",
    "cet6": "cet6",
    "kaoyan": "kaoyan",
    "ielts": "ielts",
    "toefl": "toefl",
}


def word_dict(word: Word, uw: UserWord | None = None) -> dict:
    return {
        "id": word.id,
        "bookId": word.book_id,
        "spelling": word.spelling,
        "phonetic": word.phonetic,
        "pos": word.pos,
        "meaning": word.meaning,
        "exampleEn": word.example_en,
        "exampleZh": word.example_zh,
        "aiMnemonic": word.ai_mnemonic,
        "sortOrder": word.sort_order,
        "status": uw.status if uw else "new",
        "easeFactor": uw.ease_factor if uw else 2.5,
        "intervalDays": uw.interval_days if uw else 0,
        "repetitions": uw.repetitions if uw else 0,
        "dueDate": uw.due_date.isoformat() if uw and uw.due_date else None,
        "isStarred": uw.is_starred if uw else False,
        "lastReviewedAt": uw.last_reviewed_at.isoformat() if uw and uw.last_reviewed_at else None,
    }


def book_dict(book: WordBook, stats: dict[str, int] | None = None) -> dict:
    mastered = 0
    learning = 0
    review = 0
    new = 0
    if stats:
        mastered = stats.get("mastered", 0)
        learning = stats.get("learning", 0)
        review = stats.get("review", 0)
        new = stats.get("new", 0)
    learned = mastered + learning + review
    return {
        "id": book.id,
        "code": book.code,
        "name": book.name,
        "level": book.level,
        "description": book.description,
        "totalWords": book.total_words,
        "sortOrder": book.sort_order,
        "masteredCount": mastered,
        "learningCount": learning + review,
        "newCount": new,
        "learnedCount": learned,
        "progress": round(learned * 100 / book.total_words) if book.total_words else 0,
    }


def canonical_book_code(book: WordBook) -> str:
    normalized = f"{book.code} {book.name} {book.level}".casefold().replace(" ", "")
    if "专业四级" not in normalized and ("cet4" in normalized or "大学英语四级" in normalized):
        return "cet4"
    if "专业八级" not in normalized and ("cet8" in normalized or "大学英语八级" in normalized):
        return "tem8"
    return book.code


def material_dict(m: ListeningMaterial, attempted: bool = False) -> dict:
    return {
        "id": m.id,
        "bookId": m.book_id,
        "title": m.title,
        "transcript": m.transcript,
        "translation": m.translation,
        "difficulty": m.difficulty,
        "durationSeconds": m.duration_seconds,
        "audioUrl": m.audio_url,
        "audioStatus": m.audio_status,
        "questions": m.questions or [],
        "isAiGenerated": m.is_ai_generated,
        "attempted": attempted,
        "createdAt": m.created_at.isoformat() if m.created_at else None,
    }


def _get_week_start(today: date | None = None) -> date:
    """获取本周一作为周计划起始日期."""
    today = today or date.today()
    return today - timedelta(days=today.weekday())


def _get_weekly_plan_data(book: WordBook, today: date | None = None) -> dict:
    """计算周计划数据：每日新词量、复习量."""
    today = today or date.today()
    total_words = book.total_words

    # 计算本周目标新词量
    # 周末（周日）只复习，不学习新词
    is_sunday = today.weekday() == 6
    days_remaining_in_week = max(1, 7 - today.weekday())

    # 已学单词数（基于数据库统计）
    # 简化计算：按总词数和天数分配

    # 计算建议的每日新词量
    if total_words <= 50:
        daily_new = 10
    elif total_words <= 100:
        daily_new = 12
    elif total_words <= 200:
        daily_new = 15
    else:
        daily_new = 20

    # 本周需复习的历史单词数量（估算）
    # 间隔重复：1天、3天、7天、14天、30天
    review_cycles = [1, 3, 7, 14, 30]
    estimated_reviews_per_day = 0

    # 统计已有学习进度的单词
    return {
        "dailyNewWords": daily_new if not is_sunday else 0,
        "estimatedReviewWords": daily_new * 2,  # 复习量约为新词量的2倍
        "isSunday": is_sunday,
        "weekStart": _get_week_start(today).isoformat(),
        "weekDays": days_remaining_in_week,
        "totalWords": total_words,
    }


class EnglishService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.books = WordBookRepository(db)
        self.words = WordRepository(db)
        self.user_words = UserWordRepository(db)
        self.sessions = StudySessionRepository(db)

    def list_books(self, user_id: str) -> list[dict]:
        books = self.books.list_all()
        # 批量获取所有书的统计数据，避免 N+1 查询
        book_ids = [b.id for b in books]
        all_stats = self.user_words.count_by_status_for_books(user_id, book_ids)

        result = []
        seen_codes: set[str] = set()
        for book in books:
            canonical_code = canonical_book_code(book)
            if canonical_code in seen_codes:
                continue
            seen_codes.add(canonical_code)
            stats = all_stats.get(book.id, {})
            item = book_dict(book, stats)
            item["code"] = canonical_code
            result.append(item)
        return result

    def get_book(self, user_id: str, book_id: str) -> dict | None:
        book = self.books.get(book_id)
        if book is None:
            return None
        stats = self.user_words.count_by_status(user_id, book_id)
        return book_dict(book, stats)

    def list_words(self, user_id: str, book_id: str, offset: int = 0, limit: int = 100) -> list[dict]:
        words = self.words.list_by_book(book_id, offset, limit)
        result = []
        for word in words:
            uw = self.user_words.get(user_id, word.id)
            result.append(word_dict(word, uw))
        return result

    def start_book(self, user_id: str, book_id: str) -> dict | None:
        """初始化词书 + 生成周计划."""
        book = self.books.get(book_id)
        if book is None:
            return None
        words = self.words.list_by_book(book_id, 0, 10000)
        word_ids = [w.id for w in words]
        self.user_words.init_book(user_id, book_id, word_ids)
        return self.get_book(user_id, book_id)

    def get_weekly_plan(self, user_id: str, book_id: str) -> dict | None:
        """获取当前词书的周计划."""
        book = self.books.get(book_id)
        if book is None:
            return None

        today = date.today()
        plan_data = _get_weekly_plan_data(book, today)

        # 获取当前学习进度统计
        stats = self.user_words.count_by_status(user_id, book_id)

        # 获取到期复习词数量
        due_uws = self.user_words.list_due(user_id, book_id, today)
        due_count = len(due_uws)

        # 获取 "不会" 的单词数量（上次评分 again 的）
        again_count = self.user_words.count_by_rating(user_id, book_id, "again")

        week_start = plan_data["weekStart"]
        is_sunday = plan_data["isSunday"]

        return {
            "bookId": book_id,
            "bookName": book.name,
            "weekStart": week_start,
            "isSunday": is_sunday,
            "dailyNewWords": plan_data["dailyNewWords"],
            "estimatedReviewWords": plan_data["estimatedReviewWords"],
            "weekDaysRemaining": plan_data["weekDays"],
            "progress": {
                "mastered": stats.get("mastered", 0),
                "learning": stats.get("learning", 0) + stats.get("review", 0),
                "new": stats.get("new", 0),
                "total": book.total_words,
            },
            "todayTask": {
                "newWords": min(plan_data["dailyNewWords"], stats.get("new", 0)),
                "reviewWords": due_count + again_count,
                "weekReviewWords": again_count if is_sunday else 0,
            },
            "againCount": again_count,
            "dueCount": due_count,
            "totalWords": book.total_words,
        }

    def get_study_queue(self, user_id: str, book_id: str, limit: int = 20) -> list[dict]:
        """智能获取今日学习队列: 按优先级排序.

        优先级:
        1. 评分 again 的单词（不会的词）- 必须立即复习
        2. 到期复习词（间隔重复到期）
        3. 新词（按排序顺序）
        
        优化: 使用批量查询避免 N+1 问题
        """
        today = date.today()
        queue = []
        queue_word_ids = set()

        # 1. 优先获取"不会"的单词（评分 again 的）
        again_uws = self.user_words.list_by_rating(user_id, book_id, "again")
        for uw in again_uws[:limit]:
            queue_word_ids.add(uw.word_id)

        # 2. 到期复习词
        remaining = limit - len(queue_word_ids)
        due_uws = []
        if remaining > 0:
            due_uws = self.user_words.list_due(user_id, book_id, today)
            for uw in due_uws[:remaining]:
                if uw.word_id not in queue_word_ids:
                    queue_word_ids.add(uw.word_id)

        # 3. 新词
        remaining = limit - len(queue_word_ids)
        if remaining > 0:
            all_uws = self.user_words.list_by_book(user_id, book_id)
            new_uws = [uw for uw in all_uws if uw.status == "new" and uw.word_id not in queue_word_ids]
            for uw in new_uws[:remaining]:
                queue_word_ids.add(uw.word_id)

        # 批量获取所有单词数据
        all_words = self.words.get_by_ids(list(queue_word_ids))

        # 构建队列结果，保持优先级顺序
        # 重新获取 again 单词（已在 queue_word_ids 中）
        again_ids = {uw.word_id for uw in again_uws[:limit]}
        due_ids = {uw.word_id for uw in due_uws[:limit]}
        new_ids = queue_word_ids - again_ids - due_ids

        # 按优先级排序
        ordered_ids = list(again_ids) + list(due_ids) + list(new_ids)
        # 限制数量
        ordered_ids = ordered_ids[:limit]

        # 获取对应的 UserWord 记录
        all_uws_map = {uw.word_id: uw for uw in (again_uws + due_uws + 
                    [uw for uw in self.user_words.list_by_book(user_id, book_id) if uw.word_id in new_ids])}

        for word_id in ordered_ids:
            word = all_words.get(word_id)
            if word:
                uw = all_uws_map.get(word_id)
                queue.append(word_dict(word, uw))

        return queue

    def review_word(self, user_id: str, word_id: str, rating: str) -> dict | None:
        """复习单词 - again 评分的单词标记为需立即复习."""
        uw = self.user_words.get(user_id, word_id)
        if uw is None:
            return None
        word = self.words.get(word_id)
        if word is None:
            return None

        current = SRSInput(
            status=uw.status,
            ease_factor=uw.ease_factor,
            interval_days=uw.interval_days,
            repetitions=uw.repetitions,
        )
        result = schedule(current, rating)
        was_new = uw.status == "new"
        is_mastered = result.status == "mastered" and uw.status != "mastered"

        # 如果评分是 again，设置 due_date 为今天，确保立即进入复习队列
        if rating == "again":
            result.due_date = date.today()
            result.interval_days = 0

        updated = self.user_words.update_srs(
            user_id,
            word_id,
            status=result.status,
            ease_factor=result.ease_factor,
            interval_days=result.interval_days,
            repetitions=result.repetitions,
            due_date=result.due_date,
        )

        # 更新学习会话统计
        if was_new:
            self.sessions.add_new_word(user_id)
        else:
            self.sessions.add_review_word(user_id)
        if is_mastered:
            self.sessions.add_mastered_word(user_id)

        return word_dict(word, updated)

    def toggle_star(self, user_id: str, word_id: str, starred: bool) -> dict | None:
        uw = self.user_words.set_starred(user_id, word_id, starred)
        word = self.words.get(word_id)
        if uw is None or word is None:
            return None
        return word_dict(word, uw)

    def get_today_stats(self, user_id: str) -> dict:
        s = self.sessions.get_today(user_id)
        if s is None:
            return {
                "newWords": 0,
                "reviewWords": 0,
                "masteredWords": 0,
                "listeningCount": 0,
                "listeningCorrect": 0,
                "durationMinutes": 0,
            }
        return {
            "newWords": s.new_words,
            "reviewWords": s.review_words,
            "masteredWords": s.mastered_words,
            "listeningCount": s.listening_count,
            "listeningCorrect": s.listening_correct,
            "durationMinutes": s.duration_minutes,
        }

    def get_streak_stats(self, user_id: str) -> dict:
        streak = self.sessions.get_streak(user_id)
        recent = self.sessions.get_recent(user_id, 30)
        calendar = [
            {
                "date": s.session_date.isoformat(),
                "newWords": s.new_words,
                "reviewWords": s.review_words,
                "total": s.new_words + s.review_words,
            }
            for s in recent
        ]
        return {"streak": streak, "calendar": calendar}


class ListeningService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.materials = ListeningRepository(db)
        self.attempts = ListeningAttemptRepository(db)
        self.sessions = StudySessionRepository(db)
        self.books = WordBookRepository(db)
        self.words = WordRepository(db)
        self.user_words = UserWordRepository(db)

    def list_materials(self, book_id: str | None = None, difficulty: str | None = None) -> list[dict]:
        items = self.materials.list(book_id, difficulty)
        return [material_dict(m) for m in items]

    def get_material(self, user_id: str, material_id: str) -> dict | None:
        m = self.materials.get(material_id)
        if m is None:
            return None
        attempted_list = self.attempts.list_by_user(user_id, material_id)
        return material_dict(m, attempted=len(attempted_list) > 0)

    def submit_attempt(
        self, user_id: str, material_id: str, question_index: int, user_answer: str, duration: int | None = None
    ) -> dict | None:
        m = self.materials.get(material_id)
        if m is None:
            return None
        questions = m.questions or []
        if question_index >= len(questions):
            return None
        q = questions[question_index]
        correct_answer = q.get("answer", "").strip().lower()
        is_correct = user_answer.strip().lower() == correct_answer

        self.attempts.create(
            user_id=user_id,
            material_id=material_id,
            question_index=question_index,
            user_answer=user_answer,
            is_correct=is_correct,
            duration_seconds=duration,
        )
        self.sessions.add_listening(user_id, is_correct)
        return {"isCorrect": is_correct, "correctAnswer": q.get("answer", "")}

    # ── 生成听力材料 ────────────────────────────────────────────────

    def _resolve_book(self, user_id: str, book_id: str | None, level: str) -> WordBook | None:
        """定位用于选词的词书.

        优先用户显式指定 → 其次用户在学（有 user_words 记录）的词书 → 最后按 level 映射。
        """
        if book_id:
            book = self.books.get(book_id)
            if book is not None:
                return book

        # 用户有学习记录的词书里, 挑词量最多的那本
        rows = (
            self.db.query(UserWord.book_id, func.count(UserWord.id))
            .filter(UserWord.user_id == user_id)
            .group_by(UserWord.book_id)
            .order_by(func.count(UserWord.id).desc())
            .all()
        )
        for candidate_id, _count in rows:
            book = self.books.get(candidate_id)
            if book is not None:
                return book

        # 按 level 映射到种子词书
        code = LEVEL_TO_BOOK_CODE.get((level or "").strip().upper()) or LEVEL_TO_BOOK_CODE.get(
            (level or "").strip().lower()
        )
        if code:
            for book in self.books.list_all():
                if canonical_book_code(book) == code:
                    return book
        return self.books.list_all()[0] if self.books.list_all() else None

    def _pick_vocabulary(
        self, user_id: str, book: WordBook | None, limit: int = 12
    ) -> list[tuple[Word, UserWord | None]]:
        """挑出要嵌进听力材料的词.

        优先级: 正在学/复习中（背过但不熟, 听力强化收益最大）→ 未学新词（按词书顺序）。
        """
        if book is None:
            return []

        picked: list[tuple[Word, UserWord]] = []
        for status in ("learning", "review"):
            rows = (
                self.db.query(UserWord, Word)
                .join(Word, Word.id == UserWord.word_id)
                .filter(
                    UserWord.user_id == user_id,
                    UserWord.book_id == book.id,
                    UserWord.status == status,
                )
                .order_by(UserWord.due_date)
                .limit(limit)
                .all()
            )
            picked.extend((word, uw) for uw, word in rows)
            if len(picked) >= limit:
                break

        if len(picked) < limit:
            picked_ids = {w.id for w, _ in picked}
            # 跳过词书最前面的基础词（a / an / man 这类），并且过滤掉过短的词,
            # 否则听力材料里会出现「凑数」的简单词, 拉低材料质量。
            fresh = (
                self.db.query(Word)
                .filter(Word.book_id == book.id, func.length(Word.spelling) >= 3)
                .order_by(Word.sort_order)
                .offset(SKIP_BASIC_WORDS)
                .limit(limit * 3)
                .all()
            )
            for word in fresh:
                if len(picked) >= limit:
                    break
                if word.id in picked_ids:
                    continue
                picked.append((word, None))

        return picked[:limit]

    def _vocabulary_text(self, vocab: list[tuple[Word, UserWord | None]]) -> str:
        if not vocab:
            return "（无词表, 请按级别自行选择难度合适的常用词）"
        lines = []
        for word, uw in vocab:
            meaning = (word.meaning or "").strip().split("；")[0][:24]
            pos = f"{word.pos} " if word.pos else ""
            stage = ""
            if uw is not None:
                stage = " [正在复习]" if uw.status in ("learning", "review") else " [已学过]"
            lines.append(f"- {word.spelling}{stage}: {pos}{meaning}")
        return "\n".join(lines)

    def _sanitize_questions(self, raw_questions: list) -> list[dict]:
        """清洗 AI 产出的题目: 只保留结构完整、答案自洽的题."""
        cleaned: list[dict] = []
        for item in raw_questions or []:
            if not isinstance(item, dict):
                continue
            q_type = str(item.get("type") or "").strip().lower()
            question = str(item.get("question") or "").strip()
            answer = str(item.get("answer") or "").strip()
            if not question or not answer:
                continue
            if q_type == "choice":
                options = [str(o).strip() for o in (item.get("options") or []) if str(o).strip()]
                if len(options) < 2:
                    continue
                # answer 必须能对上某个选项, 否则丢弃（前端按逐字比较判分）
                if not any(answer.lower() == o.lower() for o in options):
                    continue
                payload = {"type": "choice", "question": question, "options": options, "answer": answer}
            else:
                payload = {"type": "fill_blank", "question": question, "answer": answer}
                hint = str(item.get("hint") or "").strip()
                if hint:
                    payload["hint"] = hint
            cleaned.append(payload)
            if len(cleaned) >= 5:
                break
        return cleaned

    async def generate_material(
        self,
        user_id: str,
        *,
        level: str = "CET-4",
        topic: str = "校园生活",
        difficulty: str | None = None,
        book_id: str | None = None,
        voice: str = DEFAULT_LISTENING_VOICE,
    ) -> dict:
        """AI 生成一篇听力材料并合成音频.

        流程: 挑词（用正在背的词书）→ AI 出原文/翻译/题目 → 落库 → 讯飞 TTS 合成 → 上传取 URL。
        音频合成失败不会阻断返回, 材料仍可用于阅读与答题（前端有浏览器朗读兜底）。
        """
        book = self._resolve_book(user_id, book_id, level)
        vocab = self._pick_vocabulary(user_id, book, limit=12)
        diff = difficulty if difficulty in ("easy", "medium", "hard") else None
        word_count = {"easy": 70, "medium": 110, "hard": 150}.get(diff or "medium", 110)

        prompt = LISTENING_MATERIAL_PROMPT.format(
            level=level,
            topic=topic,
            word_count=word_count,
            vocabulary=self._vocabulary_text(vocab),
        )

        provider = get_ai_provider()
        raw = await provider.complete(
            [
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": f"请生成一篇 {level} 难度的听力材料，主题「{topic}」，严格输出 JSON",
                },
            ],
            response_format="json_object",
            temperature=0.7,
            max_tokens=2500,
        )
        parsed = extract_json(raw)
        if not parsed or not str(parsed.get("transcript") or "").strip():
            raise AppError(code="AI_OUTPUT_INVALID", message="听力材料生成失败，请重试", status=422)

        transcript = str(parsed.get("transcript")).strip()
        questions = self._sanitize_questions(parsed.get("questions") or [])
        if not questions:
            raise AppError(code="AI_OUTPUT_EMPTY", message="AI 没有生成可用题目，请重试", status=422)

        # 用户手选的难度优先；没选时才用 AI 自评
        ai_difficulty = str(parsed.get("difficulty") or "").strip().lower()
        final_difficulty = diff or (ai_difficulty if ai_difficulty in ("easy", "medium", "hard") else "medium")

        material = self.materials.create(
            book_id=book.id if book else None,
            title=(str(parsed.get("title") or "").strip() or f"{topic}听力练习")[:200],
            transcript=transcript,
            translation=str(parsed.get("translation") or "").strip() or None,
            difficulty=final_difficulty,
            questions=questions,
            audio_status="pending",
            is_ai_generated=True,
        )

        await self._synthesize_audio(material, voice=voice)
        self.db.refresh(material)
        result = material_dict(material)
        result["vocabulary"] = [w.spelling for w, _ in vocab]
        return result

    async def _synthesize_audio(self, material: ListeningMaterial, voice: str = DEFAULT_LISTENING_VOICE) -> bool:
        """合成并上传音频, 更新 audio_url / duration / audio_status. 失败返回 False."""
        try:
            from app.providers.tts.xfyun_tts_provider import XfyunTTSProvider
            from app.providers.tts.mp3_util import mp3_duration_seconds
            from app.services.storage import StorageService

            tts = XfyunTTSProvider()
            if not tts._configured():
                logger.warning("listening: TTS not configured, skip audio synthesis")
                return False

            audio = await tts.synthesize(material.transcript, voice=voice)
            if not audio:
                return False
            duration = mp3_duration_seconds(audio)
            url = StorageService().upload_listening_audio(audio, material.id, voice=voice)
            self.materials.update_audio(material.id, url, duration)
            logger.info(
                "listening: audio ready material=%s bytes=%d duration=%s voice=%s",
                material.id, len(audio), duration, voice,
            )
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("listening: audio synthesis failed material=%s: %s", material.id, exc)
            self.db.query(ListeningMaterial).filter(ListeningMaterial.id == material.id).update(
                {"audio_status": "failed"}
            )
            self.db.commit()
            return False

    async def ensure_audio(self, material_id: str, voice: str = DEFAULT_LISTENING_VOICE) -> ListeningMaterial | None:
        """懒合成兜底: 材料还没有音频时现合成一次（供 /audio 端点与详情页使用）."""
        material = self.materials.get(material_id)
        if material is None:
            return None
        if material.audio_status == "ready" and material.audio_url:
            return material
        await self._synthesize_audio(material, voice=voice)
        self.db.refresh(material)
        return material
