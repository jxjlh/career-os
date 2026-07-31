from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}
USER_B = {"Authorization": "Bearer dev", "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002", "Content-Type": "application/json"}


class FakeGrowthAI:
    name = "openai"
    model = "gpt-test"
    last_prompt = ""

    async def complete(self, messages, response_format=None, **kwargs):
        FakeGrowthAI.last_prompt = messages[0]["content"]
        return (
            '{"title":"30天销售能力提升计划","summary":"帮助用户提升销售能力",'
            '"phases":[{"name":"基础阶段","days":"1-7","tasks":["学习销售流程","建立客户画像"]}],'
            '"daily_plan":[{"day":1,"tasks":["阅读销售资料"]}],'
            '"milestones":["完成10次客户沟通"],"tips":["每日复盘"]}'
        )


def test_growth_plan_api(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeGrowthAI())
    with TestClient(app) as client:
        goal = client.post(
            "/api/v1/life/goals",
            headers=HEADERS,
            json={"title": "成为优秀销售经理", "category": "career"},
        )
        goal_id = goal.json()["data"]["id"]

        response = client.post(
            "/api/v1/ai/growth-plan",
            headers=HEADERS,
            json={
                "goal_id": goal_id,
                "target_description": "成为优秀销售经理",
                "current_status": "销售新人",
                "available_time": "每天2小时",
                "difficulty": "medium",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["title"] == "30天销售能力提升计划"
        assert body["phases"][0]["name"] == "基础阶段"
        assert body["milestones"] == ["完成10次客户沟通"]
        assert body["aiContentId"]
        assert "销售新人" in FakeGrowthAI.last_prompt

        other = client.post(
            "/api/v1/ai/growth-plan",
            headers=USER_B,
            json={"goal_id": goal_id, "target_description": "成长"},
        )
        assert other.status_code == 404
