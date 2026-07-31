"""Sprint 7 — Life Camera 模块测试.

覆盖:
- 连续打卡 (checkin_streak): 首次打卡 / 连续 / 中断重置 / 当天幂等 / 最长记录.
- 视频日志上传 (video record_type) + AI 场景字段落库.
- AI photo-analysis: 正常返回 + AI 不可用回退.
- AI journal: 正常返回 + AI 不可用回退.
- 记录创建联动: 自动打卡 + XP 奖励.

全部用 FakeCameraAI / BrokenAI 替换 provider, 不依赖真实讯飞星火.
"""

import json
import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
import app.domains.life.service as life_service
from app.core.database import SessionLocal
from app.db.models import CheckinStreak, UserLevel
from app.main import app


def _fresh_headers() -> dict[str, str]:
    return {"Authorization": "Bearer dev", "X-Dev-User-Id": str(uuid.uuid4())}


def _create_goal(client, headers, title="Life Camera 测试目标", category="travel") -> str:
    response = client.post(
        "/api/v1/life/goals",
        headers={**headers, "Content-Type": "application/json"},
        json={"title": title, "category": category},
    )
    return response.json()["data"]["id"]


# ── Fake AI providers ────────────────────────────────────────────────
class FakePhotoAI:
    name = "openai"
    model = "gpt-test"

    def __init__(self, payload: dict) -> None:
        self._payload = payload

    async def complete(self, messages, response_format=None, **kwargs):
        return json.dumps(self._payload, ensure_ascii=False)


class FakeJournalAI:
    name = "openai"
    model = "gpt-test"

    def __init__(self, payload: dict) -> None:
        self._payload = payload

    async def complete(self, messages, response_format=None, **kwargs):
        return json.dumps(self._payload, ensure_ascii=False)


class BrokenAI:
    name = "broken"
    model = "x"

    async def complete(self, messages, response_format=None, **kwargs):
        raise RuntimeError("provider down")


# =====================================================================
# 一、连续打卡
# =====================================================================
def test_checkin_first_time_creates_streak() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        resp = client.post("/api/v1/life/checkin", headers={**headers, "Content-Type": "application/json"})
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["currentStreak"] == 1
        assert body["longestStreak"] == 1
        assert body["totalCheckins"] == 1
        assert body["checkedInToday"] is True
        assert body["lastCheckinDate"] == date.today().isoformat()


def test_checkin_idempotent_same_day() -> None:
    """同一天重复打卡不应重复计数 (幂等)."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        client.post("/api/v1/life/checkin", headers={**headers, "Content-Type": "application/json"})
        second = client.post("/api/v1/life/checkin", headers={**headers, "Content-Type": "application/json"})
        assert second.status_code == 200
        body = second.json()["data"]
        assert body["currentStreak"] == 1
        assert body["totalCheckins"] == 1  # 未重复计数


def test_checkin_streak_continues_and_resets() -> None:
    """连续打卡 +1, 中断重置为 1, longest 取历史最大."""
    user_id = uuid.uuid4()
    headers = {"Authorization": "Bearer dev", "X-Dev-User-Id": str(user_id)}
    with TestClient(app) as client:
        # Day 1: 首次打卡
        client.post("/api/v1/life/checkin", headers={**headers, "Content-Type": "application/json"})

        db = SessionLocal()
        try:
            streak = db.query(CheckinStreak).filter(CheckinStreak.user_id == str(user_id)).first()
            assert streak is not None
            # Day 2: 连续 -> current=2
            streak.last_checkin_date = date.today() - timedelta(days=1)
            db.commit()
        finally:
            db.close()

        client.post("/api/v1/life/checkin", headers={**headers, "Content-Type": "application/json"})
        db = SessionLocal()
        try:
            streak = db.query(CheckinStreak).filter(CheckinStreak.user_id == str(user_id)).first()
            assert streak.current_streak == 2
            assert streak.longest_streak == 2

            # 中断 3 天: 重置为 1
            streak.last_checkin_date = date.today() - timedelta(days=3)
            db.commit()
        finally:
            db.close()

        client.post("/api/v1/life/checkin", headers={**headers, "Content-Type": "application/json"})
        db = SessionLocal()
        try:
            streak = db.query(CheckinStreak).filter(CheckinStreak.user_id == str(user_id)).first()
            assert streak.current_streak == 1
            # longest 仍保留历史最大值 2
            assert streak.longest_streak == 2
        finally:
            db.close()


def test_get_checkin_streak_empty_user() -> None:
    """从未打卡的用户也能正常获取 (返回零值)."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        resp = client.get("/api/v1/life/checkin", headers=headers)
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["currentStreak"] == 0
        assert body["checkedInToday"] is False


