from abc import ABC, abstractmethod
from typing import Any


class SearchProvider(ABC):
    name: str
    capabilities: set[str] = set()

    @abstractmethod
    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        """Return normalized search results."""

    @abstractmethod
    async def healthcheck(self) -> bool:
        """Return whether the provider is configured and reachable."""
