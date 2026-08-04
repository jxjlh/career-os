from __future__ import annotations

from datetime import datetime, timezone
from html import unescape
from typing import Any

import httpx

from app.providers.search.base import SearchProvider


class StackOverflowProvider(SearchProvider):
    """Stack Overflow / Stack Exchange 公开 API (免费, 无需 key).

    API: https://api.stackexchange.com/2.3/search/advanced?site=stackoverflow&q=...
    返回高分技术问答, 带 tags / votes / 是否已回答, 适合「踩坑找解决方案」场景.
    限速: 无 key 时每 IP 300 请求 / 天, 对个人项目够用.
    Docs: https://api.stackexchange.com/docs/search
    """

    name = "stackoverflow"
    capabilities = {"web", "docs", "discussion", "qa"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        url = "https://api.stackexchange.com/2.3/search/advanced"
        params = {
            "order": "desc",
            "sort": "votes",  # 按投票数排序, 高质量问答优先
            "q": query,
            "site": "stackoverflow",
            "pagesize": min(limit, 10),
            "filter": "withbody",  # 包含 answer_count / body snippet
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
        except Exception:
            return []

        results: list[dict[str, Any]] = []
        for item in data.get("items", [])[:limit]:
            title = unescape((item.get("title") or "").strip())
            if not title:
                continue
            link = item.get("link") or ""
            if not link:
                continue
            score = item.get("score", 0)
            answer_count = item.get("answer_count", 0)
            is_answered = item.get("is_answered", False)
            tags = item.get("tags") or []
            owner = (item.get("owner") or {}).get("display_name", "")

            # 拼 snippet: 投票数 + 答案数 + 标签 + body 摘要
            snippet_parts = []
            if score:
                snippet_parts.append(f"⬆ {score} votes")
            if answer_count:
                snippet_parts.append(f"💬 {answer_count} answers")
            if is_answered:
                snippet_parts.append("✓ 已解决")
            if owner:
                snippet_parts.append(f"by {owner}")
            snippet = " · ".join(snippet_parts)
            if tags:
                tag_str = " ".join(f"#{t}" for t in tags[:5])
                snippet = f"{snippet} | {tag_str}" if snippet else tag_str

            # body 是 HTML, 抽纯文本做摘要
            body = item.get("body") or ""
            if body:
                import re

                body_text = re.sub(r"<[^>]+>", " ", body)
                body_text = unescape(body_text)
                body_text = re.sub(r"\s+", " ", body_text).strip()
                if body_text:
                    snippet = f"{snippet} | {body_text[:200]}" if snippet else body_text[:200]

            results.append(
                {
                    "title": title,
                    "url": link,
                    "snippet": snippet[:300],
                    "source_name": "Stack Overflow",
                    "provider": self.name,
                    "resource_type": "qa",
                    "language": "en",
                    "difficulty": "mixed",
                    "is_free": True,
                    "is_official": True,
                    "published_at": _ts_to_iso(item.get("creation_date")),
                    "metadata": {
                        "score": score,
                        "answer_count": answer_count,
                        "is_answered": is_answered,
                        "tags": tags,
                        "view_count": item.get("view_count", 0),
                    },
                }
            )
        return results

    async def healthcheck(self) -> bool:
        return True


def _ts_to_iso(ts: Any) -> str | None:
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except (TypeError, ValueError):
        return None