# =====================================================================
# 二、视频日志上传 + AI 场景字段
# =====================================================================
def test_video_record_upload_with_scene(monkeypatch) -> None:
    async def fake_upload(user_id, goal_id, filename, content, content_type, subdir="watermark"):
        return f"{user_id}/{goal_id}/{subdir}/{filename}"

    monkeypatch.setattr(life_service, "upload_record_file", fake_upload)
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal_id = _create_goal(client, headers)

        files = {
            "video": ("moment.mp4", b"fake-video-bytes", "video/mp4"),
            "thumbnail": ("cover.jpg", b"fake-thumb", "image/jpeg"),
        }
        data = {
            "record_type": "video",
            "content": "海边日落视频日志",
            "city": "Sanya",
            "country": "China",
            "latitude": "18.25",
            "longitude": "109.51",
            "duration_seconds": "60",
            "scene_type": "travel",
            "ai_tags": '["海边", "日落", "治愈"]',
            "temperature": "28.5",
        }
        resp = client.post(f"/api/v1/life/goals/{goal_id}/records", headers=headers, files=files, data=data)
        assert resp.status_code == 201
        record_id = resp.json()["data"]["id"]

        # 验证落库字段
        detail = client.get(f"/api/v1/life/records/{record_id}", headers=headers)
        assert detail.status_code == 200
        body = detail.json()["data"]
        assert body["recordType"] == "video"
        assert body["videoUrl"].endswith("moment.mp4")
        assert body["thumbnailUrl"].endswith("cover.jpg")
        assert body["durationSeconds"] == 60
        assert body["sceneType"] == "travel"
        assert body["aiTags"] == ["海边", "日落", "治愈"]
        assert body["temperature"] == 28.5


def test_photo_record_triggers_auto_checkin_and_xp(monkeypatch) -> None:
    """创建记录应自动触发当日打卡 + 增加 XP."""
    async def fake_upload(user_id, goal_id, filename, content, content_type, subdir="watermark"):
        return f"{user_id}/{goal_id}/{subdir}/{filename}"

    monkeypatch.setattr(life_service, "upload_record_file", fake_upload)
    user_id = uuid.uuid4()
    headers = {"Authorization": "Bearer dev", "X-Dev-User-Id": str(user_id)}
    with TestClient(app) as client:
        goal_id = _create_goal(client, headers)

        db = SessionLocal()
        try:
            level_before = db.query(UserLevel).filter(UserLevel.user_id == str(user_id)).first()
            xp_before = level_before.experience if level_before else 0
        finally:
            db.close()

        files = {"file": ("scene.jpg", b"fake-image", "image/jpeg")}
        data = {
            "record_type": "photo",
            "content": "城市街景",
            "city": "Shanghai",
            "country": "China",
            "scene_type": "city",
        }
        resp = client.post(f"/api/v1/life/goals/{goal_id}/records", headers=headers, files=files, data=data)
        assert resp.status_code == 201

        # 连续打卡应自动 +1
        checkin = client.get("/api/v1/life/checkin", headers=headers).json()["data"]
        assert checkin["checkedInToday"] is True
        assert checkin["currentStreak"] == 1

        # XP 应增加 (photo=10)
        db = SessionLocal()
        try:
            level_after = db.query(UserLevel).filter(UserLevel.user_id == str(user_id)).first()
            assert level_after is not None
            assert level_after.experience >= xp_before + 10
        finally:
            db.close()


