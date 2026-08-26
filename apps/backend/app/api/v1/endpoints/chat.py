"""Chat endpoint — SSE streaming via unified LLM provider.

Injects AsyncSession for potential conversation persistence and
streams the AI response as OpenAI-format SSE.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.base import BaseLLMProvider, LLMProviderFactory
from app.core.ai.providers.openai import OpenAIProvider
from app.core.ai.providers.xunfei import XunfeiSparkProvider
from app.core.config import get_settings
from app.db.session import get_async_session

# ── Register providers ────────────────────────────────────────
LLMProviderFactory.register("xunfei", XunfeiSparkProvider)
LLMProviderFactory.register("openai", OpenAIProvider)

settings = get_settings()
router = APIRouter(prefix="/chat", tags=["chat"])


# ── Request / Response schemas ─────────────────────────────────


class ChatMessageSchema(BaseModel):
    role: str = "user"
    content: str


class ChatCompletionRequest(BaseModel):
    messages: list[ChatMessageSchema]
    provider: str | None = None
    temperature: float = 0.7
    max_tokens: int = 4096


class ChatCompletionResponse(BaseModel):
    content: str
    model: str
    provider: str


# ── Provider resolution ────────────────────────────────────────


def _resolve_provider(provider_name: str | None) -> BaseLLMProvider:
    """Resolve the LLM provider, with fallback to default."""
    name = provider_name or settings.default_llm_provider
    try:
        return LLMProviderFactory.create(name)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider: {name}. "
            f"Available: {list(LLMProviderFactory._registry.keys())}",
        )


# ── Endpoints ──────────────────────────────────────────────────


@router.post("/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    session: AsyncSession = Depends(get_async_session),
) -> StreamingResponse:
    """Stream a chat completion as OpenAI-format SSE.

    The response is a Server-Sent Events stream:
        data: {"choices":[{"delta":{"content":"..."}}]}

        data: [DONE]
    """
    provider = _resolve_provider(request.provider)

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    async def sse_generator():
        try:
            async for sse_frame in provider.stream_as_sse(
                messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            ):
                yield sse_frame
        except Exception as e:
            error_payload = json.dumps(
                {"error": {"message": str(e), "type": "provider_error"}},
                ensure_ascii=False,
            )
            yield f"data: {error_payload}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/completions/sync", response_model=ChatCompletionResponse)
async def chat_completions_sync(
    request: ChatCompletionRequest,
    session: AsyncSession = Depends(get_async_session),
) -> ChatCompletionResponse:
    """Non-streaming chat completion (accumulates full response)."""
    provider = _resolve_provider(request.provider)
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    content = await provider.generate(
        messages,
        temperature=request.temperature,
        max_tokens=request.max_tokens,
    )

    return ChatCompletionResponse(
        content=content,
        model=provider.model,
        provider=provider.__class__.__name__,
    )
