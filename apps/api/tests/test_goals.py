from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}


def test_goal_crud_and_tasks_progress() -> None:
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/goals",
            headers=HEADERS,
            json={
                "title": "学习数据分析",
                "visionType": "career",
                "priority": "high",
                "dueDate": "2026-12-31",
                "whyThisGoal": "进入数据分析方向",
            },
        )
        assert created.status_code == 201
        goal = created.json()["data"]
        goal_id = goal["id"]
        assert goal["visionType"] == "career"
        assert goal["progress"] == 0

        listed = client.get("/api/v1/goals", headers=HEADERS)
        assert listed.status_code == 200
        assert any(item["id"] == goal_id for item in listed.json()["data"])

        task1 = client.post(
            f"/api/v1/goals/{goal_id}/tasks",
            headers=HEADERS,
            json={"title": "SQL 基础", "taskType": "phase"},
        )
        task2 = client.post(
            f"/api/v1/goals/{goal_id}/tasks",
            headers=HEADERS,
            json={"title": "Power BI 项目", "taskType": "phase"},
        )
        assert task1.status_code == 201
        assert task2.status_code == 201
        task1_id = task1.json()["data"]["id"]
        task2_id = task2.json()["data"]["id"]

        done1 = client.patch(
            f"/api/v1/tasks/{task1_id}",
            headers=HEADERS,
            json={"status": "done"},
        )
        assert done1.status_code == 200
        assert done1.json()["data"]["checkInDates"]

        after_one = client.get(f"/api/v1/goals/{goal_id}", headers=HEADERS)
        assert after_one.json()["data"]["progress"] == 50

        done2 = client.patch(
            f"/api/v1/tasks/{task2_id}",
            headers=HEADERS,
            json={"status": "done"},
        )
        assert done2.status_code == 200
        after_two = client.get(f"/api/v1/goals/{goal_id}", headers=HEADERS)
        assert after_two.json()["data"]["progress"] == 100

        completed = client.patch(
            f"/api/v1/goals/{goal_id}",
            headers=HEADERS,
            json={"status": "completed"},
        )
        assert completed.json()["data"]["status"] == "completed"

        deleted = client.delete(f"/api/v1/goals/{goal_id}", headers=HEADERS)
        assert deleted.status_code == 204


def test_goal_permission_isolation() -> None:
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/goals",
            headers=HEADERS,
            json={"title": "私有目标"},
        )
        goal_id = created.json()["data"]["id"]
        other = client.get(
            f"/api/v1/goals/{goal_id}",
            headers={**HEADERS, "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002"},
        )
        assert other.status_code == 404
