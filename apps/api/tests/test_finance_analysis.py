from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

UTC_NOW = datetime(2026, 8, 17, 12, tzinfo=UTC)
HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}


def _profile(**overrides):
    defaults = {
        "base_currency": "CNY",
        "reserve_cash_ratio": Decimal("0.10"),
        "target_allocation": {"fund": "0.60", "cash": "0.20"},
        "max_instrument_concentration": Decimal("0.30"),
        "max_instrument_drawdown": Decimal("0.20"),
        "alert_settings": {},
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _position(*, instrument_id: str, asset_class: str, market_value: str, **overrides):
    defaults = {
        "id": f"position-{instrument_id}",
        "account_id": "account-1",
        "instrument_id": instrument_id,
        "asset_class": asset_class,
        "currency": "CNY",
        "quantity": Decimal("100"),
        "market_value": Decimal(market_value),
        "target_allocation": None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _candidate(instrument_id: str = "fund-1", **overrides):
    defaults = {
        "id": f"candidate-{instrument_id}",
        "instrument_id": instrument_id,
        "asset_class": "fund",
        "currency": "CNY",
        "is_active": True,
        "research_status": "ready",
        "alert_eligible": True,
        "target_allocation_min": Decimal("0.05"),
        "target_allocation_max": Decimal("0.15"),
        "allocation_gap": {},
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _quote(*, price: str = "1.20", as_of: datetime = UTC_NOW, **overrides):
    from app.domains.finance.market_data import MarketQuote

    values = {
        "price": Decimal(price),
        "currency": "CNY",
        "as_of": as_of,
        "valuation_band": "low",
        "trend": "stable",
    }
    values.update(overrides)
    return MarketQuote(**values)


def test_underweight_candidate_requires_multiple_independent_conditions() -> None:
    from app.domains.finance.analysis import evaluate_portfolio

    result = evaluate_portfolio(
        profile=_profile(),
        positions=[_position(instrument_id="cash", asset_class="cash", market_value="40")],
        candidates=[_candidate()],
        quotes={"fund-1": _quote()},
        now=UTC_NOW,
    )

    assert len(result) == 1
    assert result[0].action == "build_position"
    evidence_codes = {item["code"] for item in result[0].evidence}
    assert {"under_target_allocation", "cash_reserve_met", "favorable_valuation"} <= evidence_codes


def test_stale_quote_never_creates_trade_condition() -> None:
    from app.domains.finance.analysis import evaluate_portfolio

    assert (
        evaluate_portfolio(
            profile=_profile(),
            positions=[_position(instrument_id="fund-1", asset_class="fund", market_value="60")],
            candidates=[],
            quotes={"fund-1": _quote(as_of=UTC_NOW - timedelta(hours=37))},
            now=UTC_NOW,
        )
        == []
    )


def test_concentration_limit_creates_explainable_reduce_risk_condition() -> None:
    from app.domains.finance.analysis import evaluate_portfolio

    result = evaluate_portfolio(
        profile=_profile(max_instrument_concentration=Decimal("0.30")),
        positions=[
            _position(instrument_id="fund-1", asset_class="fund", market_value="80"),
            _position(instrument_id="cash", asset_class="cash", market_value="20"),
        ],
        candidates=[],
        quotes={"fund-1": _quote()},
        now=UTC_NOW,
    )

    assert result[0].action == "reduce_risk"
    assert "concentration_limit_exceeded" in {item["code"] for item in result[0].evidence}


def test_unconfigured_market_data_returns_status_without_action_cards() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        account = client.post(
            "/api/v1/finance/accounts",
            headers=HEADERS,
            json={"name": f"分析账户-{suffix}", "market": "CN", "currency": "CNY", "accountType": "fund"},
        )
        assert account.status_code == 201
        transaction = client.post(
            "/api/v1/finance/transactions",
            headers=HEADERS,
            json={
                "accountId": account.json()["data"]["id"],
                "instrument": {
                    "market": "CN",
                    "symbol": f"110011-{suffix}",
                    "name": "示例基金",
                    "assetClass": "fund",
                    "currency": "CNY",
                },
                "transactionType": "buy",
                "quantity": "100",
                "unitPrice": "1.2",
                "fee": "0",
                "clientReference": f"analysis-buy-{suffix}",
                "occurredOn": "2026-08-17",
            },
        )
        assert transaction.status_code == 201

        run = client.post("/api/v1/finance/analysis/run", headers=HEADERS)
        assert run.status_code == 200
        assert run.json()["data"]["dataStatus"]["state"] == "unavailable"
        assert client.get("/api/v1/finance/recommendations", headers=HEADERS).json()["data"] == []


def test_daily_analysis_run_is_idempotent_with_configured_quotes(monkeypatch) -> None:
    from app.domains.finance import service as finance_service
    from app.domains.finance.market_data import MarketQuote

    class FakeProvider:
        def fetch_quotes(self, instruments):
            return {
                instrument.id: MarketQuote(
                    price=Decimal("1.2"),
                    currency=instrument.currency,
                    as_of=datetime.now(UTC),
                    valuation_band="low",
                    trend="stable",
                )
                for instrument in instruments
            }

    monkeypatch.setattr(finance_service, "get_market_data_provider", lambda: FakeProvider())
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        account = client.post(
            "/api/v1/finance/accounts",
            headers=HEADERS,
            json={"name": f"幂等分析-{suffix}", "market": "CN", "currency": "CNY", "accountType": "fund"},
        )
        transaction = client.post(
            "/api/v1/finance/transactions",
            headers=HEADERS,
            json={
                "accountId": account.json()["data"]["id"],
                "instrument": {
                    "market": "CN",
                    "symbol": f"510300-{suffix}",
                    "name": "沪深300ETF",
                    "assetClass": "etf",
                    "currency": "CNY",
                },
                "transactionType": "buy",
                "quantity": "100",
                "unitPrice": "1.2",
                "fee": "0",
                "clientReference": f"idempotent-buy-{suffix}",
                "occurredOn": "2026-08-17",
            },
        )
        assert transaction.status_code == 201

        first = client.post("/api/v1/finance/analysis/run", headers=HEADERS)
        second = client.post("/api/v1/finance/analysis/run", headers=HEADERS)
        assert first.status_code == second.status_code == 200
        assert first.json()["data"]["id"] == second.json()["data"]["id"]
        assert client.get("/api/v1/finance/analysis/latest", headers=HEADERS).json()["data"]["id"] == first.json()["data"]["id"]


def test_fresh_rules_persist_action_card_and_allow_dismiss(monkeypatch) -> None:
    from app.domains.finance import service as finance_service
    from app.domains.finance.market_data import MarketQuote

    class FakeProvider:
        def fetch_quotes(self, instruments):
            return {
                instrument.id: MarketQuote(
                    price=Decimal("1.2"),
                    currency="CNY",
                    as_of=datetime.now(UTC),
                    valuation_band="low",
                    trend="stable",
                )
                for instrument in instruments
            }

    monkeypatch.setattr(finance_service, "get_market_data_provider", lambda: FakeProvider())
    suffix = uuid4().hex[:8]
    headers = {**HEADERS, "X-Dev-User-Id": str(uuid4())}
    with TestClient(app) as client:
        profile = client.patch(
            "/api/v1/finance/profile",
            headers=headers,
            json={
                "reserveCashRatio": "0.10",
                "targetAllocation": {"fund": "0.60", "cash": "0.20"},
                "alertSettings": {"available_cash_ratio": "0.40"},
            },
        )
        assert profile.status_code == 200
        account = client.post(
            "/api/v1/finance/accounts",
            headers=headers,
            json={"name": f"行动卡账户-{suffix}", "market": "CN", "currency": "CNY", "accountType": "fund"},
        )
        client.post(
            "/api/v1/finance/transactions",
            headers=headers,
            json={
                "accountId": account.json()["data"]["id"],
                "instrument": {
                    "market": "CN",
                    "symbol": f"159915-{suffix}",
                    "name": "候选基金",
                    "assetClass": "fund",
                    "currency": "CNY",
                },
                "transactionType": "buy",
                "quantity": "10",
                "unitPrice": "1.2",
                "fee": "0",
                "clientReference": f"card-buy-{suffix}",
                "occurredOn": "2026-08-17",
            },
        )
        candidate_seed = client.post(
            "/api/v1/finance/transactions",
            headers=headers,
            json={
                "accountId": account.json()["data"]["id"],
                "instrument": {
                    "market": "CN",
                    "symbol": f"510500-{suffix}",
                    "name": "候选指数基金",
                    "assetClass": "fund",
                    "currency": "CNY",
                },
                "transactionType": "buy",
                "quantity": "1",
                "unitPrice": "1.2",
                "fee": "0",
                "clientReference": f"candidate-seed-{suffix}",
                "occurredOn": "2026-08-17",
            },
        )
        assert candidate_seed.status_code == 201
        candidate = client.post(
            "/api/v1/finance/candidates",
            headers=headers,
            json={
                "instrumentId": candidate_seed.json()["data"]["instrumentId"],
                "targetAllocationMin": "0.05",
                "targetAllocationMax": "0.15",
                "researchStatus": "ready",
            },
        )
        assert candidate.status_code == 201

        run = client.post("/api/v1/finance/analysis/run", headers=headers)
        assert run.status_code == 200
        cards = client.get("/api/v1/finance/recommendations", headers=headers).json()["data"]
        card = next(item for item in cards if item["candidateId"] == candidate.json()["data"]["id"])
        assert card["action"] == "add_position"
        assert {item["code"] for item in card["evidence"]} >= {"cash_reserve_met", "favorable_valuation"}

        dismissed = client.post(f"/api/v1/finance/recommendations/{card['id']}/dismiss", headers=headers)
        assert dismissed.status_code == 200
        assert dismissed.json()["data"]["disposition"] == "dismissed"
        remaining = client.get("/api/v1/finance/recommendations", headers=headers).json()["data"]
        assert all(item["id"] != card["id"] for item in remaining)


def test_ai_explanation_failure_uses_deterministic_summary(monkeypatch) -> None:
    from app.domains.finance import service as finance_service
    from app.domains.finance.market_data import MarketQuote

    class FakeProvider:
        def fetch_quotes(self, instruments):
            return {
                instrument.id: MarketQuote(
                    price=Decimal("1.2"),
                    currency="CNY",
                    as_of=datetime.now(UTC),
                    valuation_band="low",
                    trend="stable",
                )
                for instrument in instruments
            }

    class BrokenAI:
        async def complete(self, *args, **kwargs):
            raise RuntimeError("AI unavailable")

    monkeypatch.setattr(finance_service, "get_market_data_provider", lambda: FakeProvider())
    monkeypatch.setattr("app.providers.ai.registry.get_ai_provider", lambda: BrokenAI())
    suffix = uuid4().hex[:8]
    headers = {**HEADERS, "X-Dev-User-Id": str(uuid4())}
    with TestClient(app) as client:
        account = client.post(
            "/api/v1/finance/accounts",
            headers=headers,
            json={"name": f"AI 回退账户-{suffix}", "market": "CN", "currency": "CNY", "accountType": "fund"},
        )
        transaction = client.post(
            "/api/v1/finance/transactions",
            headers=headers,
            json={
                "accountId": account.json()["data"]["id"],
                "instrument": {
                    "market": "CN",
                    "symbol": f"588000-{suffix}",
                    "name": "科创ETF",
                    "assetClass": "etf",
                    "currency": "CNY",
                },
                "transactionType": "buy",
                "quantity": "10",
                "unitPrice": "1.2",
                "fee": "0",
                "clientReference": f"ai-fallback-buy-{suffix}",
                "occurredOn": "2026-08-17",
            },
        )
        assert transaction.status_code == 201
        run = client.post("/api/v1/finance/analysis/run", headers=headers)
        assert run.status_code == 200
        assert "自动下单" in run.json()["data"]["explanation"]
