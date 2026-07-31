import uuid
from datetime import date

from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
from app.core.database import SessionLocal
from app.db.models import AIContent, GoalTask, LifeRecord
from app.domains.ai.repository import AIContentRepository
from app.main import app


class FakeYearReviewAI:
    name = "openai"
    model = "gpt-test"
    calls = 0
    last_prompt = ""

    async def complete(self, messages, response_format=None, **kwargs):
        FakeYearReviewAI.calls += 1
        FakeYearReviewAI.last_prompt = messages[0]["content"]
        return (
            '{"title":"我的2026人生报告","summary":"这是充满成长的一年",'
            '"statistics":{"goals_completed":2,"tasks_completed":1,"records_created":1,'
            '"cities_visited":1,"xp_gained":300},'
            '"achievements":["完成销售能力提升计划"],'
            '"growth":{"skills":["沟通能力提升"],"habits":["每日复盘"]},'
            '"memories":[{"title":"第一次独立完成项目","description":"在布达拉宫前完成旅行"}],'
            '"reflection":"今年最大的变化是更自律",'
            '"next_year_plan":["提升领导能力"]}'
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


def test_year_review_generate_and_stats(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeYearReviewAI())
    user_id = str(uuid.uuid4())
    headers = _headers(user_id)
    year = date.today().year

    with TestClient(app) as client:
        completed_id = _complete_goal(client, headers, "完成销售能力提升计划", "career")
        created = client.post("/api/v1/life/goals", headers=headers, json={"title": "读10本书", "category": "skill"})
        pending_id = created.json()["data"]["id"]

        db = SessionLocal()
        try:
            db.add(
                GoalTask(
                    user_id=user_id,
                    title="完成客户画像分析",
                    task_type="daily",
                    status="done",
                )
            )
            db.add(
                GoalTask(
                    user_id=user_id,
                    title="学习销售案例",
                    task_type="daily",
                    status="todo",
                )
            )
            db.add(
                LifeRecord(
                    user_id=user_id,
                    goal_id=completed_id,
                    record_type="photo",
                    content="在布达拉宫前完成旅行",
                    city="拉萨",
                    country="中国",
                )
            )
            db.commit()
        finally:
            db.close()

        response = client.post(
            "/api/v1/ai/year-review",
            headers=headers,
            json={"year": year, "style": "personal"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["title"] == "我的2026人生报告"
        assert body["statistics"]["goals_completed"] == 2
        assert body["achievements"] == ["完成销售能力提升计划"]
        assert body["growth"]["skills"] == ["沟通能力提升"]
        assert body["memories"][0]["title"] == "第一次独立完成项目"
        assert body["reflection"] == "今年最大的变化是更自律"
        assert body["nextYearPlan"] == ["提升领导能力"]
        assert body["aiContentId"]

        db = SessionLocal()
        try:
            content = (
                db.query(AIContent)
                .filter(AIContent.user_id == user_id, AIContent.content_type == "year_review")
                .first()
            )
            assert content is not None
            context = content.input_json
            assert context["year"] == year
            assert context["goals"]["total"] == 2
            assert context["goals"]["completed"] == 1
            assert context["goals"]["completed_titles"] == ["完成销售能力提升计划"]
            assert context["tasks"]["completed"] == 1
            assert context["tasks"]["total"] == 2
            assert context["records"]["count"] == 1
            assert "中国 拉萨" in context["records"]["cities_visited"]
            assert pending_id
        finally:
            db.close()

        assert FakeYearReviewAI.calls == 1


def test_year_review_style_and_cache(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeYearReviewAI())
    FakeYearReviewAI.calls = 0
    user_id = str(uuid.uuid4())
    headers = _headers(user_id)
    year = date.today().year

    with TestClient(app) as client:
        _complete_goal(client, headers, "完成销售能力提升计划", "career")

        first = client.post(
            "/api/v1/ai/year-review",
            headers=headers,
            json={"year": year, "style": "personal"},
        )
        assert first.status_code == 200
        assert FakeYearReviewAI.calls == 1

        cached = client.post(
            "/api/v1/ai/year-review",
            headers=headers,
            json={"year": year, "style": "personal"},
        )
        assert cached.status_code == 200
        assert cached.json()["aiContentId"] == first.json()["aiContentId"]
        assert FakeYearReviewAI.calls == 1

        social = client.post(
            "/api/v1/ai/year-review",
            headers=headers,
            json={"year": year, "style": "xiaohongshu"},
        )
        assert social.status_code == 200
        assert social.json()["aiContentId"] != first.json()["aiContentId"]
        assert FakeYearReviewAI.calls == 2
        assert "小红书" in FakeYearReviewAI.last_prompt

        other_year = client.post(
            "/api/v1/ai/year-review",
            headers=headers,
            json={"year": year + 1, "style": "personal"},
        )
        assert other_year.status_code == 200
        assert FakeYearReviewAI.calls == 3


def test_year_review_user_isolation(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeYearReviewAI())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())
    year = date.today().year

    with TestClient(app) as client:
        _complete_goal(client, _headers(user_a), "用户A专属目标", "travel")
        summary_a = client.post(
            "/api/v1/ai/year-review",
            headers=_headers(user_a),
            json={"year": year, "style": "personal"},
        )
        assert summary_a.status_code == 200
        content_a_id = summary_a.json()["aiContentId"]

        other = client.post(
            "/api/v1/ai/year-review",
            headers=_headers(user_b),
            json={"year": year, "style": "personal"},
        )
        assert other.status_code == 200

        db = SessionLocal()
        try:
            content_b = (
                db.query(AIContent)
                .filter(AIContent.user_id == user_b, AIContent.content_type == "year_review")
                .first()
            )
            assert content_b is not None
            titles = content_b.input_json["goals"]["completed_titles"]
            assert "用户A专属目标" not in titles
            assert AIContentRepository(db).get_by_id(user_b, content_a_id) is None
        finally:
            db.close()
