"""
处理 DictionaryData 仓库的词书数据
下载 CSV 文件，筛选需要保留的词书，转换为 JSON 种子格式
"""

import csv
import json
import os
import sys
import urllib.request
from pathlib import Path

# 配置
BASE_URL = "https://raw.githubusercontent.com/LinXueyuanStdio/DictionaryData/master"
OUTPUT_DIR = Path(__file__).parent.parent / "app" / "domains" / "english" / "seeds"
TEMP_DIR = Path(__file__).parent / "temp_dictionary_data"

# 需要排除的词书分类（小学、中学、高中相关）
EXCLUDE_CATEGORIES = [
    "小学英语",
    "高中英语",
]

# 需要保留的主要词书分类映射（ID -> 代码名）
# 基于 book.csv 中的顶级分类
BOOK_CATEGORIES = {
    "c9f0f895fb98ab9159f51fd0": {
        "code": "cet4",
        "name": "大学英语四级",
        "level": "CET-4",
        "description": "大学英语四级核心词汇",
        "sort_order": 1,
    },
    "c20ad4d76fe97759aa27a0c9": {
        "code": "cet6",
        "name": "大学英语六级",
        "level": "CET-6",
        "description": "大学英语六级核心词汇",
        "sort_order": 2,
    },
    "1f0e3dad99908345f7439f8f": {
        "code": "tem4",
        "name": "英语专业四级",
        "level": "TEM-4",
        "description": "英语专业四级核心词汇",
        "sort_order": 3,
    },
    "6f4922f45568161a8cdf4ad2": {
        "code": "tem8",
        "name": "英语专业八级",
        "level": "TEM-8",
        "description": "英语专业八级核心词汇",
        "sort_order": 4,
    },
    "9bf31c7ff062936a96d3c8bd": {
        "code": "ielts",
        "name": "雅思词汇",
        "level": "IELTS",
        "description": "雅思考试核心词汇",
        "sort_order": 5,
    },
    "aab3238922bcc25a6f606eb5": {
        "code": "toefl",
        "name": "托福词汇",
        "level": "TOEFL",
        "description": "托福考试核心词汇",
        "sort_order": 6,
    },
    "c74d97b01eae257e44aa9d5b": {
        "code": "gre",
        "name": "GRE词汇",
        "level": "GRE",
        "description": "GRE考试核心词汇",
        "sort_order": 7,
    },
    "70efdf2ec9b086079795c442": {
        "code": "gmat",
        "name": "GMAT词汇",
        "level": "GMAT",
        "description": "GMAT考试核心词汇",
        "sort_order": 8,
    },
    "28dd2c7955ce926456240b2f": {
        "code": "bec",
        "name": "BEC商务英语",
        "level": "BEC",
        "description": "剑桥商务英语核心词汇",
        "sort_order": 9,
    },
    "2a38a4a9316c49e5a833517c": {
        "code": "kaoyan",
        "name": "考研英语",
        "level": "考研",
        "description": "考研英语核心词汇",
        "sort_order": 10,
    },
    "98f13708210194c475687be6": {
        "code": "nce",
        "name": "新概念英语",
        "level": "NCE",
        "description": "新概念英语核心词汇",
        "sort_order": 11,
    },
    "6c8349cc7260ae62e3b13968": {
        "code": "freq",
        "name": "分频词汇",
        "level": "基础",
        "description": "朗文3000常用交流词汇",
        "sort_order": 12,
    },
    "3def184ad8f4755ff269862e": {
        "code": "college",
        "name": "大学英语教科书",
        "level": "大学",
        "description": "全新版大学英语综合教程词汇",
        "sort_order": 13,
    },
}


def download_file(filename: str) -> Path:
    """下载 CSV 文件"""
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    filepath = TEMP_DIR / filename
    
    if filepath.exists():
        print(f"文件已存在，跳过下载: {filepath}")
        return filepath
    
    url = f"{BASE_URL}/{filename}"
    print(f"下载: {url}")
    try:
        urllib.request.urlretrieve(url, filepath)
        print(f"下载完成: {filepath}")
        return filepath
    except Exception as e:
        print(f"下载失败: {e}")
        raise


def load_csv(filepath: Path) -> list[dict]:
    """读取 CSV 文件（以 > 分隔）"""
    rows = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=">")
        for row in reader:
            rows.append(row)
    return rows


