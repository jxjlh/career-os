from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}


def test_life_goal_crud() -> None:
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/life/goals",
            headers=HEADERS,
            json={
                "title": "去一次西藏",
                "category": "travel",
                "difficulty": 4,
                "targetDate": "2027-08-01",
                "location": "西藏 拉萨",
                "latitude": 29.65,
                "longitude": 91.1,
            },
        )
        assert created.status_code == 201
        goal = created.json()["data"]
        goal_id = goal["id"]
        assert goal["category"] == "travel"
        assert goal["difficulty"] == 4
        assert goal["status"] == "pending"

        listed = client.get("/api/v1/life/goals", headers=HEADERS)
        assert any(item["id"] == goal_id for item in listed.json()["data"])

        updated = client.patch(
            f"/api/v1/life/goals/{goal_id}",
            headers=HEADERS,
            json={"status": "in_progress", "coverImage": "https://example.com/tibet.jpg"},
        )
        assert updated.status_code == 200
        assert updated.json()["data"]["status"] == "in_progress"
        assert updated.json()["data"]["coverImage"] == "https://example.com/tibet.jpg"

        fetched = client.get(f"/api/v1/life/goals/{goal_id}", headers=HEADERS)
        assert fetched.json()["data"]["title"] == "去一次西藏"

        deleted = client.delete(f"/api/v1/life/goals/{goal_id}", headers=HEADERS)
        assert deleted.status_code == 204


def test_life_goal_permission_and_validation() -> None:
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/life/goals",
            headers=HEADERS,
            json={"title": "看极光", "category": "travel"},
        )
        goal_id = created.json()["data"]["id"]
        other = client.get(
            f"/api/v1/life/goals/{goal_id}",
            headers={**HEADERS, "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002"},
        )
        assert other.status_code == 404

        invalid = client.post(
            "/api/v1/life/goals",
            headers=HEADERS,
            json={"title": "错误难度", "difficulty": 9},
        )
        assert invalid.status_code == 422

        custom_category = client.post(
            "/api/v1/life/goals",
            headers=HEADERS,
            json={"title": "自定义分类目标", "category": "家庭"},
        )
        assert custom_category.status_code == 201
        assert custom_category.json()["data"]["category"] == "家庭"
