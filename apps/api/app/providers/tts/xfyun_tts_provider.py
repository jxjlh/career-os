"""讯飞 TTS WebSocket Provider.

复用 XFYUN_API_KEY/API_SECRET/APP_ID, 鉴权方式与星火大模型相同 (HMAC-SHA256).
WebSocket URL: wss://tts-api.xfyun.com/v2/tts
返回 base64 编码的 mp3 音频.
"""

import base64
import hashlib
import hmac
import json
from datetime import datetime
from typing import Any
from urllib.parse import urlencode, urlparse

import websockets

from app.core.config import get_settings
from app.providers.tts.base import TTSProvider


class XfyunTTSProvider(TTSProvider):
    name = "xfyun_tts"

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.xfyun_api_key
        self.api_secret = settings.xfyun_api_secret
        self.app_id = settings.xfyun_app_id
        self.ws_url = getattr(settings, "xfyun_tts_ws_url", "wss://tts-api.xfyun.com/v2/tts")

    def _configured(self) -> bool:
        return bool(self.api_key and self.api_secret and self.app_id)

    def _auth_url(self) -> str:
        """生成鉴权 URL, 与星火大模型相同的 HMAC-SHA256 方式."""
        parsed = urlparse(self.ws_url)
        host = parsed.hostname or ""
        path = parsed.path or "/"
        date = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
        origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
        signature = hmac.new(self.api_secret.encode(), origin.encode(), hashlib.sha256).digest()
        signature_b64 = base64.b64encode(signature).decode()
        authorization_origin = (
            f'api_key="{self.api_key}", algorithm="hmac-sha256", '
            f'headers="host date request-line", signature="{signature_b64}"'
        )
        authorization = base64.b64encode(authorization_origin.encode()).decode()
        params = {"authorization": authorization, "date": date, "host": host}
        return f"{self.ws_url}?{urlencode(params)}"

    async def synthesize(self, text: str, voice: str = "xiaoyan", **kwargs: Any) -> bytes:
        """文本 -> mp3 字节. 讯飞 TTS v2 接口.

        请求体使用官方 common/business/data 结构:
        - common: 应用标识 (app_id)
        - business: 合成参数 (发音人/语速/音量/格式)
        - data: 文本内容 (base64 编码, status=2 表示最终块)
        """
        if not self._configured():
            raise RuntimeError("XFYUN_API_KEY / XFYUN_API_SECRET / XFYUN_APP_ID not configured")

        # 文本需 base64 编码
        text_b64 = base64.b64encode(text.encode("utf-8")).decode()

        payload = {
            "common": {"app_id": self.app_id},
            "business": {
                "aue": "lame",  # mp3 格式 (lame = mp3, raw = pcm)
                "auf": "audio/L16;rate=16000",
                "vcn": voice,  # 发音人: xiaoyan/aisjiuxu/aisxping
                "speed": int(kwargs.get("speed", 50)),
                "volume": int(kwargs.get("volume", 50)),
                "pitch": int(kwargs.get("pitch", 50)),
                "tte": "UTF8",
            },
            "data": {
                "text": text_b64,
                "status": 2,  # 2 = 最终一块数据
            },
        }

        audio_chunks: list[bytes] = []
        async with websockets.connect(self._auth_url(), open_timeout=10, proxy=None) as ws:
            await ws.send(json.dumps(payload, ensure_ascii=False))
            while True:
                raw = await ws.recv()
                data = json.loads(raw)
                code = data.get("code", 0)
                if code != 0:
                    raise RuntimeError(f"TTS API error: code={code}, message={data.get('message', '')}")
                audio_b64 = data.get("data", {}).get("audio", "")
                if audio_b64:
                    audio_chunks.append(base64.b64decode(audio_b64))
                if data.get("data", {}).get("status") == 2:
                    break

        return b"".join(audio_chunks)

    async def healthcheck(self) -> bool:
        return self._configured()
