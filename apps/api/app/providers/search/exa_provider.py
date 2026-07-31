from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.search.base import SearchProvider


class ExaProvider(SearchProvider):
    name = "exa"
    capabilities = {"web", "docs", "papers", "news"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        settings = get_settings()
        if not settings.exa_api_key:
            return []
        headers = {"x-api-key": settings.exa_api_key}
        payload = {"query": query, "numResults": min(limit, 10), "contents": {"text": {"maxCharacters": 300}}}
        async with httpx.AsyncClient(timeout=15, headers=headers) as client:
            resp = await client.post("https://api.exa.ai/search", json=payload)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for item in data.get("results", []):
            results.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "snippet": (item.get("text") or item.get("contents", {}).get("text") or "")[:300],
                    "source_name": item.get("publishedDate", "Exa"),
                    "provider": self.name,
                    "resource_type": "article",
                    "language": filters.get("language", "zh"),
                    "difficulty": "mixed",
                    "is_free": True,
                    "is_official": False,
                    "published_at": item.get("publishedDate"),
                }
            )
        return results

    async def healthcheck(self) -> bool:
        return bool(get_settings().exa_api_key)
