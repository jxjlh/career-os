from datetime import date
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def _headers(user_id: str | None = None) -> dict[str, str]:
    headers = {"Authorization": "Bearer dev", "Content-Type": "application/json"}
    if user_id:
        headers["X-Dev-User-Id"] = user_id
    return headers


def _instrument(symbol: str) -> dict[str, str]:
    return {
        "market": "CN",
        "symbol": symbol,
        "name": "示例基金",
        "assetClass": "fund",
        "currency": "CNY",
    }


def test_finance_profile_account_and_transaction_flow() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        profile = client.patch(
            "/api/v1/finance/profile",
            headers=_headers(),
            json={
                "riskPreference": "balanced",
                "baseCurrency": "CNY",
                "reserveCashRatio": "0.15",
                "targetAllocation": {"fund": "0.60", "stock": "0.20", "cash": "0.20"},
            },
        )
        assert profile.status_code == 200
        assert profile.json()["data"]["reserveCashRatio"] == "0.15"

        account = client.post(
            "/api/v1/finance/accounts",
            headers=_headers(),
            json={"name": f"天天基金-{suffix}", "market": "CN", "currency": "CNY", "accountType": "fund"},
        )
        assert account.status_code == 201
        account_id = account.json()["data"]["id"]

        fetched_account = client.get(f"/api/v1/finance/accounts/{account_id}", headers=_headers())
        assert fetched_account.status_code == 200
        assert fetched_account.json()["data"]["id"] == account_id

        transaction = client.post(
            "/api/v1/finance/transactions",
            headers=_headers(),
            json={
                "accountId": account_id,
                "instrument": _instrument(f"110011-{suffix}"),
                "transactionType": "buy",
                "quantity": "100",
                "unitPrice": "1.2",
                "fee": "0",
                "occurredOn": date(2026, 8, 17).isoformat(),
            },
        )
        assert transaction.status_code == 201
        assert transaction.json()["data"]["quantity"] == "100"
        assert transaction.json()["data"]["unitPrice"] == "1.2"

        currency_change = client.patch(
            f"/api/v1/finance/accounts/{account_id}",
            headers=_headers(),
            json={"market": "HK", "currency": "HKD"},
        )
        assert currency_change.status_code == 409

        listed_transactions = client.get("/api/v1/finance/transactions", headers=_headers())
        assert listed_transactions.status_code == 200
        assert [item["id"] for item in listed_transactions.json()["data"]].count(transaction.json()["data"]["id"]) == 1

        updated_account = client.patch(
            f"/api/v1/finance/accounts/{account_id}",
            headers=_headers(),
            json={"name": f"更新账户-{suffix}"},
        )
        assert updated_account.status_code == 200
        assert updated_account.json()["data"]["name"] == f"更新账户-{suffix}"

        candidate = client.post(
            "/api/v1/finance/candidates",
            headers=_headers(),
            json={
                "instrumentId": transaction.json()["data"]["instrumentId"],
                "suitabilityReason": "与长期配置目标相符",
                "targetAllocationMin": "0.05",
                "targetAllocationMax": "0.15",
            },
        )
        assert candidate.status_code == 201
        assert candidate.json()["data"]["targetAllocationMin"] == "0.05"

        search = client.get("/api/v1/finance/instruments/search", headers=_headers(), params={"q": f"110011-{suffix}"})
        assert search.status_code == 200
        assert search.json()["data"][0]["id"] == transaction.json()["data"]["instrumentId"]

        deleted = client.delete(f"/api/v1/finance/candidates/{candidate.json()['data']['id']}", headers=_headers())
        assert deleted.status_code == 204


def test_finance_resources_are_isolated_by_user() -> None:
    suffix = uuid4().hex[:8]
    user_b = "00000000-0000-0000-0000-000000000002"
    with TestClient(app) as client:
        account = client.post(
            "/api/v1/finance/accounts",
            headers=_headers(user_b),
            json={"name": f"用户B账户-{suffix}", "market": "CN", "currency": "CNY", "accountType": "fund"},
        )
        assert account.status_code == 201
        account_id = account.json()["data"]["id"]

        forbidden_transaction = client.post(
            "/api/v1/finance/transactions",
            headers=_headers(),
            json={
                "accountId": account_id,
                "instrument": _instrument(f"110022-{suffix}"),
                "transactionType": "buy",
                "quantity": "10",
                "unitPrice": "1.2",
                "fee": "0",
                "occurredOn": "2026-08-17",
            },
        )
        assert forbidden_transaction.status_code == 404

        instrument_id = client.post(
            "/api/v1/finance/transactions",
            headers=_headers(user_b),
            json={
                "accountId": account_id,
                "instrument": _instrument(f"110033-{suffix}"),
                "transactionType": "buy",
                "quantity": "10",
                "unitPrice": "1.2",
                "fee": "0",
                "occurredOn": "2026-08-17",
            },
        ).json()["data"]["instrumentId"]
        candidate = client.post(
            "/api/v1/finance/candidates",
            headers=_headers(user_b),
            json={"instrumentId": instrument_id},
        )
        candidate_id = candidate.json()["data"]["id"]

        assert client.patch(f"/api/v1/finance/accounts/{account_id}", headers=_headers(), json={"name": "越权"}).status_code == 404
        assert client.get(f"/api/v1/finance/candidates/{candidate_id}", headers=_headers()).status_code == 404
        assert client.delete(f"/api/v1/finance/candidates/{candidate_id}", headers=_headers()).status_code == 404
