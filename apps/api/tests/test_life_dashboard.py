from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}
USER_B = {"Authorization": "Bearer dev", "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002", "Content-Type": "application/json"}


def test_new_user_dashboard_is_empty() -> None:
    with TestClient(app) as client:
        dashboard = client.get("/api/v1/life/dashboard", headers=USER_B)
        assert dashboard.status_code == 200
        body = dashboard.json()["data"]
        assert body["totalGoals"] == 0
        assert body["completedGoals"] == 0
        assert body["experience"] == 0
        assert body["level"] == 1
        assert body["categoryStats"] == {}


def test_dashboard_stats_xp_and_level() -> None:
    with TestClient(app) as client:
        travel = client.post(
            "/api/v1/life/goals",
            headers=HEADERS,
            json={"title": "去西藏", "category": "travel"},
        )
        career = client.post(
            "/api/v1/life/goals",
            headers=HEADERS,
            json={"title": "年薪目标", "category": "career"},
        )
        travel_id = travel.json()["data"]["id"]
        career_id = career.json()["data"]["id"]

        client.patch(f"/api/v1/life/goals/{travel_id}", headers=HEADERS, json={"status": "in_progress"})
        client.patch(f"/api/v1/life/goals/{travel_id}", headers=HEADERS, json={"status": "completed"})
        client.patch(f"/api/v1/life/goals/{career_id}", headers=HEADERS, json={"status": "in_progress"})
        client.patch(f"/api/v1/life/goals/{career_id}", headers=HEADERS, json={"status": "completed"})

        dashboard = client.get("/api/v1/life/dashboard", headers=HEADERS).json()["data"]
        assert dashboard["totalGoals"] >= 2
        assert dashboard["completedGoals"] >= 2
        assert dashboard["experience"] >= 300
        assert dashboard["level"] == 2
        assert dashboard["categoryStats"]["travel"]["completed"] >= 1
        assert dashboard["categoryStats"]["career"]["completed"] >= 1
        assert len(dashboard["recentCompleted"]) >= 1


def test_invalid_status_transition_rejected() -> None:
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/life/goals",
            headers=HEADERS,
            json={"title": "学游泳", "category": "skill"},
        )
        goal_id = created.json()["data"]["id"]
        client.patch(f"/api/v1/life/goals/{goal_id}", headers=HEADERS, json={"status": "in_progress"})
        client.patch(f"/api/v1/life/goals/{goal_id}", headers=HEADERS, json={"status": "completed"})
        invalid = client.patch(f"/api/v1/life/goals/{goal_id}", headers=HEADERS, json={"status": "pending"})
        assert invalid.status_code == 400
        assert invalid.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


def test_dashboard_user_isolation() -> None:
    with TestClient(app) as client:
        user_b_dashboard = client.get("/api/v1/life/dashboard", headers=USER_B).json()["data"]
        assert user_b_dashboard["totalGoals"] == 0
