"""每日小记多时段保存回归测试。

线上曾因 daily_journals 缺 time_slot 列导致保存小记 500；
这里验证同一天多个子时段可以正常创建与读取。
"""

from fastapi.testclient import TestClient

from app.main import app


def test_journal_multiple_slots_same_day() -> None:
    with TestClient(app) as client:
        headers = {"Authorization": "Bearer dev"}

        first = client.post(
            "/api/v1/journal",
            json={
                "mood_index": 3,
                "content": "早上好",
                "time_slot": "morning_06",
                "journal_date": "2026-08-08",
            },
            headers=headers,
        )
        assert first.status_code == 200
        assert first.json()["data"]["timeSlot"] == "morning_06"

        second = client.post(
            "/api/v1/journal",
            json={
                "mood_index": 4,
                "content": "上午好",
                "time_slot": "morning_08",
                "journal_date": "2026-08-08",
            },
            headers=headers,
        )
        assert second.status_code == 200
        assert second.json()["data"]["timeSlot"] == "morning_08"

        listed = client.get("/api/v1/journal/2026-08-08", headers=headers)
        assert listed.status_code == 200
        slots = [item["timeSlot"] for item in listed.json()["data"]]
        assert slots == ["morning_06", "morning_08"]
