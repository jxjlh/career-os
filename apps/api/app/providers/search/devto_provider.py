from __future__ import annotations

from typing import Any

import httpx

from app.providers.search.base import SearchProvider


class DevtoProvider(SearchProvider):
    """Dev.to public article API (免费, 无需 key).

    返回 dev.to 上技术博客文章, 覆盖前端 / 后端 / DevOps / 职业成长等话题.
    Docs: https://developers.forem.com/api/v1#tag/articles/operation/getArticles
    """

    name = "devto"
    capabilities = {"web", "docs", "blog"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        # dev.to 官方 API: GET /api/articles?tag=...&per_page=...
        # 不支持全文 search, 但支持按 tag 取最新文章 + 客户端按 title 包含 query 过滤
        # 改用 Forem search endpoint: GET /api/articles/search?term=QUERY
        url = "https://dev.to/api/articles/search"
        params = {
            "term": query,
            "per_page": min(limit, 30),
        }
        try:
            async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "CareerOS/1.0", "Accept": "application/json"}) as client:
                resp = await client.get(url, params=params)
                # 某些版本不支持 search 端点, 回退到 tag 列表
                if resp.status_code != 200:
                    return await self._fallback_tag_search(query, limit)
                data = resp.json()
        except Exception:
            return []

        results: list[dict[str, Any]] = []
        for item in data[: min(limit, 30)]:
            title = (item.get("title") or "").strip()
            path = item.get("path") or ""
            if not title or not path:
                continue
            url = f"https://dev.to{path}" if path.startswith("/") else path
            tags = item.get("tag_list") or []
            tag_str = " · ".join(f"#{t}" for t in tags[:3]) if tags else ""
            snippet_parts = []
            if item.get("user"):
                snippet_parts.append(f"by @{item['user'].get('username', '')}")
            if tag_str:
                snippet_parts.append(tag_str)
            if item.get("public_reactions_count"):
                snippet_parts.append(f"❤️ {item['public_reactions_count']}")
            snippet = " · ".join(snippet_parts)
            results.append(
                {
                    "title": title,
                    "url": url,
                    "snippet": snippet[:300],
                    "source_name": "Dev.to",
                    "provider": self.name,
                    "resource_type": "article",
                    "language": "en",
                    "difficulty": "mixed",
                    "is_free": True,
                    "is_official": False,
                    "published_at": item.get("published_at"),
                    "metadata": {"tags": tags, "reading_time_minutes": item.get("reading_time_minutes")},
                }
            )
        return results

    async def _fallback_tag_search(self, query: str, limit: int) -> list[dict[str, Any]]:
        """Dev.to search 端点不可用时, 用 query 作为 tag 取最新文章."""
        # 简单做: 把 query 拆 token 当 tag 试, 不命中就跳过
        tokens = [t.lower() for t in query.replace("/", " ").split() if len(t) >= 2][:3]
        if not tokens:
            return []
        results: list[dict[str, Any]] = []
        for tag in tokens:
            try:
                async with httpx.AsyncClient(timeout=8, headers={"User-Agent": "CareerOS/1.0"}) as client:
                    resp = await client.get(f"https://dev.to/api/articles", params={"tag": tag, "per_page": min(limit, 10)})
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
            except Exception:
                continue
            for item in data[: min(limit, 10)]:
                title = (item.get("title") or "").strip()
                if not title:
                    continue
                results.append(
                    {
                        "title": title,
                        "url": item.get("url", ""),
                        "snippet": f"by @{item.get('user', {}).get('username', '')} · ❤️ {item.get('public_reactions_count', 0)}",
                        "source_name": "Dev.to",
                        "provider": self.name,
                        "resource_type": "article",
                        "language": "en",
                        "difficulty": "mixed",
                        "is_free": True,
                        "is_official": False,
                        "published_at": item.get("published_at"),
                    }
                )
        return results[:limit]

    async def healthcheck(self) -> bool:
        return True
