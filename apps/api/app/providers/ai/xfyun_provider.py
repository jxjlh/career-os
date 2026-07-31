import base64
import hashlib
import hmac
import json
import uuid
from datetime import datetime
from typing import Any
from urllib.parse import urlencode, urlparse

import websockets

from app.core.config import get_settings
from app.providers.ai.base import AIProvider


class XfyunSparkProvider(AIProvider):
    """讯飞星火大模型 provider（默认 Spark-X2-Flash）。"""

    name = "xfyun_spark"

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.xfyun_api_key
        self.api_secret = settings.xfyun_api_secret
        self.app_id = settings.xfyun_app_id
        self.model = settings.spark_model
        self.wss_url = settings.spark_ws_url
        self.domain = settings.spark_domain

    def _configured(self) -> bool:
        return bool(self.api_key and self.api_secret and self.app_id)

    def _auth_url(self) -> str:
        parsed = urlparse(self.wss_url)
        host = parsed.hostname or ""
        path = parsed.path or "/"
        date = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
        origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
        signature = hmac.new(self.api_secret.encode(), origin.encode(), hashlib.sha256).digest()
        signature_b64 = base64.b64encode(signature).decode()
        # 讯飞鉴权: 拼接 api_key/algorithm/headers/signature 后整体 base64
        authorization_origin = (
            f'api_key="{self.api_key}", algorithm="hmac-sha256", '
            f'headers="host date request-line", signature="{signature_b64}"'
        )
        authorization = base64.b64encode(authorization_origin.encode()).decode()
        params = {"authorization": authorization, "date": date, "host": host}
        return f"{self.wss_url}?{urlencode(params)}"

    async def complete(
        self,
        messages: list[dict[str, str]],
        response_format: str | None = None,
        **kwargs: Any,
    ) -> str:
        if not self._configured():
            raise RuntimeError("XFYUN_API_KEY / XFYUN_API_SECRET / XFYUN_APP_ID not configured")

        payload = {
            "header": {"app_id": self.app_id, "uid": str(uuid.uuid4())},
            "parameter": {
                "chat": {
                    "domain": self.domain,
                    "temperature": float(kwargs.get("temperature", 0.5)),
                    "max_tokens": int(kwargs.get("max_tokens", 2048)),
                }
            },
            "payload": {"message": {"text": messages}},
        }
        collected: list[str] = []
        # 讯飞星火为国内服务, 显式禁用代理, 避免本地系统代理 (如 Clash) 拦截 wss 连接
        async with websockets.connect(self._auth_url(), open_timeout=10, proxy=None) as ws:
            await ws.send(json.dumps(payload, ensure_ascii=False))
            while True:
                raw = await ws.recv()
                data = json.loads(raw)
                code = data.get("header", {}).get("code", 0)
                if code != 0:
                    raise RuntimeError(data.get("header", {}).get("message", "Spark API error"))
                choices = data.get("payload", {}).get("choices", {})
                for choice in choices.get("text", []):
                    collected.append(choice.get("content", ""))
                if data.get("header", {}).get("status") == 2:
                    break
        return "".join(collected).strip()

    async def healthcheck(self) -> bool:
        return self._configured()
