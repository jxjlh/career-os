from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.search.base import SearchProvider


class GitHubProvider(SearchProvider):
    name = "github"
    capabilities = {"code", "docs"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        headers = {}
        settings = get_settings()
        if settings.github_token:
            headers["Authorization"] = f"Bearer {settings.github_token}"
        url = "https://api.github.com/search/repositories"
        params = {"q": query, "per_page": min(limit, 10), "sort": "stars"}
        async with httpx.AsyncClient(timeout=10, headers=headers) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for item in data.get("items", []):
            results.append(
                {
                    "title": item.get("full_name", ""),
                    "url": item.get("html_url", ""),
                    "snippet": (item.get("description") or "")[:240],
                    "source_name": "GitHub",
                    "provider": self.name,
                    "resource_type": "code",
                    "language": "en",
                    "difficulty": "mixed",
                    "is_free": True,
                    "is_official": False,
                    "published_at": item.get("updated_at"),
                    "metadata": {"stars": item.get("stargazers_count", 0)},
                }
            )
        return results

    async def healthcheck(self) -> bool:
        return True
