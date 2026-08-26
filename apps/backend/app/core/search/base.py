"""BaseSearchProvider — abstract search provider with fallback logic.

Multi-engine aggregation search with automatic degradation when a
provider fails or times out.
"""
from __future__ import annotations

import abc
import asyncio
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """A single search result item."""

    title: str = ""
    url: str = ""
    snippet: str = ""
    source: str = ""
    score: float = 0.0
    raw: dict = field(default_factory=dict)


@dataclass
class SearchResponse:
    """Aggregated search response."""

    query: str = ""
    results: list[SearchResult] = field(default_factory=list)
    total: int = 0
    providers_used: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class BaseSearchProvider(abc.ABC):
    """Abstract search provider.

    Each concrete provider (Tavily, Exa, Bing, GitHub, YouTube)
    implements `search()`. The base class handles fallback ordering
    and timeout-based degradation.
    """

    provider_name: str = "base"

    def __init__(self, timeout: float = 10.0, **kwargs) -> None:
        self.timeout = timeout
        self.kwargs = kwargs

    @abc.abstractmethod
    async def search(self, query: str, *, max_results: int = 10) -> list[SearchResult]:
        """Execute a search and return results."""
        ...

        return []  # type: ignore[unreachable]

    async def search_with_timeout(
        self, query: str, *, max_results: int = 10
    ) -> list[SearchResult]:
        """Wrapper that enforces a timeout and degrades gracefully."""
        try:
            return await asyncio.wait_timeout(
                self.search(query, max_results=max_results),
                timeout=self.timeout,
            )
        except TimeoutError:
            logger.warning(
                "Search provider '%s' timed out after %.1fs", self.provider_name, self.timeout
            )
            return []
        except Exception as e:
            logger.error("Search provider '%s' failed: %s", self.provider_name, e)
            return []


class AggregatedSearch:
    """Multi-engine aggregation search with fallback.

    Usage:
        search = AggregatedSearch([TavilyProvider(), ExaProvider(), ...])
        results = await search.query("AI news", max_per_provider=5)
    """

    def __init__(self, providers: list[BaseSearchProvider]) -> None:
        self.providers = providers

    async def query(
        self,
        query: str,
        *,
        max_per_provider: int = 5,
        max_total: int = 20,
    ) -> SearchResponse:
        """Run all providers concurrently, merge and deduplicate results."""
        tasks = [
            provider.search_with_timeout(query, max_results=max_per_provider)
            for provider in self.providers
        ]
        provider_results = await asyncio.gather(*tasks, return_exceptions=True)

        seen_urls: set[str] = set()
        merged: list[SearchResult] = []
        providers_used: list[str] = []
        errors: list[str] = []

        for provider, result in zip(self.providers, provider_results, strict=True):
            if isinstance(result, Exception):
                errors.append(f"{provider.provider_name}: {result}")
                continue
            if result:
                providers_used.append(provider.provider_name)
                for item in result:
                    if item.url and item.url not in seen_urls:
                        seen_urls.add(item.url)
                        merged.append(item)

        merged.sort(key=lambda r: r.score, reverse=True)
        merged = merged[:max_total]

        return SearchResponse(
            query=query,
            results=merged,
            total=len(merged),
            providers_used=providers_used,
            errors=errors,
        )
