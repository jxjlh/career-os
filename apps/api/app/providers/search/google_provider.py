from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.search.base import SearchProvider


class GoogleSearchProvider(SearchProvider):
    name = "google"
    capabilities = {"web"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        settings = get_settings()
        if not settings.google_search_api_key or not settings.google_search_cx:
            return []
        params = {
            "key": settings.google_search_api_key,
            "cx": settings.google_search_cx,
            "q": query,
            "num": min(limit, 10),
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get("https://www.googleapis.com/customsearch/v1", params=params)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for item in data.get("items", []):
            results.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                    "source_name": (item.get("displayLink") or "").replace("www.", ""),
                    "provider": self.name,
                    "resource_type": "article",
                    "language": filters.get("language", "zh"),
                    "difficulty": "mixed",
                    "is_free": True,
                    "is_official": False,
                }
            )
        return results

    async def healthcheck(self) -> bool:
        return bool(get_settings().google_search_api_key and get_settings().google_search_cx)
