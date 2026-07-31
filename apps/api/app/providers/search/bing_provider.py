from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.search.base import SearchProvider


class BingProvider(SearchProvider):
    name = "bing"
    capabilities = {"web", "news"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        settings = get_settings()
        if not settings.bing_api_key:
            return []
        headers = {"Ocp-Apim-Subscription-Key": settings.bing_api_key}
        params = {"q": query, "count": min(limit, 10), "mkt": "zh-CN"}
        async with httpx.AsyncClient(timeout=15, headers=headers) as client:
            resp = await client.get("https://api.bing.microsoft.com/v7.0/search", params=params)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for item in data.get("webPages", {}).get("value", []):
            results.append(
                {
                    "title": item.get("name", ""),
                    "url": item.get("url", ""),
                    "snippet": item.get("snippet", ""),
                    "source_name": (item.get("displayUrl") or "").replace("www.", ""),
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
        return bool(get_settings().bing_api_key)
