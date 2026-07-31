from typing import Any

from app.providers.search.base import SearchProvider


class MockSearchProvider(SearchProvider):
    name = "mock"
    capabilities = {"web", "video", "docs", "code"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        samples = [
            {
                "title": f"{query} 官方文档与入门指南",
                "url": "https://learn.microsoft.com/",
                "snippet": "官方文档、教程与最佳实践，适合从零开始系统学习。",
                "source_name": "Microsoft Learn",
                "provider": "mock",
                "resource_type": "document",
                "language": "zh",
                "difficulty": "beginner",
                "duration_minutes": 120,
                "is_official": True,
                "is_free": True,
            },
            {
                "title": f"{query} 实战视频课程",
                "url": "https://www.bilibili.com/",
                "snippet": "从基础到实战的完整视频课程，包含项目案例。",
                "source_name": "Bilibili",
                "provider": "mock",
                "resource_type": "video",
                "language": "zh",
                "difficulty": "intermediate",
                "duration_minutes": 240,
                "is_official": False,
                "is_free": True,
            },
            {
                "title": f"{query} 案例与项目实战",
                "url": "https://github.com/",
                "snippet": "真实业务场景案例、代码仓库与数据集。",
                "source_name": "GitHub",
                "provider": "mock",
                "resource_type": "article",
                "language": "zh",
                "difficulty": "intermediate",
                "duration_minutes": 90,
                "is_official": False,
                "is_free": True,
            },
        ]
        return samples[:limit]

    async def healthcheck(self) -> bool:
        return True
