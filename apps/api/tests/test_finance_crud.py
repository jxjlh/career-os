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
                "clientReference": f"initial-buy-{suffix}",
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
                "clientReference": f"cross-user-{suffix}",
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
                "clientReference": f"user-b-buy-{suffix}",
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
        user_b_transaction = client.get("/api/v1/finance/transactions", headers=_headers(user_b)).json()["data"][0]
        assert client.patch(
            f"/api/v1/finance/transactions/{user_b_transaction['id']}",
            headers=_headers(),
            json={"quantity": "9"},
        ).status_code == 404
        assert client.delete(f"/api/v1/finance/transactions/{user_b_transaction['id']}", headers=_headers()).status_code == 404
        assert client.get(f"/api/v1/finance/candidates/{candidate_id}", headers=_headers()).status_code == 404
        assert client.delete(f"/api/v1/finance/candidates/{candidate_id}", headers=_headers()).status_code == 404


def test_duplicate_client_reference_returns_existing_transaction_without_double_counting() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        account = client.post(
            "/api/v1/finance/accounts",
            headers=_headers(),
            json={"name": f"幂等账户-{suffix}", "market": "CN", "currency": "CNY", "accountType": "fund"},
        )
        payload = {
            "accountId": account.json()["data"]["id"],
            "instrument": _instrument(f"510500-{suffix}"),
            "transactionType": "buy",
            "quantity": "100",
            "unitPrice": "2.5",
            "fee": "0",
            "clientReference": f"fund-import-row-{suffix}",
            "occurredOn": "2026-08-17",
        }
        first = client.post("/api/v1/finance/transactions", headers=_headers(), json=payload)
        duplicate = client.post("/api/v1/finance/transactions", headers=_headers(), json=payload)

        assert first.status_code == 201
        assert duplicate.status_code == 201
        assert duplicate.json()["data"]["id"] == first.json()["data"]["id"]
        assert duplicate.json()["data"]["clientReference"] == payload["clientReference"]
        matching = [
            item
            for item in client.get("/api/v1/finance/transactions", headers=_headers()).json()["data"]
            if item["clientReference"] == payload["clientReference"]
        ]
        assert len(matching) == 1
        position = next(
            item
            for item in client.get("/api/v1/finance/dashboard", headers=_headers()).json()["data"]["positions"]
            if item["instrumentId"] == first.json()["data"]["instrumentId"]
        )
        assert position["quantity"] == "100"


def test_transaction_mutations_replay_history_and_reject_negative_balances() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        account = client.post(
            "/api/v1/finance/accounts",
            headers=_headers(),
            json={"name": f"重放账户-{suffix}", "market": "CN", "currency": "CNY", "accountType": "fund"},
        )
        account_id = account.json()["data"]["id"]
        buy = client.post(
            "/api/v1/finance/transactions",
            headers=_headers(),
            json={
                "accountId": account_id,
                "instrument": _instrument(f"160000-{suffix}"),
                "transactionType": "buy",
                "quantity": "100",
                "unitPrice": "1",
                "fee": "0",
                "clientReference": f"buy-{suffix}",
                "occurredOn": "2026-08-15",
            },
        )
        sell = client.post(
            "/api/v1/finance/transactions",
            headers=_headers(),
            json={
                "accountId": account_id,
                "instrumentId": buy.json()["data"]["instrumentId"],
                "transactionType": "sell",
                "quantity": "50",
                "unitPrice": "1.1",
                "fee": "0",
                "clientReference": f"sell-{suffix}",
                "occurredOn": "2026-08-16",
            },
        )
        assert buy.status_code == sell.status_code == 201

        invalid_reorder = client.patch(
            f"/api/v1/finance/transactions/{buy.json()['data']['id']}",
            headers=_headers(),
            json={"occurredOn": "2026-08-17"},
        )
        assert invalid_reorder.status_code == 422
        assert client.get(f"/api/v1/finance/transactions/{buy.json()['data']['id']}", headers=_headers()).json()["data"]["occurredOn"] == "2026-08-15"

        edited_buy = client.patch(
            f"/api/v1/finance/transactions/{buy.json()['data']['id']}",
            headers=_headers(),
            json={"quantity": "80"},
        )
        assert edited_buy.status_code == 200
        position = next(
            item
            for item in client.get("/api/v1/finance/dashboard", headers=_headers()).json()["data"]["positions"]
            if item["instrumentId"] == buy.json()["data"]["instrumentId"]
        )
        assert position["quantity"] == "30"

        assert client.delete(f"/api/v1/finance/transactions/{sell.json()['data']['id']}", headers=_headers()).status_code == 204
        position_after_sell_delete = next(
            item
            for item in client.get("/api/v1/finance/dashboard", headers=_headers()).json()["data"]["positions"]
            if item["instrumentId"] == buy.json()["data"]["instrumentId"]
        )
        assert position_after_sell_delete["quantity"] == "80"

        assert client.delete(f"/api/v1/finance/transactions/{buy.json()['data']['id']}", headers=_headers()).status_code == 204
        assert all(
            item["instrumentId"] != buy.json()["data"]["instrumentId"]
            for item in client.get("/api/v1/finance/dashboard", headers=_headers()).json()["data"]["positions"]
        )


def test_finance_rejects_money_and_ratio_values_beyond_schema_precision() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        account = client.post(
            "/api/v1/finance/accounts",
            headers=_headers(),
            json={"name": f"精度账户-{suffix}", "market": "CN", "currency": "CNY", "accountType": "fund"},
        )
        too_precise_money = client.post(
            "/api/v1/finance/transactions",
            headers=_headers(),
            json={
                "accountId": account.json()["data"]["id"],
                "instrument": _instrument(f"161000-{suffix}"),
                "transactionType": "buy",
                "quantity": "1.000000001",
                "unitPrice": "1",
                "fee": "0",
                "clientReference": f"precision-{suffix}",
                "occurredOn": "2026-08-17",
            },
        )
        assert too_precise_money.status_code == 422
        assert client.patch(
            "/api/v1/finance/profile",
            headers=_headers(),
            json={"reserveCashRatio": "0.12345"},
        ).status_code == 422
