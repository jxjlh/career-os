from fastapi.testclient import TestClient

import app.main as main
from app.core.config import Settings


def test_production_api_redirects_frontend_routes_to_web_service(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "settings",
        Settings(
            app_env="production",
            frontend_url="https://ai-life-os-web.onrender.com",
        ),
    )

    with TestClient(main.app, follow_redirects=False) as client:
        response = client.get("/login/?next=%2Fjournal")

    assert response.status_code == 307
    assert response.headers["location"] == "https://ai-life-os-web.onrender.com/login/?next=%2Fjournal"
