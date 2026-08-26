"""iFlytek Spark (讯飞星火) LLM provider.

CRITICAL: Converts the Spark WebSocket response into a unified
OpenAI-compatible SSE text stream via StreamChunk.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from urllib.parse import quote, urlencode

import websockets

from app.core.ai.base import BaseLLMProvider, LLMProviderError, StreamChunk
from app.core.config import get_settings

settings = get_settings()


class XunfeiSparkProvider(BaseLLMProvider):
    """讯飞星火 WebSocket provider — normalizes output to SSE."""

    def __init__(self, **kwargs) -> None:
        super().__init__(model=settings.spark_model, **kwargs)
        self.api_key = settings.xfyun_api_key
        self.api_secret = settings.xfyun_api_secret
        self.app_id = settings.xfyun_app_id
        self.ws_url = settings.spark_ws_url
        self.domain = settings.spark_domain

    # ── Auth URL generation ──────────────────────────────────────

    def _build_auth_url(self) -> str:
        """Generate the signed WebSocket URL per iFlytek's spec."""
        now = datetime.now(UTC)
        date = now.strftime("%a, %d %b %Y %H:%M:%S GMT")

        signature_origin = (
            f"host: spark-api.xf-yun.com\n"
            f"date: {date}\n"
            f"GET {self.ws_url.split('wss://')[-1].split('spark-api.xf-yun.com')[-1]} "
            f"HTTP/1.1"
        )
        # Correct signature string per iFlytek docs
        signature_origin = (
            f"host: spark-api.xf-yun.com\n"
            f"date: {date}\n"
            f"GET /v3.5/chat HTTP/1.1"
        )

        signature_sha = hmac.new(
            self.api_secret.encode("utf-8"),
            signature_origin.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        signature = base64.b64encode(signature_sha).decode()

        authorization_origin = (
            f'api_key="{self.api_key}", '
            f'algorithm="hmac-sha256", '
            f'headers="host date request-line", '
            f'signature="{signature}"'
        )
        authorization = base64.b64encode(
            authorization_origin.encode("utf-8")
        ).decode()

        params = {
            "authorization": authorization,
            "date": date,
            "host": "spark-api.xf-yun.com",
        }
        query = urlencode(params, quote_via=quote)
        return f"{self.ws_url}?{query}"

    # ── Build Spark request payload ──────────────────────────────

    def _build_payload(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float,
        max_tokens: int,
    ) -> dict:
        """Construct the Spark v3.5 chat request."""
        return {
            "header": {
                "app_id": self.app_id,
                "uid": "ai-agg-user",
            },
            "parameter": {
                "chat": {
                    "domain": self.domain,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
            },
            "payload": {
                "message": {
                    "text": [
                        {"role": msg["role"], "content": msg["content"]}
                        for msg in messages
                    ],
                }
            },
        }

    # ── Parse Spark WebSocket response ───────────────────────────

    @staticmethod
    def _extract_text(data: dict) -> tuple[str, bool]:
        """Extract incremental text and is_final flag from Spark response.

        Spark response structure:
            {
              "header": {"code": 0, "status": 2},
              "payload": {
                "choices": {
                  "message": {"content": "..."},
                  "status": 2
                }
              }
            }
        status: 2 = final chunk, 1 = intermediate
        """
        header = data.get("header", {})
        code = header.get("code", 0)
        if code != 0:
            raise LLMProviderError(
                f"Spark API error: code={code}, "
                f"message={header.get('message', 'unknown')}"
            )

        payload = data.get("payload", {})
        choices = payload.get("choices", {})
        message = choices.get("message", {})
        content = message.get("content", "")

        status = header.get("status", 0)
        is_final = status == 2

        return content, is_final

    # ── Main streaming method ───────────────────────────────────

    async def generate_stream(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncIterator[StreamChunk]:
        """Connect to Spark WebSocket and yield StreamChunks.

        The WebSocket → SSE conversion happens here:
        1. Open WebSocket connection with signed auth URL
        2. Send chat request payload
        3. Receive chunked responses
        4. Extract text from each chunk and wrap in StreamChunk
        5. The caller (stream_as_sse) formats these as OpenAI SSE
        """
        auth_url = self._build_auth_url()
        payload = self._build_payload(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        try:
            async with websockets.connect(auth_url) as ws:
                await ws.send(json.dumps(payload, ensure_ascii=False))

                while True:
                    response = await ws.recv()
                    data = json.loads(response)

                    content, is_final = self._extract_text(data)

                    if content:
                        yield StreamChunk(
                            content=content,
                            model=self.model,
                            finish_reason="stop" if is_final else None,
                        )

                    if is_final:
                        break

        except websockets.exceptions.ConnectionClosed as e:
            raise LLMProviderError(
                f"Spark WebSocket connection closed: {e}"
            ) from e
        except Exception as e:
            raise LLMProviderError(f"Spark provider error: {e}") from e
