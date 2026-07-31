import uuid
from datetime import date, datetime

from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
from app.core.database import SessionLocal
from app.db.models import AIContent, LifeRecord
from app.domains.ai.repository import AIContentRepository
from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}


class FakeYearSummaryAI:
    name = "openai"
    model = "gpt-test"

    async def complete(self, messages, response_format=None, **kwargs):
        return (
            '{"title":"2026年度人生总结","summary":"这一年你完成了重要的人生目标",'
            '"highlights":["完成西藏之旅","成为销售经理"],'
            '"growth":{"goals_completed":2,"records":1,"xp_gained":300,"level":2},'
            '"versions":{"normal":"完整版","moments":"朋友圈版","xiaohongshu":"小红书版"}}'
        )


def _headers(user_id: str) -> dict:
    return {
        "Authorization": "Bearer dev",
        "X-Dev-User-Id": user_id,
        "Content-Type": "application/json",
    }


def _complete_goal(client, headers: dict, title: str, category: str) -> str:
    created = client.post("/api/v1/life/goals", headers=headers, json={"title": title, "category": category})
    goal_id = created.json()["data"]["id"]
    client.patch(f"/api/v1/life/goals/{goal_id}", headers=headers, json={"status": "in_progress"})
    client.patch(f"/api/v1/life/goals/{goal_id}", headers=headers, json={"status": "completed"})
    return goal_id


def test_year_summary_generate_and_fetch(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeYearSummaryAI())
    user_id = str(uuid.uuid4())
    headers = _headers(user_id)
    year = date.today().year

    with TestClient(app) as client:
        travel_goal_id = _complete_goal(client, headers, "去一次西藏", "travel")
        _complete_goal(client, headers, "成为销售经理", "career")

        db = SessionLocal()
        try:
            db.add(
                LifeRecord(
                    user_id=user_id,
                    goal_id=travel_goal_id,
                    record_type="photo",
                    content="在布达拉宫前完成了西藏之旅",
                    city="拉萨",
                    country="中国",
                    created_at=datetime.utcnow(),
                )
            )
            db.commit()
        finally:
            db.close()

        response = client.post("/api/v1/ai/year-summary", headers=headers, json={"year": year})
        assert response.status_code == 200
        body = response.json()
        assert body["year"] == year
        assert body["title"] == "2026年度人生总结"
        assert body["highlights"] == ["完成西藏之旅", "成为销售经理"]
        assert body["versions"]["moments"] == "朋友圈版"
        assert body["aiContentId"]

        db = SessionLocal()
        try:
            content = (
                db.query(AIContent)
                .filter(AIContent.user_id == user_id, AIContent.content_type == "year_summary")
                .first()
            )
            assert content is not None
            assert content.input_json["year"] == year
            titles = [goal["title"] for goal in content.input_json["completed_goals"]]
            assert "去一次西藏" in titles
        finally:
            db.close()

        fetched = client.get("/api/v1/ai/year-summary", headers=headers, params={"year": year})
        assert fetched.status_code == 200
        assert fetched.json()["aiContentId"] == body["aiContentId"]

        missing = client.get("/api/v1/ai/year-summary", headers=headers, params={"year": year + 1})
        assert missing.status_code == 404


def test_year_summary_user_isolation(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeYearSummaryAI())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    with TestClient(app) as client:
        _complete_goal(client, _headers(user_a), "用户A专属目标", "travel")
        summary_a = client.post(
            "/api/v1/ai/year-summary",
            headers=_headers(user_a),
            json={"year": date.today().year},
        )
        assert summary_a.status_code == 200
        other = client.post(
            "/api/v1/ai/year-summary",
            headers=_headers(user_b),
            json={"year": date.today().year},
        )
        assert other.status_code == 200

        db = SessionLocal()
        try:
            content_b = (
                db.query(AIContent)
                .filter(AIContent.user_id == user_b, AIContent.content_type == "year_summary")
                .first()
            )
            assert content_b is not None
            titles = [goal["title"] for goal in content_b.input_json["completed_goals"]]
            assert "用户A专属目标" not in titles

            content_a = (
                db.query(AIContent)
                .filter(AIContent.user_id == user_a, AIContent.content_type == "year_summary")
                .first()
            )
            assert content_a is not None
            assert AIContentRepository(db).get_by_id(user_b, content_a.id) is None
        finally:
            db.close()
