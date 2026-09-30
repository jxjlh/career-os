from fastapi.testclient import TestClient

from app.main import app
from app.services.storage import StorageService

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


# ── 座右铭富文本（跨设备同步） ──────────────────────────────────────────────


def test_motto_style_round_trip_keeps_per_segment_style() -> None:
    with TestClient(app) as client:
        # 没有样式记录时用 life_motto 纯文本兜底成单片段
        client.put("/api/v1/profile", headers=HEADERS, json={"lifeMotto": "持续成长"})
        fallback = client.get("/api/v1/profile/motto", headers=HEADERS)
        assert fallback.status_code == 200
        assert [seg["t"] for seg in fallback.json()["segs"]] == ["持续成长"]
        assert fallback.json()["image"] is None

        saved = client.put(
            "/api/v1/profile/motto",
            headers=HEADERS,
            json={
                "segs": [{"t": "持续", "c": "#C49A5C", "s": 32}, {"t": "成长"}],
                "image": None,
            },
        )
        assert saved.status_code == 200
        assert saved.json()["segs"] == [
            {"t": "持续", "c": "#C49A5C", "s": 32},
            {"t": "成长", "c": None, "s": None},
        ]

        # 回读必须一致 —— 换设备能拿到同样样式就是靠这一条
        again = client.get("/api/v1/profile/motto", headers=HEADERS)
        assert again.json()["segs"] == saved.json()["segs"]
        # 纯文本镜像写进 life_motto，没升级的客户端至少能读到文字
        assert client.get("/api/v1/profile", headers=HEADERS).json()["lifeMotto"] == "持续成长"


def test_motto_style_rejects_empty_and_overlong_text() -> None:
    with TestClient(app) as client:
        empty = client.put("/api/v1/profile/motto", headers=HEADERS, json={"segs": []})
        assert empty.status_code == 422
        assert empty.json()["error"]["code"] == "MOTTO_EMPTY"

        overlong = client.put(
            "/api/v1/profile/motto",
            headers=HEADERS,
            json={"segs": [{"t": "字" * 301}]},
        )
        assert overlong.status_code == 422
        assert overlong.json()["error"]["code"] == "MOTTO_TOO_LONG"


def test_motto_style_stores_background_as_public_url(monkeypatch) -> None:
    """data URL 必须先落对象存储，库里只留 URL；已是 URL 的原样透传。"""
    uploaded: list[dict] = []

    def fake_upload(self, content: bytes, user_id: str, ext: str = ".jpg") -> str:
        uploaded.append({"bytes": len(content), "ext": ext, "user_id": user_id})
        return "https://cdn.example.com/life-motto/bg.jpg"

    monkeypatch.setattr(StorageService, "upload_motto_background", fake_upload)

    # 1x1 PNG
    png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
    )
    with TestClient(app) as client:
        saved = client.put(
            "/api/v1/profile/motto",
            headers=HEADERS,
            json={
                "segs": [{"t": "持续成长"}],
                "image": f"data:image/png;base64,{png_b64}",
            },
        )
        assert saved.status_code == 200
        assert saved.json()["image"] == "https://cdn.example.com/life-motto/bg.jpg"
        assert uploaded == [
            {"bytes": 70, "ext": ".png", "user_id": "00000000-0000-0000-0000-000000000001"}
        ]

        # 再存一次：传回来的是 URL，不该重复上传
        again = client.put(
            "/api/v1/profile/motto",
            headers=HEADERS,
            json={"segs": [{"t": "持续成长"}], "image": saved.json()["image"]},
        )
        assert again.status_code == 200
        assert again.json()["image"] == "https://cdn.example.com/life-motto/bg.jpg"
        assert len(uploaded) == 1

        # 清空背景
        cleared = client.put(
            "/api/v1/profile/motto",
            headers=HEADERS,
            json={"segs": [{"t": "持续成长"}], "image": None},
        )
        assert cleared.json()["image"] is None
