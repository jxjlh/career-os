import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
from app.core.database import SessionLocal
from app.db.models import AIContent, GoalTask
from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}
USER_B = {"Authorization": "Bearer dev", "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002", "Content-Type": "application/json"}


class FakeAssistantAI:
    name = "openai"
    model = "gpt-test"
    calls = 0

    async def complete(self, messages, response_format=None, **kwargs):
        FakeAssistantAI.calls += 1
        return (
            '{"greeting":"早上好，今天继续成长吧",'
            '"focus_goal":{"title":"成为优秀销售经理","reason":"完成客户画像分析"},'
            '"today_focus":["完成客户画像分析"],'
            '"suggestions":["上午完成学习任务","晚上复盘"],'
            '"motivation":"坚持每天进步",'
            '"daily_summary":"保持执行节奏"}'
        )


def test_daily_assistant_with_tasks_and_cache(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeAssistantAI())
    FakeAssistantAI.calls = 0
    today = date.today()
    user_id = str(uuid.uuid4())
    headers = {
        "Authorization": "Bearer dev",
        "X-Dev-User-Id": user_id,
        "Content-Type": "application/json",
    }
    with TestClient(app) as client:
        goal = client.post(
            "/api/v1/life/goals",
            headers=headers,
            json={"title": "成为优秀销售经理", "category": "career"},
        )
        goal_id = goal.json()["data"]["id"]

        db = SessionLocal()
        try:
            db.add(
                GoalTask(
                    user_id=user_id,
                    life_goal_id=goal_id,
                    title="完成客户画像分析",
                    task_type="daily",
                    due_date=today,
                    status="todo",
                )
            )
            db.add(
                GoalTask(
                    user_id=user_id,
                    life_goal_id=goal_id,
                    title="阅读销售资料",
                    task_type="daily",
                    due_date=today - timedelta(days=1),
                    status="done",
                )
            )
            db.commit()
        finally:
            db.close()

        response = client.get("/api/v1/ai/assistant/daily", headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["greeting"] == "早上好，今天继续成长吧"
        assert body["focusGoal"]["title"] == "成为优秀销售经理"
        assert body["focusGoal"]["progress"] == "50%"
        assert [task["title"] for task in body["todayTasks"]] == ["完成客户画像分析"]
        assert body["progress"]["completedTasks"] == 1
        assert body["progress"]["totalTasks"] == 2
        assert body["progress"]["level"] >= 1
        assert body["suggestions"] == ["完成客户画像分析", "上午完成学习任务", "晚上复盘"]
        assert body["motivation"] == "坚持每天进步"

        db = SessionLocal()
        try:
            records = (
                db.query(AIContent)
                .filter(AIContent.user_id == user_id, AIContent.content_type == "life_assistant")
                .all()
            )
            assert len(records) == 1
            assert records[0].output_json["greeting"] == "早上好，今天继续成长吧"
        finally:
            db.close()

        assert FakeAssistantAI.calls == 1
        second = client.get("/api/v1/ai/assistant/daily", headers=headers)
        assert second.status_code == 200
        assert FakeAssistantAI.calls == 1


def test_daily_assistant_user_isolation(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeAssistantAI())
    with TestClient(app) as client:
        response = client.get("/api/v1/ai/assistant/daily", headers=USER_B)
        assert response.status_code == 200
        body = response.json()
        assert body["focusGoal"]["title"] == "尚未设定人生目标"
        assert body["progress"]["totalTasks"] == 0