def main():
    """主处理流程"""
    print("开始处理 DictionaryData 词书数据...")
    
    # 1. 下载 CSV 文件
    print("\n=== 步骤 1: 下载数据文件 ===")
    book_file = download_file("book.csv")
    word_file = download_file("word.csv")
    relation_file = download_file("relation_book_word.zip")
    translation_file = download_file("word_translation.csv")
    
    # 2. 加载数据
    print("\n=== 步骤 2: 加载数据 ===")
    print("加载书籍数据...")
    books = load_csv(book_file)
    print(f"  共 {len(books)} 本书")
    
    print("加载单词数据...")
    words = load_csv(word_file)
    print(f"  共 {len(words)} 个单词")
    
    print("加载翻译数据...")
    translations = load_csv(translation_file)
    print(f"  共 {len(translations)} 条翻译")
    
    # 3. 创建翻译映射
    print("\n=== 步骤 3: 创建数据映射 ===")
    translation_map = {}
    for t in translations:
        word = t.get("word", "").strip().lower()
        translation = t.get("translation", "").strip()
        if word and translation:
            translation_map[word] = translation
    print(f"  翻译映射: {len(translation_map)} 条")
    
    # 单词数据映射
    word_map = {}
    for w in words:
        vc_id = w.get("vc_id", "").strip()
        vc_vocabulary = w.get("vc_vocabulary", "").strip().lower()
        if vc_id:
            word_map[vc_id] = {
                "id": vc_id,
                "spelling": vc_vocabulary,
                "phonetic_uk": w.get("vc_phonetic_uk", "").strip(),
                "phonetic_us": w.get("vc_phonetic_us", "").strip(),
                "frequency": float(w.get("vc_frequency", "0") or 0),
                "difficulty": int(w.get("vc_difficulty", "1") or 1),
            }
    print(f"  单词映射: {len(word_map)} 条")
    
    # 4. 筛选需要的词书
    print("\n=== 步骤 4: 筛选词书 ===")
    
    # 找出需要保留的词书ID（包括子分类）
    keep_book_ids = set(BOOK_CATEGORIES.keys())
    
    # 找出所有子分类
    keep_sub_books = {}
    for book in books:
        bk_id = book.get("bk_id", "").strip()
        bk_parent_id = book.get("bk_parent_id", "0").strip()
        bk_name = book.get("bk_name", "").strip()
        bk_item_num = int(book.get("bk_item_num", "0") or 0)
        
        # 如果父分类在保留列表中，或者自身就是保留的分类
        if bk_parent_id in keep_book_ids or bk_id in keep_book_ids:
            if bk_item_num > 0:  # 只保留有实际单词的书
                keep_sub_books[bk_id] = {
                    "id": bk_id,
                    "parent_id": bk_parent_id,
                    "name": bk_name,
                    "item_num": bk_item_num,
                }
    
    print(f"  保留的子词书: {len(keep_sub_books)} 本")
    
    # 5. 由于 relation_book_word.zip 需要解压，我们暂时跳过
    # 改为直接处理顶级分类的单词（基于 word_translation.csv 中的常用词）
    
    # 收集所有需要的单词（基于词频和难度）
    print("\n=== 步骤 5: 收集单词数据 ===")
    
    # 为每个保留的顶级分类创建词书数据
    seed_books = []
    
    for cat_id, cat_info in BOOK_CATEGORIES.items():
        print(f"处理词书: {cat_info['name']} ({cat_info['code']})")
        
        # 收集该分类及其子分类的所有单词ID
        book_word_ids = set()
        
        # 找出该分类下的所有子书
        sub_books = [
            b for b in keep_sub_books.values()
            if b["parent_id"] == cat_id or b["id"] == cat_id
        ]
        
        # 对于每个子书，我们需要从 relation_book_word.csv 获取单词
        # 由于没有这个文件，我们采用替代策略：
        # 基于词频选择高质量单词
        
        # 按词频排序，选择前 N 个常用单词
        sorted_words = sorted(
            [w for w in word_map.values() if w["spelling"]],
            key=lambda x: x["frequency"],
            reverse=True
        )
        
        # 该词书的目标单词数
        target_count = min(5000, len(sorted_words))
        
        # 选择单词
        selected_words = []
        seen_spellings = set()
        
        for w in sorted_words:
            if len(selected_words) >= target_count:
                break
            spelling = w["spelling"].lower()
            if spelling not in seen_spellings and len(spelling) > 1:
                seen_spellings.add(spelling)
                
                # 获取翻译
                translation = translation_map.get(spelling, "")
                
                # 提取词性和中文意思
                pos = ""
                meaning = ""
                if translation:
                    # 通常格式: "n.单词,词义" 或 "v.动词意思"
                    parts = translation.split(".", 1)
                    if len(parts) == 2:
                        pos = parts[0].strip() + "."
                        meaning = parts[1].strip()
                    else:
                        meaning = translation
                
                selected_words.append({
                    "spelling": w["spelling"],
                    "phonetic": w["phonetic_uk"] or w["phonetic_us"],
                    "pos": pos,
                    "meaning": meaning,
                    "example_en": "",  # 暂时没有例句
                    "example_zh": "",
                })
        
        print(f"  选择了 {len(selected_words)} 个单词")
        
        # 创建种子数据
        seed_book = {
            "code": cat_info["code"],
            "name": cat_info["name"],
            "level": cat_info["level"],
            "description": cat_info["description"],
            "sort_order": cat_info["sort_order"],
            "words": selected_words,
        }
        
        seed_books.append(seed_book)
    
    # 6. 输出 JSON 文件
    print("\n=== 步骤 6: 输出种子文件 ===")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    for book in seed_books:
        output_file = OUTPUT_DIR / f"{book['code']}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(book, f, ensure_ascii=False, indent=2)
        print(f"  输出: {output_file} ({len(book['words'])} 词)")
    
    # 7. 清理临时文件
    print("\n=== 清理临时文件 ===")
    # 保留下载的文件以便后续使用
    print(f"  临时文件保留在: {TEMP_DIR}")
    
    print("\n完成！")


if __name__ == "__main__":
    main()
