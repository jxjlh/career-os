from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.ai.base import AIProvider


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model

    async def complete(self, messages, response_format=None, **kwargs) -> str:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY not configured")
        payload: dict[str, Any] = {
            "model": kwargs.get("model", self.model),
            "messages": messages,
            "temperature": float(kwargs.get("temperature", 0.5)),
        }
        if response_format:
            payload["response_format"] = {"type": response_format}
        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            resp = await client.post("https://api.openai.com/v1/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"]

    async def healthcheck(self) -> bool:
        return bool(self.api_key)
