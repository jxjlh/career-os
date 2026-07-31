from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Authorization": "Bearer dev"}
USER_B = {"Authorization": "Bearer dev", "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002"}


def test_record_detail() -> None:
    with TestClient(app) as client:
        goal = client.post(
            "/api/v1/life/goals",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"title": "详情测试目标", "category": "travel"},
        )
        goal_id = goal.json()["data"]["id"]
        created = client.post(
            f"/api/v1/life/goals/{goal_id}/records",
            headers=HEADERS,
            data={"record_type": "text", "content": "布达拉宫", "city": "拉萨", "country": "中国"},
        )
        record_id = created.json()["data"]["id"]

        detail = client.get(f"/api/v1/life/records/{record_id}", headers=HEADERS)
        assert detail.status_code == 200
        body = detail.json()["data"]
        assert body["goalId"] == goal_id
        assert body["goalTitle"] == "详情测试目标"
        assert body["city"] == "拉萨"
        assert body["userId"] == "00000000-0000-0000-0000-000000000001"

        other = client.get(f"/api/v1/life/records/{record_id}", headers=USER_B)
        assert other.status_code == 404

        missing = client.get("/api/v1/life/records/00000000-0000-0000-0000-000000000099", headers=HEADERS)
        assert missing.status_code == 404
