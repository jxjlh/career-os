import time

from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Authorization": "Bearer dev"}
USER_B = {"Authorization": "Bearer dev", "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002"}


def _create_goal(client, title="分页测试目标") -> str:
    response = client.post(
        "/api/v1/life/goals",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"title": title, "category": "travel"},
    )
    return response.json()["data"]["id"]


def _create_record(client, goal_id, content) -> None:
    client.post(
        f"/api/v1/life/goals/{goal_id}/records",
        headers=HEADERS,
        data={"record_type": "text", "content": content},
    )
    time.sleep(0.01)


def test_paginated_records() -> None:
    with TestClient(app) as client:
        goal_id = _create_goal(client, "分页目标")
        for index in range(3):
            _create_record(client, goal_id, f"记录 {index}")

        page1 = client.get("/api/v1/life/records?page=1&page_size=2&goal_id=" + goal_id, headers=HEADERS)
        assert page1.status_code == 200
        body = page1.json()["data"]
        assert body["total"] == 3
        assert body["page"] == 1
        assert body["pageSize"] == 2
        assert len(body["items"]) == 2

        page2 = client.get("/api/v1/life/records?page=2&page_size=2&goal_id=" + goal_id, headers=HEADERS)
        assert len(page2.json()["data"]["items"]) == 1

        timestamps = [item["createdAt"] for item in page1.json()["data"]["items"]]
        assert timestamps == sorted(timestamps, reverse=True)


def test_record_list_user_isolation() -> None:
    with TestClient(app) as client:
        goal_id = _create_goal(client, "隔离目标")
        _create_record(client, goal_id, "A 的记录")
        user_b = client.get("/api/v1/life/records", headers=USER_B)
        assert user_b.json()["data"]["total"] == 0
