"""Life Goal Task Management: AI 成长规划生成的任务可被列出与完成.

覆盖完整闭环: 创建 life goal -> 生成 growth plan -> 生成 tasks ->
GET /life/goals/{id}/tasks 列出 -> PATCH /tasks/{id} 完成 -> 进度与状态正确.
"""

from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}
USER_B = {
    "Authorization": "Bearer dev",
    "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002",
    "Content-Type": "application/json",
}


class FakeGrowthAI:
    name = "openai"
    model = "gpt-test"

    async def complete(self, messages, response_format=None, **kwargs):
        return (
            '{"title":"30天计划","summary":"计划",'
            '"phases":[{"name":"基础","days":"1-2","tasks":["学习销售流程"]}],'
            '"daily_plan":['
            '{"day":1,"tasks":["学习销售流程"]},'
            '{"day":2,"tasks":["建立客户画像"]}'
            "],"
            '"milestones":["完成沟通"],"tips":["复盘"]}'
        )


def _create_life_goal(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/life/goals",
        headers=HEADERS,
        json={"title": "成为优秀销售经理", "category": "career", "startDate": "2026-08-10"},
    )
    return resp.json()["data"]["id"]


def _generate_plan_and_tasks(client: TestClient, goal_id: str) -> str:
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
    assert generated.json()["createdCount"] == 2
    return ai_content_id


def test_life_goal_tasks_listed_after_generation(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeGrowthAI())
    with TestClient(app) as client:
        goal_id = _create_life_goal(client)
        _generate_plan_and_tasks(client, goal_id)

        resp = client.get(f"/api/v1/life/goals/{goal_id}/tasks", headers=HEADERS)
        assert resp.status_code == 200
        tasks = resp.json()["data"]
        assert len(tasks) == 2
        # 任务均挂在 life_goal_id 上, goal_id 为空
        assert all(task["lifeGoalId"] == goal_id for task in tasks)
        assert all(task["goalId"] is None for task in tasks)
        # 按到期日升序排列
        assert tasks[0]["dueDate"] <= tasks[1]["dueDate"]
        titles = {task["title"] for task in tasks}
        assert titles == {"学习销售流程", "建立客户画像"}
        assert all(task["status"] == "todo" for task in tasks)


def test_complete_life_goal_task_via_patch(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeGrowthAI())
    with TestClient(app) as client:
        goal_id = _create_life_goal(client)
        _generate_plan_and_tasks(client, goal_id)

        tasks = client.get(f"/api/v1/life/goals/{goal_id}/tasks", headers=HEADERS).json()["data"]
        task_id = tasks[0]["id"]

        patched = client.patch(
            f"/api/v1/tasks/{task_id}",
            headers=HEADERS,
            json={"status": "done"},
        )
        assert patched.status_code == 200
        body = patched.json()["data"]
        assert body["status"] == "done"
        assert body["completedAt"] is not None

        # 再次列出: 1 done + 1 todo
        refreshed = client.get(f"/api/v1/life/goals/{goal_id}/tasks", headers=HEADERS).json()["data"]
        done_count = sum(1 for task in refreshed if task["status"] == "done")
        assert done_count == 1


def test_life_goal_tasks_user_isolation(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeGrowthAI())
    with TestClient(app) as client:
        goal_id = _create_life_goal(client)
        _generate_plan_and_tasks(client, goal_id)

        # 其他用户访问不属于自己的 life goal -> 404, 不泄露任务
        other = client.get(f"/api/v1/life/goals/{goal_id}/tasks", headers=USER_B)
        assert other.status_code == 404
        assert other.json()["detail"]["code"] == "NOT_FOUND"


def test_life_goal_tasks_empty_when_no_plan() -> None:
    with TestClient(app) as client:
        goal_id = _create_life_goal(client)
        resp = client.get(f"/api/v1/life/goals/{goal_id}/tasks", headers=HEADERS)
        assert resp.status_code == 200
        assert resp.json()["data"] == []


def test_life_goal_tasks_404_for_missing_goal() -> None:
    with TestClient(app) as client:
        resp = client.get("/api/v1/life/goals/does-not-exist/tasks", headers=HEADERS)
        assert resp.status_code == 404
