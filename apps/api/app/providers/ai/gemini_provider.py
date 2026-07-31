import httpx

from app.core.config import get_settings
from app.providers.ai.base import AIProvider


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model

    async def complete(self, messages, response_format=None, **kwargs) -> str:
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY not configured")
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": m.get("content", "")}]}
                for m in messages
                if m.get("role") in ("user", "assistant")
            ]
        }
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{kwargs.get('model', self.model)}"
            f":generateContent?key={self.api_key}"
        )
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            return ""
        return "".join(part.get("text", "") for part in candidates[0].get("content", {}).get("parts", []))

    async def healthcheck(self) -> bool:
        return bool(self.api_key)
