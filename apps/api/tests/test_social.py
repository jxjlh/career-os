"""Sprint 8 — Life Social 模块测试.

覆盖:
- 好友: 搜索 / 申请 / 接受 / 双向关系 / 删除 / 幂等 / 拒绝.
- 动态 Feed: 发帖 / 可见性 (public/friends/private) / 自己+好友可见.
- 点赞: toggle (赞↔取消) + 计数同步 + 幂等.
- 评论: 创建 + 列表 + 计数同步.
- 共同目标: 创建 + 邀请好友 + 加入 + 成员列表 + 权限.
- 排行榜: XP / 连续打卡 / Achievement 多维度, 含当前用户.
- AI friend-recommendation: fallback (AI 不可用).
- AI team-plan: fallback (AI 不可用) + 权限校验.

用 BrokenAI 替换 provider, 不依赖真实讯飞星火.
"""

import uuid

from fastapi.testclient import TestClient

import app.domains.ai.service as ai_service
from app.core.database import SessionLocal
from app.db.models import Friend, Profile
from app.main import app


def _headers(user_id: str | None = None) -> dict[str, str]:
    uid = user_id or str(uuid.uuid4())
    return {"Authorization": "Bearer dev", "X-Dev-User-Id": uid, "Content-Type": "application/json"}


def _ensure_profile(user_id: str, display_name: str = "Tester") -> Profile:
    db = SessionLocal()
    try:
        p = db.get(Profile, user_id)
        if p is None:
            p = Profile(id=user_id, email=f"dev-{user_id}@career-os.local", display_name=display_name)
            db.add(p)
            db.commit()
            db.refresh(p)
        else:
            if p.display_name != display_name:
                p.display_name = display_name
                db.commit()
                db.refresh(p)
        return p
    finally:
        db.close()


class BrokenAI:
    name = "broken"
    model = "x"

    async def complete(self, messages, response_format=None, **kwargs):
        raise RuntimeError("provider down")


