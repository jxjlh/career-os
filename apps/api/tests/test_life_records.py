from fastapi.testclient import TestClient

import app.domains.life.service as life_service
from app.main import app

HEADERS = {"Authorization": "Bearer dev"}
USER_B = {"Authorization": "Bearer dev", "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002"}


def _create_goal(client, title="人生记录测试目标", category="travel") -> str:
    response = client.post(
        "/api/v1/life/goals",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"title": title, "category": category},
    )
    return response.json()["data"]["id"]


def test_create_text_record_and_timeline() -> None:
    with TestClient(app) as client:
        goal_id = _create_goal(client)
        created = client.post(
            f"/api/v1/life/goals/{goal_id}/records",
            headers=HEADERS,
            data={"record_type": "text", "content": "第一次看到布达拉宫", "city": "拉萨"},
        )
        assert created.status_code == 201
        assert created.json()["data"]["goalId"] == goal_id

        records = client.get(f"/api/v1/life/goals/{goal_id}/records", headers=HEADERS)
        assert len(records.json()["data"]) == 1
        assert records.json()["data"][0]["content"] == "第一次看到布达拉宫"

        timeline = client.get("/api/v1/life/records", headers=HEADERS)
        assert timeline.status_code == 200
        assert timeline.json()["data"]["total"] >= 1
        assert timeline.json()["data"]["items"][0]["goalId"] == goal_id


def test_photo_upload_record(monkeypatch) -> None:
    async def fake_upload(user_id, goal_id, filename, content, content_type):
        return f"{user_id}/{goal_id}/watermark/{filename}"

    monkeypatch.setattr(life_service, "upload_record_file", fake_upload)
    with TestClient(app) as client:
        goal_id = _create_goal(client)
        files = {"file": ("tibet.jpg", b"fake-image-bytes", "image/jpeg")}
        created = client.post(
            f"/api/v1/life/goals/{goal_id}/records",
            headers=HEADERS,
            files=files,
            data={"record_type": "photo", "city": "拉萨", "country": "中国"},
        )
        assert created.status_code == 201
        records = client.get(f"/api/v1/life/goals/{goal_id}/records", headers=HEADERS)
        assert records.json()["data"][0]["photoUrl"].endswith("tibet.jpg")


def test_life_record_media_endpoint(monkeypatch) -> None:
    async def fake_upload(user_id, goal_id, filename, content, content_type):
        return f"{user_id}/{goal_id}/watermark/{filename}"

    async def fake_resolve(path: str) -> str | None:
        return f"https://cdn.example.com/{path}"

    monkeypatch.setattr(life_service, "upload_record_file", fake_upload)
    monkeypatch.setattr("app.domains.life.router.resolve_object_url", fake_resolve)
    with TestClient(app) as client:
        goal_id = _create_goal(client)
        files = {"file": ("tibet.jpg", b"fake-image-bytes", "image/jpeg")}
        created = client.post(
            f"/api/v1/life/goals/{goal_id}/records",
            headers=HEADERS,
            files=files,
            data={"record_type": "photo", "city": "拉萨"},
        )
        assert created.status_code == 201
        records = client.get(f"/api/v1/life/goals/{goal_id}/records", headers=HEADERS)
        path = records.json()["data"][0]["photoUrl"]

        media = client.get(f"/api/v1/life/records/media?path={path}", headers=HEADERS)
        assert media.status_code == 200
        assert media.json()["data"]["url"] == f"https://cdn.example.com/{path}"

        denied = client.get(f"/api/v1/life/records/media?path={path}", headers=USER_B)
        assert denied.status_code == 404


def test_record_user_isolation_and_delete() -> None:
    with TestClient(app) as client:
        goal_id = _create_goal(client)
        created = client.post(
            f"/api/v1/life/goals/{goal_id}/records",
            headers=HEADERS,
            data={"record_type": "text", "content": "我的记录"},
        )
        record_id = created.json()["data"]["id"]

        other_goal_records = client.get(f"/api/v1/life/goals/{goal_id}/records", headers=USER_B)
        assert other_goal_records.status_code == 404

        other_delete = client.delete(f"/api/v1/life/records/{record_id}", headers=USER_B)
        assert other_delete.status_code == 404

        own_delete = client.delete(f"/api/v1/life/records/{record_id}", headers=HEADERS)
        assert own_delete.status_code == 204
