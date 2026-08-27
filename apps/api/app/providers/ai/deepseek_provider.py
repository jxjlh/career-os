from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.ai.base import AIProvider


class DeepSeekProvider(AIProvider):
    """DeepSeek Chat provider (OpenAI 兼容接口)."""

    name = "deepseek"

    def __init__(self, api_key: str | None = None, base_url: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.finance_ai_api_key
        self.base_url = (base_url if base_url is not None else settings.finance_ai_base_url).rstrip("/")
        self.model = model if model is not None else settings.finance_ai_model

    async def complete(self, messages, response_format=None, **kwargs: Any) -> str:
        if not self.api_key:
            raise RuntimeError("FINANCE_AI_API_KEY not configured")
        payload: dict[str, Any] = {
            "model": kwargs.get("model", self.model),
            "messages": messages,
            "temperature": float(kwargs.get("temperature", 0.5)),
        }
        if response_format:
            payload["response_format"] = {"type": response_format}
        max_tokens = kwargs.get("max_tokens")
        if max_tokens:
            payload["max_tokens"] = int(max_tokens)
        headers = {"Authorization": f"Bearer {self.api_key}"}
        timeout = httpx.Timeout(connect=15, read=120, write=30, pool=15)
        async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions", json=payload
            )
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"]

    async def healthcheck(self) -> bool:
        return bool(self.api_key)
