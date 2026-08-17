from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

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


class HttpHoldingOcrProvider:
    def __init__(self, endpoint: str, api_key: str):
        self.endpoint = endpoint
        self.api_key = api_key

    def extract(self, image: bytes, content_type: str) -> list[ExtractedHoldingRow]:
        try:
            response = httpx.post(
                self.endpoint,
                headers={"Authorization": f"Bearer {self.api_key}"},
                files={"file": ("holding-image", image, content_type)},
                timeout=45,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise AppError(
                code="OCR_EXTRACTION_FAILED",
                message="持仓截图识别服务暂时不可用，请稍后重试或改用手动维护",
                status=503,
            ) from exc

        try:
            payload = response.json()
            rows = payload.get("rows", [])
        except (TypeError, ValueError) as exc:
            raise AppError(
                code="OCR_EXTRACTION_FAILED",
                message="持仓截图识别结果无效，请改用手动维护",
                status=502,
            ) from exc
        if not isinstance(rows, list):
            raise AppError(
                code="OCR_EXTRACTION_FAILED",
                message="持仓截图识别结果无效，请改用手动维护",
                status=502,
            )

        raw_text = payload.get("rawText") or payload.get("raw_text")
        return [
            ExtractedHoldingRow(
                name=row.get("name"),
                symbol=row.get("symbol"),
                market=row.get("market"),
                asset_class=row.get("assetClass", row.get("asset_class")),
                currency=row.get("currency"),
                quantity=row.get("quantity"),
                unit_price=row.get("unitPrice", row.get("unit_price")),
                confidence=row.get("confidence", Decimal("0")),
                raw_text=row.get("rawText", row.get("raw_text", raw_text)),
            )
            for row in rows
            if isinstance(row, dict)
        ]


def get_holding_ocr_provider() -> HoldingOcrProvider:
    settings = get_settings()
    if not settings.finance_ocr_api_url or not settings.finance_ocr_api_key:
        raise AppError(
            code="OCR_NOT_CONFIGURED",
            message="持仓截图识别尚未配置，请先使用手动维护功能",
            status=503,
        )
    return HttpHoldingOcrProvider(settings.finance_ocr_api_url, settings.finance_ocr_api_key)
