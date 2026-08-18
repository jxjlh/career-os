from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.db.models import FinanceAnalysisRun
from app.main import app


def _reset_settings_cache() -> None:
    get_settings.cache_clear()


def test_scheduled_analysis_rejects_anonymous_calls_without_configured_secret(monkeypatch) -> None:
    monkeypatch.delenv("FINANCE_SCHEDULER_TOKEN", raising=False)
    _reset_settings_cache()

    with TestClient(app) as client:
        response = client.post("/api/v1/finance/analysis/run", json={"scope": "all_markets"})

    assert response.status_code == 401


def test_scheduled_analysis_rejects_incorrect_private_token(monkeypatch) -> None:
    monkeypatch.setenv("FINANCE_SCHEDULER_TOKEN", "scheduler-secret")
    _reset_settings_cache()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/finance/analysis/run",
            headers={"X-Finance-Scheduler-Token": "incorrect-token"},
            json={"scope": "all_markets"},
        )

    assert response.status_code == 401


def test_scheduled_analysis_accepts_matching_private_token(monkeypatch) -> None:
    monkeypatch.setenv("FINANCE_SCHEDULER_TOKEN", "scheduler-secret")
    _reset_settings_cache()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/finance/analysis/run",
            headers={"X-Finance-Scheduler-Token": "scheduler-secret"},
            json={"scope": "all_markets"},
        )

    assert response.status_code == 202
    assert response.json()["data"]["scope"] == "all_markets"


def test_logged_in_user_runs_analysis_without_scheduler_token(monkeypatch) -> None:
    user_id = "00000000-0000-0000-0000-000000000099"
    monkeypatch.delenv("FINANCE_SCHEDULER_TOKEN", raising=False)
    _reset_settings_cache()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/finance/analysis/run",
            headers={"Authorization": "Bearer dev", "X-Dev-User-Id": user_id},
        )

    assert response.status_code == 200
    run_id = response.json()["data"]["id"]
    with SessionLocal() as db:
        assert db.get(FinanceAnalysisRun, run_id).user_id == user_id