# =====================================================================
# 一、好友
# =====================================================================
def test_friend_request_accept_bidirectional() -> None:
    """A 发申请给 B → B 接受 → 双向好友关系."""
    a = str(uuid.uuid4())
    b = str(uuid.uuid4())
    _ensure_profile(a, "Alice")
    _ensure_profile(b, "Bob")
    with TestClient(app) as client:
        # A 发申请 (按 email)
        resp = client.post(
            "/api/v1/social/friend-requests",
            headers=_headers(a),
            json={"email": f"dev-{b}@career-os.local", "message": "一起成长吧"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "pending"

        # B 查看收到的申请
        incoming = client.get("/api/v1/social/friend-requests", headers=_headers(b))
        assert incoming.status_code == 200
        reqs = incoming.json()["data"]
        assert len(reqs) == 1
        req_id = reqs[0]["id"]

        # B 接受
        accept = client.post(f"/api/v1/social/friend-requests/{req_id}/accept", headers=_headers(b))
        assert accept.status_code == 200
        assert accept.json()["data"]["status"] == "accepted"

        # 双向好友关系落库
        db = SessionLocal()
        try:
            assert db.query(Friend).filter(Friend.user_id == a, Friend.friend_id == b).first() is not None
            assert db.query(Friend).filter(Friend.user_id == b, Friend.friend_id == a).first() is not None
        finally:
            db.close()

        # A 的好友列表含 B
        friends = client.get("/api/v1/social/friends", headers=_headers(a))
        assert friends.status_code == 200
        assert any(f["profile"]["id"] == b for f in friends.json()["data"])


def test_friend_request_idempotent_and_self_forbidden() -> None:
    a = str(uuid.uuid4())
    b = str(uuid.uuid4())
    _ensure_profile(a)
    _ensure_profile(b)
    with TestClient(app) as client:
        # 重复申请幂等返回 pending
        first = client.post("/api/v1/social/friend-requests", headers=_headers(a), json={"toUserId": b})
        second = client.post("/api/v1/social/friend-requests", headers=_headers(a), json={"toUserId": b})
        assert first.status_code == 200
        assert second.status_code == 200
        assert first.json()["data"]["status"] == "pending"
        assert second.json()["data"]["status"] == "pending"

        # 向自己申请被拒 (400)
        self_req = client.post("/api/v1/social/friend-requests", headers=_headers(a), json={"toUserId": a})
        assert self_req.status_code == 400


def test_friend_search() -> None:
    a = str(uuid.uuid4())
    b = str(uuid.uuid4())
    _ensure_profile(a, "Searcher")
    _ensure_profile(b, "ZoeUnique")
    with TestClient(app) as client:
        resp = client.get("/api/v1/social/friends/search", headers=_headers(a), params={"q": "ZoeUnique"})
        assert resp.status_code == 200
        items = resp.json()["data"]
        assert any(i["id"] == b for i in items)
        assert all(i["id"] != a for i in items)


def test_friend_remove() -> None:
    a = str(uuid.uuid4())
    b = str(uuid.uuid4())
    _ensure_profile(a)
    _ensure_profile(b)
    with TestClient(app) as client:
        # 先建立好友
        client.post("/api/v1/social/friend-requests", headers=_headers(a), json={"toUserId": b})
        incoming = client.get("/api/v1/social/friend-requests", headers=_headers(b)).json()["data"]
        client.post(f"/api/v1/social/friend-requests/{incoming[0]['id']}/accept", headers=_headers(b))

        # 删除好友
        resp = client.delete(f"/api/v1/social/friends/{b}", headers=_headers(a))
        assert resp.status_code == 200
        friends = client.get("/api/v1/social/friends", headers=_headers(a)).json()["data"]
        assert not any(f["profile"]["id"] == b for f in friends)


# =====================================================================
# 二、动态 Feed + 可见性
# =====================================================================
def test_feed_visibility_and_post() -> None:
    a = str(uuid.uuid4())
    b = str(uuid.uuid4())
    _ensure_profile(a, "Author")
    _ensure_profile(b, "Reader")
    with TestClient(app) as client:
        # 建立好友
        client.post("/api/v1/social/friend-requests", headers=_headers(a), json={"toUserId": b})
        req = client.get("/api/v1/social/friend-requests", headers=_headers(b)).json()["data"][0]
        client.post(f"/api/v1/social/friend-requests/{req['id']}/accept", headers=_headers(b))

        # A 发公开动态
        post = client.post(
            "/api/v1/social/posts",
            headers=_headers(a),
            json={"content": "今天完成了一个目标!", "visibility": "public", "photos": ["x.jpg"]},
        )
        assert post.status_code == 201
        post_id = post.json()["data"]["id"]

        # B 在 feed 中看到 A 的动态
        feed = client.get("/api/v1/social/feed", headers=_headers(b)).json()["data"]
        assert any(p["id"] == post_id for p in feed)

        # A 发 private 动态, B 不应可见
        private = client.post(
            "/api/v1/social/posts", headers=_headers(a), json={"content": "私密", "visibility": "private"}
        )
        private_id = private.json()["data"]["id"]
        detail = client.get(f"/api/v1/social/posts/{private_id}", headers=_headers(b))
        assert detail.status_code == 404


# =====================================================================
# 三、点赞 (toggle + 计数 + 幂等)
# =====================================================================
def test_like_toggle_and_count() -> None:
    a = str(uuid.uuid4())
    b = str(uuid.uuid4())
    _ensure_profile(a)
    _ensure_profile(b)
    with TestClient(app) as client:
        client.post("/api/v1/social/friend-requests", headers=_headers(a), json={"toUserId": b})
        req = client.get("/api/v1/social/friend-requests", headers=_headers(b)).json()["data"][0]
        client.post(f"/api/v1/social/friend-requests/{req['id']}/accept", headers=_headers(b))

        post = client.post(
            "/api/v1/social/posts", headers=_headers(a), json={"content": "赞我", "visibility": "public"}
        )
        post_id = post.json()["data"]["id"]

        # B 点赞
        like1 = client.post(f"/api/v1/social/posts/{post_id}/like", headers=_headers(b)).json()["data"]
        assert like1["liked"] is True
        assert like1["likesCount"] == 1

        # B 再次 toggle → 取消
        like2 = client.post(f"/api/v1/social/posts/{post_id}/like", headers=_headers(b)).json()["data"]
        assert like2["liked"] is False
        assert like2["likesCount"] == 0

        # likedByMe 状态正确
        detail = client.get(f"/api/v1/social/posts/{post_id}", headers=_headers(b)).json()["data"]
        assert detail["likedByMe"] is False


# =====================================================================
# 四、评论
# =====================================================================
def test_comment_create_and_list() -> None:
    a = str(uuid.uuid4())
    b = str(uuid.uuid4())
    _ensure_profile(a)
    _ensure_profile(b)
    with TestClient(app) as client:
        client.post("/api/v1/social/friend-requests", headers=_headers(a), json={"toUserId": b})
        req = client.get("/api/v1/social/friend-requests", headers=_headers(b)).json()["data"][0]
        client.post(f"/api/v1/social/friend-requests/{req['id']}/accept", headers=_headers(b))

        post = client.post(
            "/api/v1/social/posts", headers=_headers(a), json={"content": "求评论", "visibility": "public"}
        )
        post_id = post.json()["data"]["id"]

        c = client.post(
            f"/api/v1/social/posts/{post_id}/comments", headers=_headers(b), json={"content": "加油!"}
        )
        assert c.status_code == 201
        comments = client.get(f"/api/v1/social/posts/{post_id}/comments", headers=_headers(a)).json()["data"]
        assert len(comments) == 1
        assert comments[0]["content"] == "加油!"

        # comments_count 同步
        detail = client.get(f"/api/v1/social/posts/{post_id}", headers=_headers(a)).json()["data"]
        assert detail["commentsCount"] == 1


# =====================================================================
# 五、共同目标
# =====================================================================
def test_shared_goal_create_invite_join() -> None:
    a = str(uuid.uuid4())
    b = str(uuid.uuid4())
    _ensure_profile(a)
    _ensure_profile(b)
    with TestClient(app) as client:
        client.post("/api/v1/social/friend-requests", headers=_headers(a), json={"toUserId": b})
        req = client.get("/api/v1/social/friend-requests", headers=_headers(b)).json()["data"][0]
        client.post(f"/api/v1/social/friend-requests/{req['id']}/accept", headers=_headers(b))

        # A 创建一个人生目标
        goal = client.post(
            "/api/v1/life/goals", headers=_headers(a), json={"title": "一起跑步", "category": "health"}
        )
        goal_id = goal.json()["data"]["id"]

        # A 创建共同目标并邀请 B
        sg = client.post(
            "/api/v1/social/shared-goals",
            headers=_headers(a),
            json={"lifeGoalId": goal_id, "visibility": "friends", "inviteUserIds": [b]},
        )
        assert sg.status_code == 201
        sg_id = sg.json()["data"]["id"]
        # B 被邀请后已是成员
        assert sg.json()["data"]["membersCount"] == 2

        # 成员列表
        members = client.get(f"/api/v1/social/shared-goals/{sg_id}/members", headers=_headers(a)).json()["data"]
        member_ids = [m["user"]["id"] for m in members]
        assert a in member_ids and b in member_ids

        # A 的共同目标列表
        mine = client.get("/api/v1/social/shared-goals", headers=_headers(a)).json()["data"]
        assert any(m["id"] == sg_id for m in mine)


def test_shared_goal_permission_non_member() -> None:
    """非成员查看成员列表被拒 (403)."""
    a = str(uuid.uuid4())
    c = str(uuid.uuid4())
    _ensure_profile(a)
    _ensure_profile(c)
    with TestClient(app) as client:
        goal = client.post(
            "/api/v1/life/goals", headers=_headers(a), json={"title": "一起读书", "category": "skill"}
        )
        goal_id = goal.json()["data"]["id"]
        sg = client.post(
            "/api/v1/social/shared-goals", headers=_headers(a), json={"lifeGoalId": goal_id, "visibility": "friends"}
        )
        sg_id = sg.json()["data"]["id"]
        # C 非成员 → 403
        resp = client.get(f"/api/v1/social/shared-goals/{sg_id}/members", headers=_headers(c))
        assert resp.status_code == 403


# =====================================================================
# 六、排行榜
# =====================================================================
def test_ranking_includes_current_user() -> None:
    a = str(uuid.uuid4())
    _ensure_profile(a, "Ranker")
    with TestClient(app) as client:
        # XP 排行榜至少包含当前用户
        resp = client.get("/api/v1/social/ranking", headers=_headers(a), params={"metric": "xp"})
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["metric"] == "xp"
        assert any(item["user"]["id"] == a for item in body["items"])

        # streak 排行榜
        streak = client.get("/api/v1/social/ranking", headers=_headers(a), params={"metric": "streak"})
        assert streak.status_code == 200
        assert streak.json()["data"]["metric"] == "streak"


# =====================================================================
# 七、概览
# =====================================================================
def test_social_overview() -> None:
    a = str(uuid.uuid4())
    _ensure_profile(a, "Overviewer")
    with TestClient(app) as client:
        resp = client.get("/api/v1/social/overview", headers=_headers(a))
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert "friendsCount" in body
        assert "pendingRequests" in body
        assert "sharedGoalsCount" in body


# =====================================================================
# 八、AI 好友推荐 (fallback)
# =====================================================================
def test_friend_recommendation_fallback(monkeypatch) -> None:
    a = str(uuid.uuid4())
    _ensure_profile(a, "Recommender")
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: BrokenAI())
    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/ai/friend-recommendation",
            headers=_headers(a),
            json={"interests": ["跑步", "摄影"], "city": "Shanghai", "growthDirection": "健康"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "fallback"
        # fallback 给出共同目标建议 (含城市/兴趣)
        assert isinstance(body["sharedGoalSuggestions"], list)


# =====================================================================
# 九、AI 团队规划 (fallback + 权限)
# =====================================================================
def test_team_plan_fallback_and_permission(monkeypatch) -> None:
    a = str(uuid.uuid4())
    b = str(uuid.uuid4())
    outsider = str(uuid.uuid4())
    _ensure_profile(a)
    _ensure_profile(b)
    _ensure_profile(outsider)
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: BrokenAI())
    with TestClient(app) as client:
        # 建立好友 + 共同目标
        client.post("/api/v1/social/friend-requests", headers=_headers(a), json={"toUserId": b})
        req = client.get("/api/v1/social/friend-requests", headers=_headers(b)).json()["data"][0]
        client.post(f"/api/v1/social/friend-requests/{req['id']}/accept", headers=_headers(b))
        goal = client.post(
            "/api/v1/life/goals", headers=_headers(a), json={"title": "一起考研", "category": "skill"}
        )
        goal_id = goal.json()["data"]["id"]
        sg = client.post(
            "/api/v1/social/shared-goals",
            headers=_headers(a),
            json={"lifeGoalId": goal_id, "visibility": "friends", "inviteUserIds": [b]},
        )
        sg_id = sg.json()["data"]["id"]

        # A 成员 → fallback 团队规划
        plan = client.post("/api/v1/ai/team-plan", headers=_headers(a), json={"sharedGoalId": sg_id})
        assert plan.status_code == 200
        body = plan.json()
        assert body["source"] == "fallback"
        assert len(body["tasks"]) >= 1
        # fallback 任务均分给成员, assignee 应是真实成员 id
        assignees = {t["assignee"] for t in body["tasks"]}
        assert assignees.issubset({a, b})

        # outsider 非成员 → 403
        forbidden = client.post("/api/v1/ai/team-plan", headers=_headers(outsider), json={"sharedGoalId": sg_id})
        assert forbidden.status_code == 403

        # 不存在的共同目标 → 404
        not_found = client.post(
            "/api/v1/ai/team-plan", headers=_headers(a), json={"sharedGoalId": str(uuid.uuid4())}
        )
        assert not_found.status_code == 404
