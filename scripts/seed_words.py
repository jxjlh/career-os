#!/usr/bin/env python3
"""批量插入词书单词数据到 Supabase.

读取 seeds/*.json，为每个单词生成 UUID，通过 REST API 批量插入。
解决 words 表 id 字段无 server_default 导致 REST API 插入失败的问题。
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

SUPABASE_URL = "https://odthfgmjgutpsfjkmvto.supabase.co"
SUPABASE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdGhmZ21qZ3V0cHNmamttdnRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQ2MjE1NywiZXhwIjoyMTAxMDM4MTU3fQ.s3UL2Jpi7eMmE9AAh5d08WuDzNcUsSupjOu8ja81KNQ",
)
SEEDS_DIR = Path(__file__).resolve().parent.parent / "apps/api/app/domains/english/seeds"

# 词书 code → id 映射（word_books 表的 id 是 wb-{code} 格式）
BOOK_ID_MAP = {
    "cet4": "wb-cet4",
    "cet6": "wb-cet6",
    "ielts": "wb-ielts",
    "toefl": "wb-toefl",
    "gre": "wb-gre",
}


def supabase_request(method: str, path: str, body=None):
    """发送 Supabase REST API 请求."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        return e.code, err_body
    except URLError as e:
        return 0, str(e)


def clear_existing_data():
    """清理 words 和 user_words 表的残留数据."""
    print("=== 清理残留数据 ===")

    # 先清理 user_words（外键依赖 words）
    status, body = supabase_request("DELETE", "user_words?id=gt.0")
    print(f"  user_words 清理: HTTP {status}")

    # 再清理 words
    status, body = supabase_request("DELETE", "words?id=gt.0")
    print(f"  words 清理: HTTP {status}")


def load_and_prepare_words():
    """读取所有种子 JSON，生成带 UUID 的插入数据."""
    all_rows = []
    for json_file in sorted(SEEDS_DIR.glob("*.json")):
        data = json.loads(json_file.read_text(encoding="utf-8"))
        code = data.get("code", "")
        book_id = BOOK_ID_MAP.get(code)
        if not book_id:
            print(f"  ⚠️ 未知词书 code: {code}, 跳过")
            continue

        now_iso = datetime.now(timezone.utc).isoformat()
        words = data.get("words", [])
        for idx, w in enumerate(words):
            all_rows.append(
                {
                    "id": str(uuid.uuid4()),
                    "book_id": book_id,
                    "spelling": w["spelling"],
                    "phonetic": w.get("phonetic"),
                    "pos": w.get("pos"),
                    "meaning": w.get("meaning", ""),
                    "example_en": w.get("example_en"),
                    "example_zh": w.get("example_zh"),
                    "sort_order": idx,
                    "created_at": now_iso,
                }
            )
        print(f"  {json_file.name}: {len(words)} 词 → book_id={book_id}")

    print(f"  总计: {len(all_rows)} 条单词")
    return all_rows


def batch_insert(rows, batch_size=50):
    """分批插入数据到 words 表."""
    print(f"\n=== 批量插入 {len(rows)} 条数据（每批 {batch_size} 条）===")
    success_count = 0
    fail_count = 0

    url = f"{SUPABASE_URL}/rest/v1/words"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        data = json.dumps(batch).encode("utf-8")
        req = Request(url, data=data, headers=headers, method="POST")
        try:
            with urlopen(req, timeout=30) as resp:
                success_count += len(batch)
                print(f"  批次 {i // batch_size + 1}: ✅ {len(batch)} 条 (累计 {success_count})")
        except HTTPError as e:
            err_body = e.read().decode("utf-8") if e.fp else ""
            fail_count += len(batch)
            print(f"  批次 {i // batch_size + 1}: ❌ HTTP {e.code} - {err_body[:300]}")
        except URLError as e:
            fail_count += len(batch)
            print(f"  批次 {i // batch_size + 1}: ❌ 网络错误 - {e}")

    print(f"\n插入完成: ✅ {success_count} 成功, ❌ {fail_count} 失败")
    return success_count, fail_count


def verify_data():
    """验证各词书的单词数量."""
    print("\n=== 验证数据 ===")
    for code, book_id in BOOK_ID_MAP.items():
        url = f"{SUPABASE_URL}/rest/v1/words?book_id=eq.{book_id}&select=id"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "count=exact",
            "Range": "0-0",
        }
        req = Request(url, headers=headers, method="GET")
        try:
            with urlopen(req, timeout=15) as resp:
                content_range = resp.headers.get("content-range", "?")
                total = content_range.split("/")[-1] if "/" in content_range else "?"
                # 取前3个单词拼写验证
                url2 = f"{SUPABASE_URL}/rest/v1/words?book_id=eq.{book_id}&select=spelling&order=sort_order.asc&limit=3"
                headers2 = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                }
                req2 = Request(url2, headers=headers2, method="GET")
                with urlopen(req2, timeout=15) as resp2:
                    sample = json.loads(resp2.read().decode("utf-8"))
                    spellings = [w["spelling"] for w in sample]
                print(f"  {code}: {total} 词 | 示例: {', '.join(spellings)}")
        except Exception as e:
            print(f"  {code}: ❌ 查询失败 - {e}")


def main():
    print("=" * 60)
    print("Supabase 词书数据批量插入工具")
    print("=" * 60)

    # 1. 清理残留数据
    clear_existing_data()

    # 2. 读取种子文件并准备数据
    print("\n=== 读取种子文件 ===")
    rows = load_and_prepare_words()
    if not rows:
        print("⚠️ 没有数据可插入，退出")
        return

    # 3. 批量插入
    success, fail = batch_insert(rows)

    # 4. 验证
    verify_data()

    print("\n" + "=" * 60)
    if fail == 0:
        print("✅ 全部完成！所有词书数据已成功插入")
    else:
        print(f"⚠️ 部分失败: {fail} 条未插入")
    print("=" * 60)


if __name__ == "__main__":
    main()
