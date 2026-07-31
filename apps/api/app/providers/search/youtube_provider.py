from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.search.base import SearchProvider


class YouTubeProvider(SearchProvider):
    name = "youtube"
    capabilities = {"video"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        settings = get_settings()
        if not settings.youtube_api_key:
            return []
        params = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": min(limit, 10),
            "key": settings.youtube_api_key,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get("https://www.googleapis.com/youtube/v3/search", params=params)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            video_id = item.get("id", {}).get("videoId", "")
            results.append(
                {
                    "title": snippet.get("title", ""),
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "snippet": snippet.get("description", "")[:300],
                    "source_name": "YouTube",
                    "provider": self.name,
                    "resource_type": "video",
                    "language": filters.get("language", "zh"),
                    "difficulty": "mixed",
                    "is_free": True,
                    "is_official": False,
                    "published_at": snippet.get("publishedAt"),
                }
            )
        return results

    async def healthcheck(self) -> bool:
        return bool(get_settings().youtube_api_key)
