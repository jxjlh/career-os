"""OpenAI-compatible LLM provider.

Supports any OpenAI API-compatible endpoint (Azure, Together,
Groq, local Ollama, etc.) via base_url override.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.core.ai.base import BaseLLMProvider, LLMProviderError, StreamChunk
from app.core.config import get_settings

settings = get_settings()


class OpenAIProvider(BaseLLMProvider):
    """OpenAI / compatible endpoint provider."""

    def __init__(self, **kwargs) -> None:
        super().__init__(model=settings.openai_model, **kwargs)
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )

    async def generate_stream(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncIterator[StreamChunk]:
        """Stream from OpenAI Chat Completions API.

        Already returns SSE-like chunks — we normalize them into
        StreamChunk objects so the base class can format them
        uniformly alongside other providers.
        """
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,  # type: ignore[arg-type]
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )

            async for chunk in stream:
                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta
                finish_reason = chunk.choices[0].finish_reason

                content = delta.content or ""
                role = delta.role or "assistant"

                yield StreamChunk(
                    content=content,
                    role=role,
                    finish_reason=finish_reason,
                    model=self.model,
                )

        except Exception as e:
            raise LLMProviderError(f"OpenAI provider error: {e}") from e
