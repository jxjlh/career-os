from __future__ import annotations

from datetime import datetime, timezone
from html import unescape
import re
from typing import Any

import httpx

from app.providers.search.base import SearchProvider


class HackerNewsProvider(SearchProvider):
    """HackerNews via Algolia public API (免费, 无需 key).

    返回技术讨论 / Show HN / 经验帖, 适合「学某项技术想看社区评价」场景.
    Docs: https://hn.algolia.com/api
    """

    name = "hackernews"
    capabilities = {"web", "news", "discussion"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        # story 类型, 按 popularity 排序 (points desc), 取前 limit 条
        url = "https://hn.algolia.com/api/v1/search"
        params = {
            "query": query,
            "tags": "story",
            "hitsPerPage": min(limit, 20),
            # 默认 relevance, 不强制改; 让 HN 自己按相关度给
        }
        try:
            async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "CareerOS/1.0"}) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
        except Exception:
            return []

        results: list[dict[str, Any]] = []
        for hit in data.get("hits", []):
            story_url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
            title = (hit.get("title") or "").strip()
            if not title:
                continue
            points = hit.get("points") or 0
            num_comments = hit.get("num_comments") or 0
            author = hit.get("author") or ""
            snippet_parts = []
            if points:
                snippet_parts.append(f"⭐ {points} points")
            if num_comments:
                snippet_parts.append(f"💬 {num_comments} comments")
            if author:
                snippet_parts.append(f"by {author}")
            snippet = " · ".join(snippet_parts)
            if hit.get("story_text"):
                # 去掉 HTML 标签 + 反转义 HTML 实体 (&#x2F; 等)
                text = re.sub(r"<[^>]+>", " ", hit["story_text"])
                text = unescape(text)
                text = re.sub(r"\s+", " ", text).strip()
                if text:
                    snippet = f"{snippet} | {text[:200]}" if snippet else text[:200]
            results.append(
                {
                    "title": title,
                    "url": story_url,
                    "snippet": snippet[:300],
                    "source_name": "Hacker News",
                    "provider": self.name,
                    "resource_type": "discussion",
                    "language": "en",
                    "difficulty": "mixed",
                    "is_free": True,
                    "is_official": False,
                    "published_at": _ts_to_iso(hit.get("created_at_i")),
                    "metadata": {"points": points, "comments": num_comments},
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
