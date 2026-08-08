"""英语学习种子词库.

dev/test 环境启动时通过 lifespan 幂等写入, 保证 /english 页面有词书可消费.
生产环境也执行: 清理旧的截断词数据, 替换为 JSON 种子文件中的完整词书关系数据.
"""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models import UserWord, Word, WordBook, WordReviewLog

SEEDS_DIR = Path(__file__).parent / "seeds"
logger = logging.getLogger("app.english.seed")

# 种子文件的版本号 —— 修改词书内容后递增此版本号可触发全量重建
SEED_VERSION = "2026-08-08-v7-complete-relation-data"


def stable_word_id(book_code: str, spelling: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"career-os:word:{book_code}:{spelling.casefold()}"))


def seed_word_books(db: Session) -> None:
    """幂等写入种子词库. 如果词书已存在但版本不同, 全量替换单词."""
    if not SEEDS_DIR.exists():
        return

    try:
        for json_file in sorted(SEEDS_DIR.glob("*.json")):
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue

            code = data.get("code", "")
            if not code:
                continue

            words_data = data.get("words", [])

            # Deduplicate words by spelling (keep first occurrence)
            seen_spellings = set()
            unique_words = []
            for w in words_data:
                spelling = w["spelling"]
                if spelling not in seen_spellings:
                    seen_spellings.add(spelling)
                    unique_words.append(w)
            if len(unique_words) != len(words_data):
                logger.info("Deduplicated %s: %d -> %d words", code, len(words_data), len(unique_words))
                words_data = unique_words

            # 查找已有词书
            book = db.query(WordBook).filter(WordBook.code == code).first()

            if book is None:
                # 新词书 → 创建
                book = WordBook(
                    code=code,
                    name=data.get("name", code),
                    level=data.get("level", code),
                    description=data.get("description"),
                    total_words=len(words_data),
                    sort_order=data.get("sort_order", 99),
                )
                db.add(book)
                db.flush()
                logger.info("Created word book: %s (%d words)", code, len(words_data))
            else:
                # 已有词书 → 检查版本是否需要全量重建
                stored_version = (book.description or "").split("v")[-1] if "v" in (book.description or "") else ""
                if stored_version == SEED_VERSION.split("v")[-1]:
                    # 版本相同, 跳过
                    continue

                # 版本不同 → 按拼写更新/补齐，保留已有 Word.id、UserWord 和复习日志。
                # 不能直接删除整本词书，否则用户已经积累的背词进度会丢失。
                book.name = data.get("name", code)
                book.level = data.get("level", code)
                book.total_words = len(words_data)
                logger.info("Rebuilding word book: %s (%d words)", code, len(words_data))

            existing_words = db.query(Word).filter(Word.book_id == book.id).all()
            existing_by_spelling = {word.spelling.casefold(): word for word in existing_words}
            seeded_spellings: set[str] = set()
            new_mappings: list[dict] = []
            for idx, word_data in enumerate(words_data):
                spelling = word_data["spelling"]
                spelling_key = spelling.casefold()
                seeded_spellings.add(spelling_key)
                word = existing_by_spelling.get(spelling_key)
                if word is None:
                    new_mappings.append(
                        {
                            "id": stable_word_id(code, spelling),
                            "book_id": book.id,
                            "spelling": spelling,
                            "phonetic": word_data.get("phonetic"),
                            "pos": word_data.get("pos"),
                            "meaning": word_data.get("meaning", "暂无释义"),
                            "example_en": word_data.get("example_en"),
                            "example_zh": word_data.get("example_zh"),
                            "sort_order": idx,
                        }
                    )
                    continue
                word.spelling = spelling
                word.phonetic = word_data.get("phonetic")
                word.pos = word_data.get("pos")
                word.meaning = word_data.get("meaning", "暂无释义")
                word.example_en = word_data.get("example_en")
                word.example_zh = word_data.get("example_zh")
                word.sort_order = idx

            for start in range(0, len(new_mappings), 1000):
                db.bulk_insert_mappings(Word, new_mappings[start : start + 1000])

            # 仅清理没有用户进度、没有复习日志的旧词条；有历史记录的保留在词书末尾。
            progress_word_ids = {
                row.word_id for row in db.query(UserWord.word_id).filter(UserWord.book_id == book.id).all()
            }
            review_word_ids = {
                row.word_id for row in db.query(WordReviewLog.word_id).filter(WordReviewLog.word_id.in_([w.id for w in existing_words])).all()
            }
            for word in existing_words:
                if word.spelling.casefold() not in seeded_spellings and word.id not in progress_word_ids and word.id not in review_word_ids:
                    db.delete(word)

            db.flush()

            # 在 description 中嵌入版本号, 用于下次启动判断是否需要重建
            base_desc = data.get("description", "")
            book.description = f"{base_desc} [{SEED_VERSION}]"
            db.commit()
    except Exception as e:
        logger.error("Failed to seed word books: %s", str(e))
        db.rollback()
