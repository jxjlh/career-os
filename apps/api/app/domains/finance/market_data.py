from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Protocol

import httpx

from app.core.config import get_settings
from app.db.models import FinancialInstrument


class MarketDataError(Exception):
    """Raised when a configured market-data provider cannot produce usable quotes."""


@dataclass(frozen=True)
class MarketQuote:
    price: Decimal
    currency: str
    as_of: datetime
    valuation_band: str | None = None
    trend: str | None = None
    drawdown: Decimal | None = None


class MarketDataProvider(Protocol):
    def fetch_quotes(self, instruments: Sequence[FinancialInstrument]) -> dict[str, MarketQuote]: ...


class HttpMarketDataProvider:
    """Small adapter for an explicitly configured, licensed quote API.

    The provider contract deliberately stays narrow: ``GET {base}/quotes`` receives
    repeated ``market``/``symbol`` parameters and returns ``{"data": [...]}`` with
    ``market``, ``symbol``, ``price``, ``currency`` and ``asOf`` fields.  No web
    scraping fallback is used when the licensed provider is absent or invalid.
    """

    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def fetch_quotes(self, instruments: Sequence[FinancialInstrument]) -> dict[str, MarketQuote]:
        if not instruments:
            return {}
        params: list[tuple[str, str]] = []
        for instrument in instruments:
            params.extend((("market", instrument.market), ("symbol", instrument.symbol)))
        try:
            response = httpx.get(
                f"{self.base_url}/quotes",
                params=params,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10.0,
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise MarketDataError("configured provider request failed") from exc

        rows = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            raise MarketDataError("configured provider returned an invalid quote payload")
        requested = {(instrument.market, instrument.symbol): instrument.id for instrument in instruments}
        quotes: dict[str, MarketQuote] = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            instrument_id = requested.get((str(row.get("market")), str(row.get("symbol"))))
            if instrument_id is None:
                continue
            try:
                as_of = datetime.fromisoformat(str(row["asOf"]).replace("Z", "+00:00"))
                if as_of.tzinfo is None:
                    as_of = as_of.replace(tzinfo=UTC)
                drawdown = row.get("drawdown")
                quotes[instrument_id] = MarketQuote(
                    price=Decimal(str(row["price"])),
                    currency=str(row["currency"]),
                    as_of=as_of.astimezone(UTC),
                    valuation_band=str(row["valuationBand"]) if row.get("valuationBand") else None,
                    trend=str(row["trend"]) if row.get("trend") else None,
                    drawdown=Decimal(str(drawdown)) if drawdown is not None else None,
                )
            except (InvalidOperation, KeyError, TypeError, ValueError):
                continue
        return quotes


def get_market_data_provider() -> MarketDataProvider | None:
    settings = get_settings()
    if not settings.finance_market_data_base_url or not settings.finance_market_data_api_key:
        return None
    return HttpMarketDataProvider(settings.finance_market_data_base_url, settings.finance_market_data_api_key)
