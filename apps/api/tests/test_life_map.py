"""GET /life/map: 聚合带经纬度的人生记录与目标目的地.

覆盖: 仅返回带坐标记录、城市聚合 recordCount、目标目的地筛选、汇总统计、用户隔离.

测试隔离: 测试库为持久化 SQLite 文件, 带坐标记录会跨用例/跨运行累积. 每个用例在运行时
生成一个全新 UUID 作为 X-Dev-User-Id (get_current_user 会按需自动创建 Profile),
保证该用户此前无任何记录与目标, 从而与其它测试文件及历史运行完全隔离.
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app


def _fresh_headers() -> dict[str, str]:
    """每次调用返回一个全新用户的请求头, 确保零历史数据."""
    return {"Authorization": "Bearer dev", "X-Dev-User-Id": str(uuid.uuid4())}


def _create_goal(client, headers, **extra) -> str:
    payload = {"title": "环游日本", "category": "travel"}
    payload.update(extra)
    resp = client.post("/api/v1/life/goals", headers={**headers, "Content-Type": "application/json"}, json=payload)
    return resp.json()["data"]["id"]


def _create_record(client, goal_id, headers, **fields) -> str:
    data = {"record_type": "text"}
    data.update(fields)
    resp = client.post(f"/api/v1/life/goals/{goal_id}/records", headers=headers, data=data)
    return resp.json()["data"]["id"]


def test_life_map_aggregates_geotagged_records_and_destinations() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        goal_id = _create_goal(
            client,
            headers,
            location="东京",
            latitude=35.68,
            longitude=139.69,
        )
        # 东京 2 条带坐标
        _create_record(client, goal_id, headers, content="东京塔夜景", latitude=35.66, longitude=139.74, city="Tokyo", country="Japan")
        _create_record(client, goal_id, headers, content="浅草寺祈福", latitude=35.71, longitude=139.79, city="Tokyo", country="Japan")
        # 京都 1 条带坐标
        _create_record(client, goal_id, headers, content="伏见稻荷", latitude=34.97, longitude=135.77, city="Kyoto", country="Japan")
        # 无坐标记录: 不应出现在地图
        _create_record(client, goal_id, headers, content="某处记录", city="拉萨")
        # 另一个无坐标目标: 不应作为目的地
        _create_goal(client, headers, title="读书目标", category="skill")

        resp = client.get("/api/v1/life/map", headers=headers)
        assert resp.status_code == 200
        body = resp.json()["data"]

        # 仅 3 条带坐标记录
        assert body["summary"]["totalRecords"] == 3
        # 2 个城市
        assert body["summary"]["totalCities"] == 2
        # 1 个国家
        assert body["summary"]["totalCountries"] == 1
        # 1 个带坐标目标目的地
        assert body["summary"]["totalDestinations"] == 1

        # 城市按 recordCount 降序: Tokyo(2) 在前
        cities = body["cities"]
        assert cities[0]["city"] == "Tokyo"
        assert cities[0]["recordCount"] == 2
        assert cities[1]["city"] == "Kyoto"
        assert cities[1]["recordCount"] == 1
        # 城市携带坐标与最新记录信息
        assert cities[0]["latitude"] is not None
        assert cities[0]["latestRecordId"] is not None

        # 记录均带坐标, 无坐标记录被过滤
        for record in body["records"]:
            assert record["latitude"] is not None
            assert record["longitude"] is not None
        assert all(r.get("city") != "拉萨" for r in body["records"])

        # 目的地为目标 A
        assert body["destinations"][0]["title"] == "环游日本"
        assert body["destinations"][0]["latitude"] == 35.68


def test_life_map_user_isolation() -> None:
    with TestClient(app) as client:
        owner_headers = _fresh_headers()
        other_headers = _fresh_headers()
        goal_id = _create_goal(client, owner_headers, latitude=35.68, longitude=139.69)
        _create_record(client, goal_id, owner_headers, content="我的东京", latitude=35.7, longitude=139.7, city="Tokyo", country="Japan")

        # 其他用户看到的是自己的(空)地图, 不应包含我的记录/目的地
        other = client.get("/api/v1/life/map", headers=other_headers)
        assert other.status_code == 200
        other_body = other.json()["data"]
        assert other_body["summary"]["totalRecords"] == 0
        assert other_body["summary"]["totalDestinations"] == 0
        assert other_body["records"] == []
        assert other_body["destinations"] == []


def test_life_map_empty() -> None:
    with TestClient(app) as client:
        headers = _fresh_headers()
        resp = client.get("/api/v1/life/map", headers=headers)
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["summary"] == {
            "totalRecords": 0,
            "totalCities": 0,
            "totalCountries": 0,
            "totalDestinations": 0,
        }
        assert body["cities"] == []
        assert body["records"] == []
        assert body["destinations"] == []
