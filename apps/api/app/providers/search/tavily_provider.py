from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.search.base import SearchProvider


class TavilyProvider(SearchProvider):
    name = "tavily"
    capabilities = {"web", "docs", "news"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        settings = get_settings()
        if not settings.tavily_api_key:
            return []
        payload = {"api_key": settings.tavily_api_key, "query": query, "max_results": min(limit, 10)}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post("https://api.tavily.com/search", json=payload)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for item in data.get("results", []):
            results.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "snippet": (item.get("content") or "")[:300],
                    "source_name": item.get("source", "Tavily"),
                    "provider": self.name,
                    "resource_type": "article",
                    "language": filters.get("language", "zh"),
                    "difficulty": "mixed",
                    "is_free": True,
                    "is_official": False,
                    "score": item.get("score"),
                }
            )
        return results

    async def healthcheck(self) -> bool:
        return bool(get_settings().tavily_api_key)
