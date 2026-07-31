"""POST /api/v1/ai/bucket-recommendation 测试.

覆盖: AI 正常返回, AI 返回编造 id 被过滤, AI 不可用时回退热门, 已加入条目不重复推荐,
用户隔离. 全部用本地 FakeBucketAI 替换 provider, 不依赖真实讯飞星火.
"""

import uuid

from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}


class FakeBucketAI:
    """可配置返回内容的假 AI provider."""

    name = "openai"
    model = "gpt-test"

    def __init__(self, payload: dict) -> None:
        self._payload = payload

    async def complete(self, messages, response_format=None, **kwargs):
        import json

        return json.dumps(self._payload, ensure_ascii=False)


def _fresh_headers() -> dict[str, str]:
    return {"Authorization": "Bearer dev", "X-Dev-User-Id": str(uuid.uuid4())}


def _first_item_id(client, headers) -> str:
    listing = client.get(
        "/api/v1/life/bucket/items", headers=headers, params={"page_size": 5}
    ).json()["data"]
    return listing["items"][0]["id"]


def test_bucket_recommendation_ai_success(monkeypatch) -> None:
    """AI 正常返回 -> source=ai, 推荐条目携带 reason/matchScore."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        # 取一个真实 item_id 用于推荐回包
        item_id = _first_item_id(client, headers)
        fake = FakeBucketAI(
            {
                "recommendations": [
                    {
                        "item_id": item_id,
                        "reason": "契合你的旅行兴趣与预算",
                        "match_score": 88,
                        "priority": "high",
                    }
                ]
            }
        )
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: fake)

        resp = client.post(
            "/api/v1/ai/bucket-recommendation",
            headers={**headers, "Content-Type": "application/json"},
            json={"career": "工程师", "interests": ["旅行", "摄影"], "budget": "10000"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "ai"
        assert len(body["recommendations"]) == 1
        rec = body["recommendations"][0]
        assert rec["itemId"] == item_id
        assert rec["reason"] == "契合你的旅行兴趣与预算"
        assert rec["matchScore"] == 88
        assert rec["priority"] == "high"
        assert rec["title"]  # 回填真实标题


def test_bucket_recommendation_filters_fabricated_ids(monkeypatch) -> None:
    """AI 编造的 item_id 不在目录中, 直接丢弃, 返回空 -> 触发回退."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        fake = FakeBucketAI(
            {
                "recommendations": [
                    {
                        "item_id": "fake-id-not-exists",
                        "reason": "编造",
                        "match_score": 90,
                        "priority": "high",
                    }
                ]
            }
        )
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: fake)

        resp = client.post(
            "/api/v1/ai/bucket-recommendation",
            headers={**headers, "Content-Type": "application/json"},
            json={"career": "设计师"},
        )
        assert resp.status_code == 200
        body = resp.json()
        # 编造 id 被过滤后无可推荐 -> 回退热门
        assert body["source"] == "fallback"
        assert len(body["recommendations"]) > 0


def test_bucket_recommendation_fallback_when_ai_error(monkeypatch) -> None:
    """AI provider 抛异常 -> 回退热门, source=fallback."""

    class BrokenAI:
        name = "broken"
        model = "x"

        async def complete(self, messages, response_format=None, **kwargs):
            raise RuntimeError("provider down")

    with TestClient(app) as client:
        headers = _fresh_headers()
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: BrokenAI())

        resp = client.post(
            "/api/v1/ai/bucket-recommendation",
            headers={**headers, "Content-Type": "application/json"},
            json={"interests": ["运动"]},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "fallback"
        assert len(body["recommendations"]) > 0
        assert body["recommendations"][0]["reason"] == "热门推荐"


def test_bucket_recommendation_excludes_joined(monkeypatch) -> None:
    """已加入的条目不应出现在推荐列表中."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        item_id = _first_item_id(client, headers)
        client.post(f"/api/v1/life/bucket/items/{item_id}/join", headers=headers)

        # 让 AI 推荐那个已加入的 id, 期望服务端因 joined 过滤后落到 fallback
        fake = FakeBucketAI(
            {
                "recommendations": [
                    {
                        "item_id": item_id,
                        "reason": "x",
                        "match_score": 80,
                        "priority": "medium",
                    }
                ]
            }
        )
        monkeypatch.setattr(ai_service, "get_ai_provider", lambda: fake)

        resp = client.post(
            "/api/v1/ai/bucket-recommendation",
            headers={**headers, "Content-Type": "application/json"},
            json={"career": "工程师"},
        )
        assert resp.status_code == 200
        body = resp.json()
        # 该 id 在 candidates 阶段已被剔除, AI 推荐该 id 在 parse 阶段找不到 -> 回退
        rec_ids = {r["itemId"] for r in body["recommendations"]}
        assert item_id not in rec_ids


def test_bucket_recommendation_empty_payload() -> None:
    """空请求体也合法, 应返回推荐(走 mock 默认回复 -> fallback)."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        resp = client.post(
            "/api/v1/ai/bucket-recommendation",
            headers={**headers, "Content-Type": "application/json"},
            json={},
        )
        assert resp.status_code == 200
        body = resp.json()
        # mock provider 返回非 JSON -> 解析失败 -> fallback
        assert body["source"] == "fallback"
