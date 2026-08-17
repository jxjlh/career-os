from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}


def test_dashboard_aggregates_materialized_positions_without_mutating_history() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        account = client.post(
            "/api/v1/finance/accounts",
            headers=HEADERS,
            json={"name": f"看板账户-{suffix}", "market": "CN", "currency": "CNY", "accountType": "fund"},
        )
        assert account.status_code == 201

        payload = {
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
            "unitPrice": "3.5",
            "fee": "1",
            "occurredOn": "2026-08-17",
        }
        first = client.post("/api/v1/finance/transactions", headers=HEADERS, json=payload)
        second = client.post(
            "/api/v1/finance/transactions",
            headers=HEADERS,
            json={**payload, "quantity": "50", "unitPrice": "4.0"},
        )
        assert first.status_code == 201
        assert second.status_code == 201

        dashboard = client.get("/api/v1/finance/dashboard", headers=HEADERS)
        assert dashboard.status_code == 200
        body = dashboard.json()["data"]
        position = next(item for item in body["positions"] if item["instrumentId"] == first.json()["data"]["instrumentId"])
        assert position["quantity"] == "150"
        assert position["averageCost"] == "3.68"
        assert body["summary"]["positionCount"] >= 1
        assert body["summary"]["costBasis"]

        transactions = client.get("/api/v1/finance/transactions", headers=HEADERS).json()["data"]
        matching = [item for item in transactions if item["instrumentId"] == first.json()["data"]["instrumentId"]]
        assert {item["unitPrice"] for item in matching} == {"3.5", "4"}
