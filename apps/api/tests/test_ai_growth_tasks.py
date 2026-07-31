from datetime import date

from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
from app.core.database import SessionLocal
from app.db.models import GoalTask
from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}
USER_B = {"Authorization": "Bearer dev", "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002", "Content-Type": "application/json"}


class FakeGrowthTasksAI:
    name = "openai"
    model = "gpt-test"

    async def complete(self, messages, response_format=None, **kwargs):
        return (
            '{"title":"30天计划","summary":"计划",'
            '"phases":[{"name":"基础","days":"1-2","tasks":["学习销售流程"]}],'
            '"daily_plan":['
            '{"day":1,"tasks":["学习销售流程"]},'
            '{"day":2,"tasks":["建立客户画像"]}'
            '],"milestones":["完成沟通"],"tips":["复盘"]}'
        )


def test_generate_tasks_from_growth_plan(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeGrowthTasksAI())
    with TestClient(app) as client:
        goal = client.post(
            "/api/v1/life/goals",
            headers=HEADERS,
            json={"title": "成为优秀销售经理", "category": "career", "startDate": "2026-08-10"},
        )
        goal_id = goal.json()["data"]["id"]
        plan = client.post(
            "/api/v1/ai/growth-plan",
            headers=HEADERS,
            json={"goal_id": goal_id, "target_description": "成为优秀销售经理"},
        )
        ai_content_id = plan.json()["aiContentId"]

        generated = client.post(
            f"/api/v1/ai/growth-plan/{ai_content_id}/generate-tasks",
            headers=HEADERS,
        )
        assert generated.status_code == 200
        body = generated.json()
        assert body["createdCount"] == 2
        assert len(body["taskIds"]) == 2

        db = SessionLocal()
        try:
            tasks = db.query(GoalTask).filter(GoalTask.life_goal_id == goal_id).all()
            assert len(tasks) == 2
            titles = {task.title for task in tasks}
            assert titles == {"学习销售流程", "建立客户画像"}
            assert all(task.task_type == "daily" for task in tasks)
            due_dates = sorted(task.due_date for task in tasks)
            assert due_dates == [date(2026, 8, 10), date(2026, 8, 11)]
        finally:
            db.close()

        duplicate = client.post(
            f"/api/v1/ai/growth-plan/{ai_content_id}/generate-tasks",
            headers=HEADERS,
        )
        assert duplicate.status_code == 409
        assert duplicate.json()["error"]["code"] == "ALREADY_GENERATED"

        other = client.post(
            f"/api/v1/ai/growth-plan/{ai_content_id}/generate-tasks",
            headers=USER_B,
        )
        assert other.status_code == 404
