"""英语学习种子词库.

dev/test 环境启动时通过 lifespan 幂等写入, 保证 /english 页面有词书可消费.
参考 bucket/seed.py 的幂等写入模式: 按唯一 code 检查是否存在, 不存在才插入.
"""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models import Word, WordBook

SEEDS_DIR = Path(__file__).parent / "seeds"


def seed_word_books(db: Session) -> None:
    """幂等写入种子词库. 已存在的词书 (按 code) 追加缺失的单词, 不覆盖已有词."""
    if not SEEDS_DIR.exists():
        return

    for json_file in sorted(SEEDS_DIR.glob("*.json")):
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        code = data.get("code", "")
        if not code:
            continue

        words_data = data.get("words", [])

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
            existing_spellings: set[str] = set()
        else:
            # 已有词书 → 查已有单词，只追加缺失的
            existing_spellings = {
                r.spelling
                for r in db.query(Word.spelling).filter(Word.book_id == book.id).all()
            }

        added = 0
        for idx, w in enumerate(words_data):
            if w["spelling"] in existing_spellings:
                continue
            db.add(
                Word(
                    book_id=book.id,
                    spelling=w["spelling"],
                    phonetic=w.get("phonetic"),
                    pos=w.get("pos"),
                    meaning=w.get("meaning", ""),
                    example_en=w.get("example_en"),
                    example_zh=w.get("example_zh"),
                    sort_order=idx,
                )
            )
            added += 1

        # 更新词书总词数
        if added > 0:
            book.total_words = len(words_data)
            db.commit()
