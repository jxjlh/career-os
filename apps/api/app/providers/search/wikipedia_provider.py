from typing import Any

import httpx

from app.providers.search.base import SearchProvider


class WikipediaProvider(SearchProvider):
    name = "wikipedia"
    capabilities = {"web", "docs"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        language = filters.get("language", "zh")
        url = f"https://{language}.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": min(limit, 10),
            "format": "json",
            "utf8": "1",
        }
        # Wikipedia 强制要求 User-Agent, 否则 403
        headers = {"User-Agent": "CareerOS/1.0 (https://career-os.pages.dev; learning search)"}
        async with httpx.AsyncClient(timeout=10, headers=headers) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for item in data.get("query", {}).get("search", []):
            title = item.get("title", "")
            results.append(
                {
                    "title": title,
                    "url": f"https://{language}.wikipedia.org/wiki/{title.replace(' ', '_')}",
                    "snippet": item.get("snippet", ""),
                    "source_name": f"Wikipedia ({language})",
                    "provider": self.name,
                    "resource_type": "document",
                    "language": language,
                    "difficulty": "mixed",
                    "is_free": True,
                    "is_official": True,
                }
            )
        return results

    async def healthcheck(self) -> bool:
        return True
