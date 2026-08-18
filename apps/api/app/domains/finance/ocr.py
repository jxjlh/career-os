import asyncio
import base64
import json
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Protocol

import httpx

from app.core.config import get_settings
from app.core.errors import AppError


@dataclass(frozen=True)
class ExtractedHoldingRow:
    """Normalized, reviewable holding data returned by an authorized OCR service."""

    name: str | None = None
    symbol: str | None = None
    market: str | None = None
    asset_class: str | None = None
    currency: str | None = None
    quantity: Decimal | str | None = None
    unit_price: Decimal | str | None = None
    confidence: Decimal | str = Decimal("0")
    raw_text: str | None = None


class HoldingOcrProvider(Protocol):
    def extract(self, image: bytes, content_type: str) -> list[ExtractedHoldingRow]: ...

    async def extract_async(self, image: bytes, content_type: str) -> list[ExtractedHoldingRow]: ...


# 最长 180 秒单次请求，3 次重试（30s → 60s → 120s 冷却），总计可容忍 5+ 分钟推理
_SYNC_TIMEOUT = httpx.Timeout(connect=30.0, read=180.0, write=60.0, pool=30.0)
_RETRY_BACKOFF = (15.0, 30.0, 60.0)


def _is_timeout(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TimeoutException):
        return True
    text = str(exc).lower()
    return any(keyword in text for keyword in ("timeout", "timed out", "gateway time-out", "504", "deadline exceeded"))


def _ocr_error(exc: BaseException) -> AppError:
    if _is_timeout(exc):
        return AppError(
            code="OCR_TIMEOUT",
            message="OCR 识别超时（模型推理耗时较长），请稍后在「导入记录」中查看结果，或改用手动维护。",
            status=504,
        )
    return AppError(
        code="OCR_EXTRACTION_FAILED",
        message="持仓截图识别服务暂时不可用，请稍后重试或改用手动维护",
        status=503,
    )


class HttpHoldingOcrProvider:
    def __init__(self, endpoint: str, api_key: str):
        self.endpoint = endpoint
        self.api_key = api_key

    def extract(self, image: bytes, content_type: str) -> list[ExtractedHoldingRow]:
        last_exc: BaseException | None = None
        for attempt, backoff in enumerate(_RETRY_BACKOFF + (0.0,)):
            try:
                response = httpx.post(
                    self.endpoint,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    files={"file": ("holding-image", image, content_type)},
                    timeout=_SYNC_TIMEOUT,
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                last_exc = exc
                if attempt < len(_RETRY_BACKOFF):
                    time.sleep(_RETRY_BACKOFF[attempt])
                    continue
                raise _ocr_error(exc) from exc
            try:
                payload = response.json()
            except ValueError as exc:
                last_exc = exc
                raise _invalid_ocr_result() from exc
            return _parse_extracted_rows(payload)
        # unreachable
        raise _ocr_error(last_exc or RuntimeError("OCR failed"))

    async def extract_async(self, image: bytes, content_type: str) -> list[ExtractedHoldingRow]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.extract, image, content_type)


class OpenAICompatibleVisionHoldingOcrProvider:
    """OCR fallback for OpenAI-compatible chat-completions vision endpoints."""

    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    def _build_payload(self, image: bytes, content_type: str) -> dict[str, Any]:
        data_url = f"data:{content_type};base64,{base64.b64encode(image).decode('ascii')}"
        return {
            "model": self.model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Read this investment holding screenshot. Return JSON only, with exactly a rows "
                                "array. Every row must use only these optional keys: name, symbol, market "
                                "(CN/HK/US), assetClass (fund/etf/stock), currency (CNY/HKD/USD), quantity, "
                                "unitPrice, confidence, rawText. Do not invent missing holdings or values."
                            ),
                        },
                        {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                    ],
                }
            ],
        }

    def extract(self, image: bytes, content_type: str) -> list[ExtractedHoldingRow]:
        payload = self._build_payload(image, content_type)
        last_exc: BaseException | None = None
        for attempt in range(len(_RETRY_BACKOFF) + 1):
            try:
                response = httpx.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                    timeout=_SYNC_TIMEOUT,
                )
                response.raise_for_status()
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                if not isinstance(content, str):
                    raise _invalid_ocr_result()
                parsed = json.loads(content)
            except AppError:
                raise
            except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
                last_exc = exc
                if attempt < len(_RETRY_BACKOFF):
                    time.sleep(_RETRY_BACKOFF[attempt])
                    continue
                raise _ocr_error(exc) from exc
            return _parse_extracted_rows(parsed, raw_text=content)
        # unreachable
        raise _ocr_error(last_exc or RuntimeError("OCR failed"))

    async def extract_async(self, image: bytes, content_type: str) -> list[ExtractedHoldingRow]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.extract, image, content_type)


def _invalid_ocr_result() -> AppError:
    return AppError(
        code="OCR_EXTRACTION_FAILED",
        message="持仓截图识别结果无效，请改用手动维护",
        status=502,
    )


def _parse_extracted_rows(payload: Any, raw_text: str | None = None) -> list[ExtractedHoldingRow]:
    if not isinstance(payload, dict) or not isinstance(payload.get("rows"), list):
        raise _invalid_ocr_result()
    payload_raw_text = payload.get("rawText") or payload.get("raw_text") or raw_text
    rows: list[ExtractedHoldingRow] = []
    for row in payload["rows"]:
        if not isinstance(row, dict):
            raise _invalid_ocr_result()
        rows.append(
            ExtractedHoldingRow(
                name=row.get("name"),
                symbol=row.get("symbol"),
                market=row.get("market"),
                asset_class=row.get("assetClass", row.get("asset_class")),
                currency=row.get("currency"),
                quantity=row.get("quantity"),
                unit_price=row.get("unitPrice", row.get("unit_price")),
                confidence=row.get("confidence", Decimal("0")),
                raw_text=row.get("rawText", row.get("raw_text", payload_raw_text)),
            )
        )
    return rows


def get_holding_ocr_provider() -> HoldingOcrProvider:
    settings = get_settings()
    if settings.finance_ocr_api_url and settings.finance_ocr_api_key:
        return HttpHoldingOcrProvider(settings.finance_ocr_api_url, settings.finance_ocr_api_key)
    if settings.openai_api_key:
        return OpenAICompatibleVisionHoldingOcrProvider(
            settings.openai_base_url,
            settings.openai_api_key,
            settings.finance_ocr_model or "gpt-4o-mini",
        )
    raise AppError(
        code="OCR_NOT_CONFIGURED",
        message="持仓截图识别尚未配置，请先使用手动维护功能",
        status=503,
    )
