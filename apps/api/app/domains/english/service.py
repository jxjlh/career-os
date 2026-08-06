"""English Learning 业务逻辑层."""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.db.models import ListeningMaterial, UserWord, Word, WordBook
from app.domains.english.repository import (
    ListeningAttemptRepository,
    ListeningRepository,
    StudySessionRepository,
    UserWordRepository,
    WordBookRepository,
    WordRepository,
)
from app.domains.english.srs import SRSInput, initial_state, schedule

# 每日学习目标：新词量
DEFAULT_DAILY_NEW_WORDS = 15
# 最大队列长度
MAX_QUEUE_SIZE = 50


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
        result = []
        for book in books:
            stats = self.user_words.count_by_status(user_id, book.id)
            result.append(book_dict(book, stats))
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
        """
        today = date.today()
        queue = []

        # 1. 优先获取"不会"的单词（评分 again 的）
        again_uws = self.user_words.list_by_rating(user_id, book_id, "again")
        for uw in again_uws[:limit]:
            word = self.words.get(uw.word_id)
            if word:
                queue.append(word_dict(word, uw))

        # 2. 到期复习词
        remaining = limit - len(queue)
        if remaining > 0:
            due_uws = self.user_words.list_due(user_id, book_id, today)
            for uw in due_uws[:remaining]:
                word = self.words.get(uw.word_id)
                if word and word.id not in [q["id"] for q in queue]:
                    queue.append(word_dict(word, uw))

        # 3. 新词
        remaining = limit - len(queue)
        if remaining > 0:
            all_uws = self.user_words.list_by_book(user_id, book_id)
            new_word_ids = [uw.word_id for uw in all_uws if uw.status == "new"]
            for wid in new_word_ids[:remaining]:
                word = self.words.get(wid)
                if word and word.id not in [q["id"] for q in queue]:
                    uw = self.user_words.get(user_id, wid)
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
