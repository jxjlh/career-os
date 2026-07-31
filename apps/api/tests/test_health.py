from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


def test_me_dev_user() -> None:
    with TestClient(app) as client:
        resp = client.get("/api/v1/me", headers={"Authorization": "Bearer dev"})
        assert resp.status_code == 200
        assert resp.json()["data"]["email"] == "dev@career-os.local"
