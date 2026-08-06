"""英语学习种子词库.

dev/test 环境启动时通过 lifespan 幂等写入, 保证 /english 页面有词书可消费.
生产环境也执行: 清理旧的低质量词数据, 替换为 JSON 种子文件中的精选词汇.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.models import UserWord, Word, WordBook

SEEDS_DIR = Path(__file__).parent / "seeds"
logger = logging.getLogger("app.english.seed")

# 种子文件的版本号 —— 修改词书内容后递增此版本号可触发全量重建
SEED_VERSION = "2026-08-06-v2"


def seed_word_books(db: Session) -> None:
    """幂等写入种子词库. 如果词书已存在但版本不同, 全量替换单词."""
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
            logger.info("Created word book: %s (%d words)", code, len(words_data))
        else:
            # 已有词书 → 检查版本是否需要全量重建
            stored_version = (book.description or "").split("v")[-1] if "v" in (book.description or "") else ""
            if stored_version == SEED_VERSION.split("v")[-1]:
                # 版本相同, 跳过
                continue

            # 版本不同 → 全量替换: 先删旧词和用户进度, 再插入新词
            db.execute(delete(UserWord).where(UserWord.book_id == book.id))
            db.execute(delete(Word).where(Word.book_id == book.id))
            db.flush()
            book.name = data.get("name", code)
            book.level = data.get("level", code)
            book.total_words = len(words_data)
            logger.info("Rebuilding word book: %s (%d words)", code, len(words_data))

        # 插入单词
        for idx, w in enumerate(words_data):
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

        # 在 description 中嵌入版本号, 用于下次启动判断是否需要重建
        base_desc = data.get("description", "")
        book.description = f"{base_desc} [{SEED_VERSION}]"
        db.commit()

