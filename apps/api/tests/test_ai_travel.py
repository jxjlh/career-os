from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}
USER_B = {"Authorization": "Bearer dev", "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002", "Content-Type": "application/json"}


class FakeTravelAI:
    name = "openai"
    model = "gpt-test"

    async def complete(self, messages, response_format=None, **kwargs):
        return (
            '{"title":"西藏7日深度旅行计划","summary":"深度体验拉萨与林芝",'
            '"best_time":"5-10月","route":[{"day":1,"title":"抵达拉萨","activities":["办理入住","适应高原"]}],'
            '"preparation":["身份证","防晒"],"tips":["注意高反"]}'
        )


def test_travel_plan_api(monkeypatch) -> None:
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeTravelAI())
    with TestClient(app) as client:
        goal = client.post(
            "/api/v1/life/goals",
            headers=HEADERS,
            json={"title": "去西藏", "category": "travel"},
        )
        goal_id = goal.json()["data"]["id"]

        response = client.post(
            "/api/v1/ai/travel-plan",
            headers=HEADERS,
            json={
                "goal_id": goal_id,
                "destination": "西藏",
                "days": 7,
                "budget": "10000",
                "people": "solo",
                "interests": ["摄影", "自然"],
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["title"] == "西藏7日深度旅行计划"
        assert body["route"][0]["day"] == 1
        assert body["preparation"] == ["身份证", "防晒"]
        assert body["aiContentId"]

        other = client.post(
            "/api/v1/ai/travel-plan",
            headers=USER_B,
            json={"goal_id": goal_id, "destination": "西藏", "days": 3},
        )
        assert other.status_code == 404
