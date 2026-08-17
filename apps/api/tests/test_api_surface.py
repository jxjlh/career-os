from fastapi.testclient import TestClient

from app.main import app


def test_unknown_api_routes_are_not_served_by_spa_fallback() -> None:
    response = TestClient(app).get("/api/v1/ai/coach/chat")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
