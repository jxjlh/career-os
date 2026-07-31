from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.ai.base import AIProvider


class AnthropicProvider(AIProvider):
    name = "anthropic"

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.anthropic_api_key
        self.model = settings.anthropic_model

    async def complete(self, messages, response_format=None, **kwargs) -> str:
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not configured")
        system = "\n".join(m["content"] for m in messages if m.get("role") == "system")
        user_messages = [m for m in messages if m.get("role") != "system"]
        payload: dict[str, Any] = {
            "model": kwargs.get("model", self.model),
            "messages": user_messages,
            "max_tokens": int(kwargs.get("max_tokens", 2048)),
            "temperature": float(kwargs.get("temperature", 0.5)),
        }
        if system:
            payload["system"] = system
        headers = {"x-api-key": self.api_key, "anthropic-version": "2023-06-01"}
        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", json=payload)
            resp.raise_for_status()
            data = resp.json()
        return "".join(block.get("text", "") for block in data.get("content", []))

    async def healthcheck(self) -> bool:
        return bool(self.api_key)
