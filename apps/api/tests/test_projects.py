from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Authorization": "Bearer dev"}
USER_B = {"Authorization": "Bearer dev", "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002"}


def test_project_create_upload_and_download(monkeypatch) -> None:
    async def fake_upload(path: str, content: bytes, content_type: str) -> str:
        return f"/media/{path}"

    monkeypatch.setattr("app.domains.projects.router.upload_object", fake_upload)
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/projects",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"title": "数据分析项目", "description": "从数据采集到落地"},
        )
        assert created.status_code == 201
        project_id = created.json()["data"]["id"]

        uploaded = client.post(
            f"/api/v1/projects/{project_id}/files/upload",
            headers=HEADERS,
            files={"file": ("demo.pdf", b"fake-pdf-bytes", "application/pdf")},
        )
        assert uploaded.status_code == 201
        file_id = uploaded.json()["data"]["id"]

        projects = client.get("/api/v1/projects", headers=HEADERS)
        assert projects.status_code == 200
        assert projects.json()["data"][0]["files"][0]["originalName"] == "demo.pdf"

        download = client.get(
            f"/api/v1/projects/{project_id}/files/{file_id}/download",
            headers=HEADERS,
        )
        assert download.status_code == 200
        assert download.json()["data"]["url"].startswith("/media/")

        denied = client.get(
            f"/api/v1/projects/{project_id}/files/{file_id}/download",
            headers=USER_B,
        )
        assert denied.status_code == 404


def test_project_can_be_deleted_and_is_user_scoped() -> None:
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/projects",
            headers=HEADERS,
            json={"title": "待删除作品"},
        )
        assert created.status_code == 201
        project_id = created.json()["data"]["id"]

        deleted = client.delete(f"/api/v1/projects/{project_id}", headers=HEADERS)
        assert deleted.status_code == 204
        assert client.get(f"/api/v1/projects/{project_id}", headers=HEADERS).status_code == 404


def test_project_delete_cannot_cross_users() -> None:
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/projects",
            headers=HEADERS,
            json={"title": "私有作品"},
        )
        project_id = created.json()["data"]["id"]

        deleted = client.delete(
            f"/api/v1/projects/{project_id}",
            headers={**HEADERS, "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002"},
        )
        assert deleted.status_code == 404
