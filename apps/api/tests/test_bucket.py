"""Bucket List 模块测试.

覆盖: 目录查询/搜索/筛选/排序, 加入人生目标(join), 权限隔离, 收藏/心愿/完成,
完成联动 LifeGoal + XP, 进度统计. 测试用 X-Dev-User-Id 隔离用户.
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app


def _fresh_headers() -> dict[str, str]:
    return {"Authorization": "Bearer dev", "X-Dev-User-Id": str(uuid.uuid4())}


def _json(headers):
    return {**headers, "Content-Type": "application/json"}


def test_list_categories_seeded() -> None:
    """种子数据在 lifespan 写入, 分类接口返回 12 大类."""
    with TestClient(app) as client:
        resp = client.get("/api/v1/life/bucket/categories", headers=_fresh_headers())
        assert resp.status_code == 200
        cats = resp.json()["data"]
        assert len(cats) >= 12
        names = {c["name"] for c in cats}
        assert {"旅行", "挑战", "成长", "运动"} <= names
        # 每个分类带 itemCount
        for c in cats:
            assert c["itemCount"] >= 0


def test_list_items_search_and_filter() -> None:
    """搜索 + 分类筛选 + 分页."""
    with TestClient(app) as client:
        # 搜索 "极光"
        resp = client.get(
            "/api/v1/life/bucket/items",
            headers=_fresh_headers(),
            params={"q": "极光"},
        )
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["total"] >= 1
        assert "极光" in body["items"][0]["title"]

        # 分页 page_size=1
        resp2 = client.get(
            "/api/v1/life/bucket/items",
            headers=_fresh_headers(),
            params={"page_size": 1, "sort": "popular"},
        )
        body2 = resp2.json()["data"]
        assert len(body2["items"]) == 1
        assert body2["pageSize"] == 1


def test_get_item_detail() -> None:
    with TestClient(app) as client:
        listing = client.get(
            "/api/v1/life/bucket/items", headers=_fresh_headers(), params={"page_size": 5}
        ).json()["data"]
        item_id = listing["items"][0]["id"]

        resp = client.get(f"/api/v1/life/bucket/items/{item_id}", headers=_fresh_headers())
        assert resp.status_code == 200
        item = resp.json()["data"]
        assert item["id"] == item_id
        assert item["userState"] is None  # 未加入


def test_get_item_not_found() -> None:
    with TestClient(app) as client:
        resp = client.get(
            "/api/v1/life/bucket/items/does-not-exist", headers=_fresh_headers()
        )
        assert resp.status_code == 404


def test_join_creates_life_goal_and_links() -> None:
    """加入清单 -> 自动创建 LifeGoal + UserBucketItem, 二者关联."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        listing = client.get(
            "/api/v1/life/bucket/items", headers=headers, params={"page_size": 5}
        ).json()["data"]
        item_id = listing["items"][0]["id"]

        join = client.post(f"/api/v1/life/bucket/items/{item_id}/join", headers=headers)
        assert join.status_code == 201
        data = join.json()["data"]
        assert data["lifeGoalId"]
        assert data["bucketItemId"] == item_id

        # 再次查询该条目, userState 已 joined
        detail = client.get(f"/api/v1/life/bucket/items/{item_id}", headers=headers).json()["data"]
        assert detail["userState"]["joined"] is True
        assert detail["userState"]["lifeGoalId"] == data["lifeGoalId"]

        # LifeGoal 真实存在
        goal = client.get(f"/api/v1/life/goals/{data['lifeGoalId']}", headers=headers).json()["data"]
        assert goal["status"] == "pending"


def test_join_idempotent_409() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        listing = client.get(
            "/api/v1/life/bucket/items", headers=headers, params={"page_size": 5}
        ).json()["data"]
        item_id = listing["items"][0]["id"]

        first = client.post(f"/api/v1/life/bucket/items/{item_id}/join", headers=headers)
        assert first.status_code == 201
        second = client.post(f"/api/v1/life/bucket/items/{item_id}/join", headers=headers)
        assert second.status_code == 409


