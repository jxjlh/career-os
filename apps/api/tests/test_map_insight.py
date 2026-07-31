"""POST /api/v1/ai/map-insight 测试.

覆盖: AI 正常返回足迹总结 + 下一站推荐, AI 不可用时回退模板, 无数据场景.
全部用 FakeMapAI 替换 provider, 不依赖真实讯飞星火.
"""

import json
import uuid

from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
from app.main import app


class FakeMapAI:
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


def _fresh_headers() -> dict[str, str]:
    return {"Authorization": "Bearer dev", "X-Dev-User-Id": str(uuid.uuid4())}


def _seed_map_data(client, headers) -> None:
    """创建一条带坐标的人生目标 + 记录, 让地图有数据."""
    goal = client.post(
        "/api/v1/life/goals",
        headers={**headers, "Content-Type": "application/json"},
        json={"title": "环游日本", "category": "travel", "latitude": 35.68, "longitude": 139.69},
    ).json()["data"]
    client.post(
        f"/api/v1/life/goals/{goal['id']}/records",
        headers=headers,
        data={
            "record_type": "text",
            "content": "东京塔夜景",
            "latitude": "35.66",
            "longitude": "139.74",
            "city": "Tokyo",
            "country": "Japan",
        },
    )


def test_map_insight_ai_success(monkeypatch) -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        _seed_map_data(client, headers)
        fake = FakeMapAI(
            {
                "summary": "今年你的脚步遍布 1 个城市、1 个国家, 旅行里程约 300 公里。",
                "highlights": ["首次踏足日本", "完成东京塔打卡"],
                "next_stop": {
                    "title": "京都",
                    "reason": "距离东京仅一步之遥, 古都值得一访",
                    "category": "travel",
                },
                "suggestions": ["多记录旅途照片", "为下一段旅程提前规划"],
            }
        )
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: fake)

        resp = client.post("/api/v1/ai/map-insight", headers={**headers, "Content-Type": "application/json"})
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["source"] == "ai"
        assert "1 个城市" in body["summary"]
        assert len(body["highlights"]) == 2
        assert body["nextStop"]["title"] == "京都"
        assert body["nextStop"]["category"] == "travel"
        assert len(body["suggestions"]) == 2


def test_map_insight_fallback_when_ai_error(monkeypatch) -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        _seed_map_data(client, headers)
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: BrokenAI())

        resp = client.post("/api/v1/ai/map-insight", headers={**headers, "Content-Type": "application/json"})
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["source"] == "fallback"
        assert "城市" in body["summary"]
        assert isinstance(body["highlights"], list)
        assert isinstance(body["suggestions"], list)


def test_map_insight_empty_user(monkeypatch) -> None:
    """无任何个人数据的用户也能正常获取洞察 (回退模板)."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        # AI 不可用 -> 回退模板仍可返回有意义的总结
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: BrokenAI())
        resp = client.post("/api/v1/ai/map-insight", headers={**headers, "Content-Type": "application/json"})
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["source"] == "fallback"
        assert "城市" in body["summary"]
        assert isinstance(body["suggestions"], list)
