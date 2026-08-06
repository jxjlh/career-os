"""English Learning 数据访问层."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    EnglishStudySession,
    ListeningAttempt,
    ListeningMaterial,
    UserWord,
    Word,
    WordBook,
    WordReviewLog,
)


class WordBookRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[WordBook]:
        return self.db.query(WordBook).order_by(WordBook.sort_order).all()

    def get(self, book_id: str) -> WordBook | None:
        return self.db.query(WordBook).filter(WordBook.id == book_id).first()


class WordRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_book(self, book_id: str, offset: int = 0, limit: int = 100) -> list[Word]:
        return (
            self.db.query(Word)
            .filter(Word.book_id == book_id)
            .order_by(Word.sort_order)
            .offset(offset)
            .limit(limit)
            .all()
        )

    def get(self, word_id: str) -> Word | None:
        return self.db.query(Word).filter(Word.id == word_id).first()

    def count_by_book(self, book_id: str) -> int:
        return self.db.query(func.count(Word.id)).filter(Word.book_id == book_id).scalar() or 0


class UserWordRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: str, word_id: str) -> UserWord | None:
        return (
            self.db.query(UserWord)
            .filter(UserWord.user_id == user_id, UserWord.word_id == word_id)
            .first()
        )

    def list_by_book(self, user_id: str, book_id: str) -> list[UserWord]:
        return (
            self.db.query(UserWord)
            .filter(UserWord.user_id == user_id, UserWord.book_id == book_id)
            .all()
        )

    def list_due(self, user_id: str, book_id: str | None, today: date | None = None) -> list[UserWord]:
        today = today or date.today()
        q = self.db.query(UserWord).filter(
            UserWord.user_id == user_id,
            UserWord.status != "new",
            UserWord.due_date <= today,
        )
        if book_id:
            q = q.filter(UserWord.book_id == book_id)
        return q.order_by(UserWord.due_date).all()

    def count_by_status(self, user_id: str, book_id: str) -> dict[str, int]:
        rows = (
            self.db.query(UserWord.status, func.count(UserWord.id))
            .filter(UserWord.user_id == user_id, UserWord.book_id == book_id)
            .group_by(UserWord.status)
            .all()
        )
        return {status: count for status, count in rows}

    def init_book(self, user_id: str, book_id: str, word_ids: list[str]) -> int:
        """为词书的所有单词初始化 UserWord (new 状态). 已存在的跳过."""
        existing_ids = {
            r.word_id
            for r in self.db.query(UserWord.word_id).filter(
                UserWord.user_id == user_id,
                UserWord.book_id == book_id,
            )
        }
        new_records = [
            UserWord(user_id=user_id, word_id=wid, book_id=book_id, status="new", due_date=date.today())
            for wid in word_ids
            if wid not in existing_ids
        ]
        self.db.add_all(new_records)
        self.db.commit()
        return len(new_records)

    def update_srs(
        self,
        user_id: str,
        word_id: str,
        *,
        status: str,
        ease_factor: float,
        interval_days: int,
        repetitions: int,
        due_date: date,
    ) -> UserWord | None:
        uw = self.get(user_id, word_id)
        if uw is None:
            return None
        prev_status = uw.status
        prev_interval = uw.interval_days
        uw.status = status
        uw.ease_factor = ease_factor
        uw.interval_days = interval_days
        uw.repetitions = repetitions
        uw.due_date = due_date
        uw.last_reviewed_at = date.today()
        uw.review_count += 1
        self.db.commit()
        self.db.refresh(uw)
        # 写日志
        self.db.add(
            WordReviewLog(
                user_id=user_id,
                word_id=word_id,
                rating="",  # 由 service 层补充
                prev_status=prev_status,
                new_status=status,
                prev_interval=prev_interval,
                new_interval=interval_days,
            )
        )
        self.db.commit()
        return uw

    def set_starred(self, user_id: str, word_id: str, starred: bool) -> UserWord | None:
        uw = self.get(user_id, word_id)
        if uw is None:
            return None
        uw.is_starred = starred
        self.db.commit()
        self.db.refresh(uw)
        return uw

    def count_by_rating(self, user_id: str, book_id: str, rating: str) -> int:
        """统计某词书中被特定评分（如 again）的单词数量."""
        # 从 WordReviewLog 中查询评分记录
        from app.db.models import WordReviewLog
        from sqlalchemy import func

        # 获取该词书的所有单词ID
        from app.db.models import Word
        word_ids = [w[0] for w in (
            self.db.query(Word.id)
            .filter(Word.book_id == book_id)
            .all()
        )]

        if not word_ids:
            return 0

        # 查询最后一次评分为指定评分的单词数
        subq = (
            self.db.query(
                WordReviewLog.word_id,
                func.row_number().over(
                    partition_by=WordReviewLog.word_id,
                    order_by=WordReviewLog.reviewed_at.desc()
                ).label("rn")
            )
            .filter(WordReviewLog.user_id == user_id)
            .filter(WordReviewLog.word_id.in_(word_ids))
            .subquery()
        )

        count = (
            self.db.query(func.count())
            .select_from(subq)
            .filter(subq.c.rn == 1)
            .filter(subq.c.word_id.in_(
                [w[0] for w in self.db.query(WordReviewLog.word_id)
                 .filter(WordReviewLog.user_id == user_id, WordReviewLog.rating == rating)
                 .all()]
            ))
            .scalar()
        )
        return count or 0

    def list_by_rating(self, user_id: str, book_id: str, rating: str) -> list[UserWord]:
        """获取某词书中最后一次被特定评分的单词列表."""
        from app.db.models import WordReviewLog, Word
        from sqlalchemy import func

        # 获取该词书的所有单词ID
        word_ids = [w[0] for w in (
            self.db.query(Word.id)
            .filter(Word.book_id == book_id)
            .all()
        )]

        if not word_ids:
            return []

        # 获取最后一次评分为指定评分的单词ID
        target_word_ids = [
            r[0] for r in (
                self.db.query(WordReviewLog.word_id)
                .filter(WordReviewLog.user_id == user_id)
                .filter(WordReviewLog.word_id.in_(word_ids))
                .filter(WordReviewLog.rating == rating)
                .distinct()
                .all()
            )
        ]

        if not target_word_ids:
            return []

        # 获取对应的 UserWord 记录
        return (
            self.db.query(UserWord)
            .filter(UserWord.user_id == user_id)
            .filter(UserWord.book_id == book_id)
            .filter(UserWord.word_id.in_(target_word_ids))
            .all()
        )


class ListeningRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, book_id: str | None = None, difficulty: str | None = None) -> list[ListeningMaterial]:
        q = self.db.query(ListeningMaterial)
        if book_id:
            q = q.filter(ListeningMaterial.book_id == book_id)
        if difficulty:
            q = q.filter(ListeningMaterial.difficulty == difficulty)
        return q.order_by(ListeningMaterial.created_at.desc()).all()

    def get(self, material_id: str) -> ListeningMaterial | None:
        return self.db.query(ListeningMaterial).filter(ListeningMaterial.id == material_id).first()

    def create(self, **kwargs) -> ListeningMaterial:
        m = ListeningMaterial(**kwargs)
        self.db.add(m)
        self.db.commit()
        self.db.refresh(m)
        return m

    def update_audio(self, material_id: str, audio_url: str, duration: int | None = None) -> None:
        self.db.query(ListeningMaterial).filter(ListeningMaterial.id == material_id).update(
            {"audio_url": audio_url, "audio_status": "ready", "duration_seconds": duration}
        )
        self.db.commit()


class ListeningAttemptRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, **kwargs) -> ListeningAttempt:
        a = ListeningAttempt(**kwargs)
        self.db.add(a)
        self.db.commit()
        self.db.refresh(a)
        return a

    def list_by_user(self, user_id: str, material_id: str) -> list[ListeningAttempt]:
        return (
            self.db.query(ListeningAttempt)
            .filter(ListeningAttempt.user_id == user_id, ListeningAttempt.material_id == material_id)
            .all()
        )


class StudySessionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_or_create_today(self, user_id: str) -> EnglishStudySession:
        today = date.today()
        s = (
            self.db.query(EnglishStudySession)
            .filter(
                EnglishStudySession.user_id == user_id,
                EnglishStudySession.session_date == today,
            )
            .first()
        )
        if s is None:
            s = EnglishStudySession(user_id=user_id, session_date=today, started_at=today)
            self.db.add(s)
            self.db.commit()
            self.db.refresh(s)
        return s

    def add_new_word(self, user_id: str) -> None:
        s = self.get_or_create_today(user_id)
        s.new_words += 1
        self.db.commit()

    def add_review_word(self, user_id: str) -> None:
        s = self.get_or_create_today(user_id)
        s.review_words += 1
        self.db.commit()

    def add_mastered_word(self, user_id: str) -> None:
        s = self.get_or_create_today(user_id)
        s.mastered_words += 1
        self.db.commit()

    def add_listening(self, user_id: str, correct: bool) -> None:
        s = self.get_or_create_today(user_id)
        s.listening_count += 1
        if correct:
            s.listening_correct += 1
        self.db.commit()

    def get_today(self, user_id: str) -> EnglishStudySession | None:
        today = date.today()
        return (
            self.db.query(EnglishStudySession)
            .filter(
                EnglishStudySession.user_id == user_id,
                EnglishStudySession.session_date == today,
            )
            .first()
        )

    def get_recent(self, user_id: str, days: int = 30) -> list[EnglishStudySession]:
        start = date.today() - timedelta(days=days)
        return (
            self.db.query(EnglishStudySession)
            .filter(
                EnglishStudySession.user_id == user_id,
                EnglishStudySession.session_date >= start,
            )
            .order_by(EnglishStudySession.session_date)
            .all()
        )

    def get_streak(self, user_id: str) -> int:
        """计算连续打卡天数: 从今天往回数, 遇到没有 session 的日期停止."""
        sessions = (
            self.db.query(EnglishStudySession.session_date)
            .filter(EnglishStudySession.user_id == user_id)
            .order_by(EnglishStudySession.session_date.desc())
            .all()
        )
        if not sessions:
            return 0
        dates = {s[0] for s in sessions}
        streak = 0
        today = date.today()
        # 如果今天没学, 从昨天开始数 (允许今天还没打卡)
        check_date = today if today in dates else today - timedelta(days=1)
        while check_date in dates:
            streak += 1
            check_date -= timedelta(days=1)
        return streak
