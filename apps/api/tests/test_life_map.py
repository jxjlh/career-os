"""GET /life/map: 聚合统一 markers (Record/Goal/Bucket/Visit) + 统计 + 详情 + 过滤.

覆盖: marker 聚合与着色、城市聚合、过滤(年份/国家/城市)、统计(城市/国家/公里/Bucket/XP)、
marker 详情、用户隔离、空地图(仅种子 Bucket).

测试隔离: 每个用例生成全新 X-Dev-User-Id, 保证零历史记录/目标. Bucket 种子为全局目录数据,
所有用户共享(未加入=灰色 pending), 属预期行为.
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app


def _fresh_headers() -> dict[str, str]:
    return {"Authorization": "Bearer dev", "X-Dev-User-Id": str(uuid.uuid4())}


def _create_goal(client, headers, **extra) -> str:
    payload = {"title": "环游日本", "category": "travel"}
    payload.update(extra)
    resp = client.post(
        "/api/v1/life/goals", headers={**headers, "Content-Type": "application/json"}, json=payload
    )
    return resp.json()["data"]["id"]


def _create_record(client, goal_id, headers, **fields) -> str:
    data = {"record_type": "text"}
    data.update(fields)
    resp = client.post(f"/api/v1/life/goals/{goal_id}/records", headers=headers, data=data)
    return resp.json()["data"]["id"]


def _record_markers(markers) -> list:
    return [m for m in markers if m["sourceType"] == "record"]


def _goal_markers(markers) -> list:
    return [m for m in markers if m["sourceType"] == "goal"]


def test_life_map_aggregates_markers_from_records_and_goals() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal_id = _create_goal(
            client, headers, location="东京", latitude=35.68, longitude=139.69
        )
        _create_record(client, goal_id, headers, content="东京塔夜景", latitude=35.66, longitude=139.74, city="Tokyo", country="Japan")
        _create_record(client, goal_id, headers, content="浅草寺祈福", latitude=35.71, longitude=139.79, city="Tokyo", country="Japan")
        _create_record(client, goal_id, headers, content="伏见稻荷", latitude=34.97, longitude=135.77, city="Kyoto", country="Japan")
        # 无坐标记录不应出现在地图
        _create_record(client, goal_id, headers, content="某处记录", city="拉萨")
        # 无坐标目标不作为目的地
        _create_goal(client, headers, title="读书目标", category="skill")

        resp = client.get("/api/v1/life/map", headers=headers)
        assert resp.status_code == 200
        body = resp.json()["data"]
        markers = body["markers"]

        # 3 条带坐标 record markers + 1 条带坐标 goal marker
        rec_markers = _record_markers(markers)
        assert len(rec_markers) == 3
        goal_markers = _goal_markers(markers)
        assert len(goal_markers) == 1
        assert goal_markers[0]["title"] == "环游日本"
        assert goal_markers[0]["latitude"] == 35.68

        # record marker 状态为 completed (绿色)
        assert all(m["status"] == "completed" for m in rec_markers)
        # 无坐标记录被过滤
        assert all(m.get("city") != "拉萨" for m in rec_markers)

        # 城市聚合: Tokyo(2) > Kyoto(1)
        cities = body["cities"]
        tokyo = next(c for c in cities if c["city"] == "Tokyo")
        assert tokyo["markerCount"] == 2
        kyoto = next(c for c in cities if c["city"] == "Kyoto")
        assert kyoto["markerCount"] == 1


def test_life_map_user_isolation() -> None:
    with TestClient(app) as client:
        owner = _fresh_headers()
        other = _fresh_headers()
        goal_id = _create_goal(client, owner, latitude=35.68, longitude=139.69)
        _create_record(client, goal_id, owner, content="我的东京", latitude=35.7, longitude=139.7, city="Tokyo", country="Japan")

        other_resp = client.get("/api/v1/life/map", headers=other)
        assert other_resp.status_code == 200
        other_markers = other_resp.json()["data"]["markers"]
        # 其他用户看不到我的 record/goal markers (仅共享 Bucket 目录)
        assert _record_markers(other_markers) == []
        assert _goal_markers(other_markers) == []
        assert all(m["sourceType"] == "bucket" for m in other_markers)


def test_life_map_empty_only_bucket_seed() -> None:
    """新用户地图: 无个人记录/目标, 仅有种子 Bucket 目录(灰色 pending)."""
    with TestClient(app) as client:
        headers = _fresh_headers()
        resp = client.get("/api/v1/life/map", headers=headers)
        assert resp.status_code == 200
        markers = resp.json()["data"]["markers"]
        # 全部来自 bucket 种子, 无 record/goal/visit
        assert _record_markers(markers) == []
        assert _goal_markers(markers) == []
        assert all(m["sourceType"] == "bucket" for m in markers)
        # 未加入的 bucket = pending (灰色)
        assert all(m["status"] == "pending" for m in markers)


def test_life_map_filter_by_country_and_city() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal_id = _create_goal(client, headers, latitude=35.68, longitude=139.69)
        _create_record(client, goal_id, headers, content="东京", latitude=35.66, longitude=139.74, city="Tokyo", country="Japan")
        _create_record(client, goal_id, headers, content="巴黎", latitude=48.85, longitude=2.35, city="Paris", country="France")

        # 按国家过滤 Japan
        resp = client.get("/api/v1/life/map", headers=headers, params={"country": "Japan"})
        recs = _record_markers(resp.json()["data"]["markers"])
        assert all(m["country"] == "Japan" for m in recs)
        assert len(recs) == 1

        # 按城市过滤 Paris
        resp2 = client.get("/api/v1/life/map", headers=headers, params={"city": "Paris"})
        recs2 = _record_markers(resp2.json()["data"]["markers"])
        assert all(m["city"] == "Paris" for m in recs2)
        assert len(recs2) == 1


def test_life_map_statistics() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal_id = _create_goal(client, headers, latitude=35.68, longitude=139.69)
        _create_record(client, goal_id, headers, content="东京", latitude=35.66, longitude=139.74, city="Tokyo", country="Japan")
        _create_record(client, goal_id, headers, content="京都", latitude=34.97, longitude=135.77, city="Kyoto", country="Japan")

        resp = client.get("/api/v1/life/map/statistics", headers=headers)
        assert resp.status_code == 200
        stats = resp.json()["data"]

        assert stats["totalCities"] >= 2  # Tokyo + Kyoto (+ bucket seed cities)
        assert stats["totalCountries"] >= 1  # Japan (+ bucket seed countries)
        assert stats["totalRecords"] == 2
        assert stats["totalGoals"] == 1
        assert stats["totalDistance"] > 0  # 东京→京都 有距离
        assert stats["experience"] >= 0
        assert stats["level"] >= 1
        assert stats["bucketCompleted"] >= 0


def test_life_map_detail_record() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal_id = _create_goal(client, headers, latitude=35.68, longitude=139.69)
        record_id = _create_record(client, goal_id, headers, content="东京塔", latitude=35.66, longitude=139.74, city="Tokyo", country="Japan")

        resp = client.get(f"/api/v1/life/map/record-{record_id}", headers=headers)
        assert resp.status_code == 200
        detail = resp.json()["data"]
        assert detail["markerType"] == "record"
        assert detail["id"] == record_id
        assert detail["city"] == "Tokyo"


def test_life_map_detail_goal() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal_id = _create_goal(client, headers, latitude=35.68, longitude=139.69)

        resp = client.get(f"/api/v1/life/map/goal-{goal_id}", headers=headers)
        assert resp.status_code == 200
        detail = resp.json()["data"]
        assert detail["markerType"] == "goal"
        assert detail["id"] == goal_id
        assert detail["title"] == "环游日本"


def test_life_map_detail_not_found() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        resp = client.get("/api/v1/life/map/record-nonexistent", headers=headers)
        assert resp.status_code == 404


def test_life_map_detail_permission_isolation() -> None:
    """用户 A 的 record marker, 用户 B 查详情应 404."""
    with TestClient(app) as client:
        owner = _fresh_headers()
        other = _fresh_headers()
        goal_id = _create_goal(client, owner, latitude=35.68, longitude=139.69)
        record_id = _create_record(client, goal_id, owner, content="我的", latitude=35.7, longitude=139.7)

        resp = client.get(f"/api/v1/life/map/record-{record_id}", headers=other)
        assert resp.status_code == 404
