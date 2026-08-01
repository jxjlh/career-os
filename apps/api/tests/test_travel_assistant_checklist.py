from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Authorization": "Bearer dev"}


def test_travel_assistant_fallback_and_checklist_crud() -> None:
    with TestClient(app) as client:
        assistant = client.post(
            "/api/v1/ai/travel-assistant",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"messages": [{"role": "user", "content": "我想去大理 7 天"}]},
        )
        assert assistant.status_code == 200
        plan = assistant.json()
        assert plan["id"]
        assert plan["reply"]

        checklist = client.get(
            f"/api/v1/ai/travel-plan/{plan['id']}/checklist",
            headers=HEADERS,
        )
        assert checklist.status_code == 200
        assert checklist.json() == []

        created = client.post(
            f"/api/v1/ai/travel-plan/{plan['id']}/checklist",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"item": "护照", "note": "检查有效期"},
        )
        assert created.status_code == 201
        item = created.json()
        assert item["item"] == "护照"
        assert item["note"] == "检查有效期"

        updated = client.patch(
            f"/api/v1/ai/travel-plan/checklist/{item['id']}",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"checked": True, "note": "已放包里"},
        )
        assert updated.status_code == 200
        assert updated.json()["checked"] is True
        assert updated.json()["note"] == "已放包里"

        deleted = client.delete(
            f"/api/v1/ai/travel-plan/checklist/{item['id']}",
            headers=HEADERS,
        )
        assert deleted.status_code == 204

        after_delete = client.get(
            f"/api/v1/ai/travel-plan/{plan['id']}/checklist",
            headers=HEADERS,
        )
        assert after_delete.json() == []