def test_join_permission_isolation() -> None:
    """用户 A 加入的条目, 用户 B 看到的 userState 仍为 None."""
    with TestClient(app) as client:
        owner = _fresh_headers()
        other = _fresh_headers()
        listing = client.get(
            "/api/v1/life/bucket/items", headers=owner, params={"page_size": 5}
        ).json()["data"]
        item_id = listing["items"][0]["id"]

        client.post(f"/api/v1/life/bucket/items/{item_id}/join", headers=owner)

        other_detail = client.get(
            f"/api/v1/life/bucket/items/{item_id}", headers=other
        ).json()["data"]
        assert other_detail["userState"] is None


def test_favorite_and_wishlist_toggle() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        listing = client.get(
            "/api/v1/life/bucket/items", headers=headers, params={"page_size": 5}
        ).json()["data"]
        item_id = listing["items"][0]["id"]
        client.post(f"/api/v1/life/bucket/items/{item_id}/join", headers=headers)

        fav = client.post(f"/api/v1/life/bucket/items/{item_id}/favorite", headers=headers).json()["data"]
        assert fav["favorite"] is True
        fav2 = client.post(f"/api/v1/life/bucket/items/{item_id}/favorite", headers=headers).json()["data"]
        assert fav2["favorite"] is False

        wish = client.post(f"/api/v1/life/bucket/items/{item_id}/wishlist", headers=headers).json()["data"]
        assert wish["wishlist"] is True


def test_complete_drives_life_goal_to_completed_and_xp() -> None:
    """完成 bucket item -> 关联 LifeGoal 走 pending->in_progress->completed, 且发放 XP."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        listing = client.get(
            "/api/v1/life/bucket/items", headers=headers, params={"page_size": 5}
        ).json()["data"]
        item_id = listing["items"][0]["id"]
        join = client.post(f"/api/v1/life/bucket/items/{item_id}/join", headers=headers).json()["data"]
        goal_id = join["lifeGoalId"]

        # 完成前 XP
        before = client.get("/api/v1/life/dashboard", headers=headers).json()["data"]["experience"]

        complete = client.post(f"/api/v1/life/bucket/items/{item_id}/complete", headers=headers)
        assert complete.status_code == 200
        assert complete.json()["data"]["completed"] is True

        # LifeGoal 已 completed
        goal = client.get(f"/api/v1/life/goals/{goal_id}", headers=headers).json()["data"]
        assert goal["status"] == "completed"

        # XP 增长
        after = client.get("/api/v1/life/dashboard", headers=headers).json()["data"]["experience"]
        assert after > before


def test_progress_stats() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        listing = client.get(
            "/api/v1/life/bucket/items", headers=headers, params={"page_size": 3}
        ).json()["data"]
        item_id = listing["items"][0]["id"]
        client.post(f"/api/v1/life/bucket/items/{item_id}/join", headers=headers)

        progress = client.get("/api/v1/life/bucket/progress", headers=headers).json()["data"]
        assert progress["joinedCount"] == 1
        assert progress["completedCount"] == 0
        assert progress["totalCatalog"] >= 1
        assert progress["aspirationalTotal"] == 500
        assert progress["level"] >= 1


def test_unjoin() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        listing = client.get(
            "/api/v1/life/bucket/items", headers=headers, params={"page_size": 3}
        ).json()["data"]
        item_id = listing["items"][0]["id"]
        client.post(f"/api/v1/life/bucket/items/{item_id}/join", headers=headers)

        unjoin = client.delete(f"/api/v1/life/bucket/items/{item_id}/join", headers=headers)
        assert unjoin.status_code == 204

        detail = client.get(f"/api/v1/life/bucket/items/{item_id}", headers=headers).json()["data"]
        assert detail["userState"] is None
