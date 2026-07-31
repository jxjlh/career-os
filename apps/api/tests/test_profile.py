from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}


def test_profile_get_create_update() -> None:
    with TestClient(app) as client:
        created = client.get("/api/v1/profile", headers=HEADERS)
        assert created.status_code == 200
        assert created.json()["userId"] == "00000000-0000-0000-0000-000000000001"

        updated = client.put(
            "/api/v1/profile",
            headers=HEADERS,
            json={
                "nickname": "Lin",
                "bio": "Growth journey",
                "currentStage": "career_exploration",
                "strengths": ["curiosity", "execution"],
                "interests": ["marketing", "data"],
                "careerDirection": "growth marketing",
            },
        )
        assert updated.status_code == 200
        body = updated.json()
        assert body["nickname"] == "Lin"
        assert body["currentStage"] == "career_exploration"
        assert body["strengths"] == ["curiosity", "execution"]

        fetched = client.get("/api/v1/profile", headers=HEADERS)
        assert fetched.json()["nickname"] == "Lin"


def test_profile_is_user_scoped() -> None:
    with TestClient(app) as client:
        other = client.get(
            "/api/v1/profile",
            headers={**HEADERS, "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002"},
        )
        assert other.status_code == 200
        assert other.json()["userId"] == "00000000-0000-0000-0000-000000000002"
        assert other.json()["nickname"] is None
