"""Build complete word-book seed files from the DictionaryData relation table.

DictionaryData is Apache-2.0 licensed. The relation table is important here:
sorting the global dictionary by frequency produces the same truncated list for
every book and loses the actual book membership.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import zipfile
from collections import defaultdict
from pathlib import Path


BOOKS = {
    "act": ("9b04d152845ec0a378394003", "ACT词汇", "ACT", "ACT 完整词汇", 1),
    "bec": ("28dd2c7955ce926456240b2f", "BEC词汇", "BEC", "BEC 商务英语完整词汇", 9),
    "cet4": ("c9f0f895fb98ab9159f51fd0", "大学英语四级词汇", "CET-4", "大学英语四级完整词汇", 2),
    "cet6": ("c20ad4d76fe97759aa27a0c9", "大学英语六级词汇", "CET-6", "大学英语六级完整词汇", 3),
    "college": ("3def184ad8f4755ff269862e", "大学英语教科书类", "大学", "大学英语教科书类完整词汇", 13),
    "freq": ("6c8349cc7260ae62e3b13968", "分频词汇", "基础", "分频完整词汇", 12),
    "gmat": ("70efdf2ec9b086079795c442", "GMAT词汇", "GMAT", "GMAT 完整词汇", 8),
    "gre": ("c74d97b01eae257e44aa9d5b", "GRE词汇", "GRE", "GRE 完整词汇", 7),
    "ielts": ("9bf31c7ff062936a96d3c8bd", "雅思词汇", "IELTS", "雅思完整词汇", 6),
    "kaobo": ("58b8026d9e9323e74aafe089", "考博英语", "考博", "考博英语完整词汇", 11),
    "kaoyan": ("2a38a4a9316c49e5a833517c", "考研英语", "考研", "考研英语完整词汇", 10),
    "mba": ("58b803e59e9323e74aafe08d", "MBA词汇", "MBA", "MBA 完整词汇", 15),
    "nce": ("98f13708210194c475687be6", "新概念英语", "NCE", "新概念英语完整词汇", 14),
    "netem": ("58b803ba9e9323e74aafe08c", "全国等级考试", "NETEM", "全国等级考试完整词汇", 16),
    "other": ("6974ce5ac660610b44d9b9fe", "其他书籍", "其他", "其他英语书籍完整词汇", 99),
    "sat": ("c51ce410c124a10e0db5e4b9", "SAT词汇", "SAT", "SAT 完整词汇", 5),
    "tem4": ("1f0e3dad99908345f7439f8f", "大学英语专业四级", "TEM-4", "英语专业四级完整词汇", 4),
    "tem8": ("6f4922f45568161a8cdf4ad2", "大学英语专业八级", "TEM-8", "英语专业八级完整词汇", 18),
    "toefl": ("aab3238922bcc25a6f606eb5", "托福词汇", "TOEFL", "托福完整词汇", 5),
    "toeic": ("8d5e957f297893487bd98fa8", "托业词汇", "TOEIC", "托业完整词汇", 17),
}


def parse_translation(value: str) -> tuple[str, str]:
    value = " ".join(value.replace("\n", " ").split())
    if not value:
        return "", "暂无释义"
    first = value.split(" ", 1)[0]
    if "." in first and len(first) <= 12:
        pos, remainder = first, value[len(first) :].strip()
        return pos, remainder or value
    return "", value


def descendants(children: dict[str, list[str]], root: str) -> set[str]:
    result = {root}
    stack = [root]
    while stack:
        current = stack.pop()
        for child in children.get(current, []):
            if child not in result:
                result.add(child)
                stack.append(child)
    return result


def build(source_dir: Path, output_dir: Path) -> None:
    with (source_dir / "book.csv").open(encoding="utf-8") as handle:
        books = list(csv.DictReader(handle, delimiter=">"))
    children: dict[str, list[str]] = defaultdict(list)
    for book in books:
        children[book["bk_parent_id"].strip()].append(book["bk_id"].strip())

    word_map: dict[str, dict[str, str]] = {}
    with (source_dir / "word.csv").open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter=">"):
            word_id = row["vc_id"].strip()
            word_map[word_id] = row

    translations: dict[str, str] = {}
    with (source_dir / "word_translation.csv").open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            spelling = row.get("word", "").strip().lower()
            if spelling and row.get("translation", "").strip():
                translations.setdefault(spelling, row["translation"].strip())

    relations_by_book: dict[str, list[tuple[int, str]]] = defaultdict(list)
    with zipfile.ZipFile(source_dir / "relation_book_word.zip") as archive:
        with archive.open("relation_book_word.csv") as raw:
            reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8"), delimiter=">")
            for row in reader:
                try:
                    order = int(row.get("bv_order", "0") or 0)
                except ValueError:
                    order = 0
                relations_by_book[row["bv_book_id"].strip()].append((order, row["bv_voc_id"].strip()))

    output_dir.mkdir(parents=True, exist_ok=True)
    for code, (root_id, name, level, description, sort_order) in BOOKS.items():
        book_ids = descendants(children, root_id)
        ordered_ids = sorted(
            (entry for book_id in book_ids for entry in relations_by_book.get(book_id, [])),
            key=lambda entry: (entry[0], entry[1]),
        )
        seen_word_ids: set[str] = set()
        seen_spellings: set[str] = set()
        words: list[dict[str, str]] = []
        for _, word_id in ordered_ids:
            if word_id in seen_word_ids or word_id not in word_map:
                continue
            source = word_map[word_id]
            spelling = source.get("vc_vocabulary", "").strip()
            spelling_key = spelling.casefold()
            if not spelling or spelling_key in seen_spellings:
                continue
            seen_word_ids.add(word_id)
            seen_spellings.add(spelling_key)
            pos, meaning = parse_translation(translations.get(spelling.lower(), ""))
            words.append(
                {
                    "spelling": spelling,
                    "phonetic": source.get("vc_phonetic_us", "").strip() or source.get("vc_phonetic_uk", "").strip(),
                    "pos": pos,
                    "meaning": meaning,
                    "example_en": "",
                    "example_zh": "",
                }
            )
        payload = {
            "code": code,
            "name": name,
            "level": level,
            "description": description,
            "sort_order": sort_order,
            "source": "DictionaryData relation_book_word.csv (Apache-2.0)",
            "words": words,
        }
        (output_dir / f"{code}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{code}: {len(words)} words")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent.parent / "app/domains/english/seeds")
    args = parser.parse_args()
    build(args.source_dir, args.output_dir)