# =====================================================================
# 三、AI 场景识别 (/ai/photo-analysis)
# =====================================================================
def test_photo_analysis_ai_success(monkeypatch) -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal = _create_goal(client, headers, title="环游世界", category="travel")

        fake = FakePhotoAI(
            {
                "scene_type": "travel",
                "tags": ["海边", "日落", "治愈"],
                "description": "夕阳下的海岸, 海风吹散疲惫。",
                "related_buckets": [],
                "related_goals": [
                    {"goal_id": goal, "reason": "契合环游世界的人生目标"}
                ],
                "suggested_record": {
                    "type": "travel",
                    "content": "今天傍晚站在海边, 看夕阳沉入海平面。",
                },
            }
        )
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: fake)

        resp = client.post(
            "/api/v1/ai/photo-analysis",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "latitude": 18.25,
                "longitude": 109.51,
                "city": "Sanya",
                "country": "China",
                "weather": "晴",
                "temperature": 28.5,
                "altitude": 12.0,
                "capturedAt": "2026-08-01T18:30:00+08:00",
                "photoDescription": "海边的日落",
                "goalId": goal,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "ai"
        assert body["sceneType"] == "travel"
        assert "海边" in body["tags"]
        assert body["description"]
        assert body["relatedGoals"][0]["goalId"] == goal
        assert body["suggestedRecord"]["type"] == "travel"


def test_photo_analysis_fallback_when_ai_error(monkeypatch) -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal = _create_goal(client, headers, title="健康生活", category="health")

        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: BrokenAI())
        resp = client.post(
            "/api/v1/ai/photo-analysis",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "city": "Shanghai",
                "country": "China",
                "weather": "晴",
                "goalId": goal,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "fallback"
        assert body["sceneType"] == "sport"  # health 目标 -> sport 场景
        assert isinstance(body["tags"], list) and len(body["tags"]) > 0
        assert body["description"]
        assert body["relatedGoals"][0]["goalId"] == goal


def test_photo_analysis_invalid_goal_404(monkeypatch) -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakePhotoAI({"scene_type": "travel"}))
        resp = client.post(
            "/api/v1/ai/photo-analysis",
            headers={**headers, "Content-Type": "application/json"},
            json={"goalId": str(uuid.uuid4())},
        )
        assert resp.status_code == 404


# =====================================================================
# 四、AI Journal (/ai/journal)
# =====================================================================
def test_journal_ai_success(monkeypatch) -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal = _create_goal(client, headers, title="记录美好生活", category="other")

        fake = FakeJournalAI(
            {
                "title": "海风里的傍晚",
                "body": "傍晚时分, 我站在海边, 看着夕阳一点点沉入海平面。海风带着咸味扑面而来, 这一刻, 一整天的疲惫都被海浪带走。",
                "reflection": "偶尔停下来看海, 才知道远方有多辽阔。",
                "keywords": ["海边", "日落", "治愈", "平静"],
            }
        )
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: fake)

        resp = client.post(
            "/api/v1/ai/journal",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "mediaType": "photo",
                "mediaDescription": "海边的日落, 远处有渔船",
                "city": "Sanya",
                "country": "China",
                "weather": "晴",
                "temperature": 28.0,
                "goalId": goal,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "ai"
        assert body["title"] == "海风里的傍晚"
        assert "海风" in body["body"]
        assert body["reflection"]
        assert "海边" in body["keywords"]


def test_journal_fallback_when_ai_error(monkeypatch) -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal = _create_goal(client, headers, title="环游世界", category="travel")

        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: BrokenAI())
        resp = client.post(
            "/api/v1/ai/journal",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "mediaType": "video",
                "mediaDescription": "海边的日落视频",
                "city": "Sanya",
                "country": "China",
                "weather": "晴",
                "goalId": goal,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "fallback"
        assert body["title"]
        assert "Sanya" in body["body"]
        assert body["reflection"]
        assert isinstance(body["keywords"], list) and len(body["keywords"]) > 0


def test_journal_video_type_in_fallback(monkeypatch) -> None:
    """视频日志回退也应正常生成, 含视频关键词."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: BrokenAI())
        resp = client.post(
            "/api/v1/ai/journal",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "mediaType": "video",
                "mediaDescription": "运动后的喜悦",
                "city": "Beijing",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "fallback"
        assert "视频" in body["keywords"]
        assert "Beijing" in body["body"]
