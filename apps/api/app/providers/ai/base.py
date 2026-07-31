from abc import ABC, abstractmethod
from typing import Any


class AIProvider(ABC):
    name: str

    @abstractmethod
    async def complete(
        self,
        messages: list[dict[str, str]],
        response_format: str | None = None,
        **kwargs: Any,
    ) -> str:
        """Return a complete assistant message."""

    @abstractmethod
    async def healthcheck(self) -> bool:
        """Return whether the provider is configured and reachable."""
