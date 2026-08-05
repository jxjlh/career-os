"""English Learning 业务逻辑层."""

from __future__ import annotations

from datetime import date, datetime

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
        book = self.books.get(book_id)
        if book is None:
            return None
        words = self.words.list_by_book(book_id, 0, 10000)
        word_ids = [w.id for w in words]
        self.user_words.init_book(user_id, book_id, word_ids)
        return self.get_book(user_id, book_id)

    def get_study_queue(self, user_id: str, book_id: str, limit: int = 20) -> list[dict]:
        """获取今日学习队列: 到期复习词 + 新词, 混合返回."""
        today = date.today()
        # 1. 到期复习词
        due_uws = self.user_words.list_due(user_id, book_id, today)
        queue = []
        for uw in due_uws[:limit]:
            word = self.words.get(uw.word_id)
            if word:
                queue.append(word_dict(word, uw))

        remaining = limit - len(queue)
        if remaining > 0:
            # 2. 新词 (status=new 的)
            all_uws = self.user_words.list_by_book(user_id, book_id)
            new_word_ids = [uw.word_id for uw in all_uws if uw.status == "new"]
            for wid in new_word_ids[:remaining]:
                word = self.words.get(wid)
                if word:
                    uw = self.user_words.get(user_id, wid)
                    queue.append(word_dict(word, uw))
        return queue

    def review_word(self, user_id: str, word_id: str, rating: str) -> dict | None:
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
