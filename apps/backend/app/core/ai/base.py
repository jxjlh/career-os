"""BaseLLMProvider — abstract class for all AI model providers.

All providers MUST output a unified OpenAI-compatible SSE text stream,
regardless of the underlying transport (WebSocket, HTTP, etc.).
"""
from __future__ import annotations

import abc
import json
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

# ── Python 3.12 type alias ────────────────────────────────────
type ChatMessage = dict[str, str]
type ChatHistory = list[ChatMessage]


@dataclass
class StreamChunk:
    """A single chunk in the unified SSE stream."""

    content: str = ""
    role: str = "assistant"
    finish_reason: str | None = None
    id: str = field(default_factory=lambda: f"chatcmpl-{uuid.uuid4().hex[:24]}")
    model: str = ""
    created: int = field(default_factory=lambda: int(time.time()))


class BaseLLMProvider(abc.ABC):
    """Abstract base class that every LLM provider must implement.

    Concrete providers (Xunfei, OpenAI, Anthropic, etc.) override
    `generate_stream()` to yield `StreamChunk` objects. The calling
    layer converts these to OpenAI-format SSE frames.
    """

    def __init__(self, model: str, **kwargs) -> None:
        self.model = model
        self.kwargs = kwargs

    @abc.abstractmethod
    async def generate_stream(
        self,
        messages: ChatHistory,
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncIterator[StreamChunk]:
        """Yield StreamChunk objects representing incremental text.

        Args:
            messages: OpenAI-format message list
                       [{"role": "user", "content": "..."}, ...]
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.

        Yields:
            StreamChunk with incremental content. The final chunk
            should set finish_reason="stop".
        """
        ...
        # This is an abstract method — the `...` + yield make it
        # a type-checking stub so mypy understands the return type.
        yield StreamChunk()  # pragma: no cover

    async def generate(
        self,
        messages: ChatHistory,
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """Non-streaming convenience wrapper — accumulates all chunks."""
        parts: list[str] = []
        async for chunk in self.generate_stream(
            messages, temperature=temperature, max_tokens=max_tokens
        ):
            parts.append(chunk.content)
        return "".join(parts)

    # ── SSE formatting (shared by all providers) ────────────────

    @staticmethod
    def format_sse(chunk: StreamChunk) -> str:
        """Convert a StreamChunk to an OpenAI-compatible SSE frame.

        Output format:
            data: {"id":"...","object":"chat.completion.chunk",
                   "choices":[{"index":0,"delta":{"content":"..."},
                   "finish_reason":null}]}

        """
        delta: dict[str, str] = {}
        if chunk.role:
            delta["role"] = chunk.role
        if chunk.content:
            delta["content"] = chunk.content

        payload = {
            "id": chunk.id,
            "object": "chat.completion.chunk",
            "created": chunk.created,
            "model": chunk.model or "unknown",
            "choices": [
                {
                    "index": 0,
                    "delta": delta,
                    "finish_reason": chunk.finish_reason,
                }
            ],
        }
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    @staticmethod
    def format_sse_done() -> str:
        """Emit the terminal `[DONE]` sentinel frame."""
        return "data: [DONE]\n\n"

    async def stream_as_sse(
        self,
        messages: ChatHistory,
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncIterator[str]:
        """Wrap generate_stream() and yield SSE-formatted strings.

        This is the single entry point the API layer calls — every
        provider's output is normalized to OpenAI SSE here.
        """
        async for chunk in self.generate_stream(
            messages, temperature=temperature, max_tokens=max_tokens
        ):
            yield self.format_sse(chunk)
        yield self.format_sse_done()


class LLMProviderError(Exception):
    """Raised when an LLM provider fails to produce output."""


class LLMProviderFactory:
    """Factory for creating provider instances by name."""

    _registry: dict[str, type[BaseLLMProvider]] = {}

    @classmethod
    def register(cls, name: str, provider_cls: type[BaseLLMProvider]) -> None:
        cls._registry[name] = provider_cls

    @classmethod
    def create(cls, name: str, **kwargs) -> BaseLLMProvider:
        if name not in cls._registry:
            raise ValueError(f"Unknown LLM provider: {name}")
        return cls._registry[name](**kwargs)
