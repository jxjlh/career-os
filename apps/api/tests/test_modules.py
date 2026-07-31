import time
import uuid

from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Authorization": "Bearer dev", "Content-Type": "application/json"}


def client() -> TestClient:
    return TestClient(app)


def test_onboarding_flow() -> None:
    suffix = uuid.uuid4().hex[:8]
    with client() as c:
        status = c.get("/api/v1/onboarding/status", headers=HEADERS)
        assert status.status_code == 200
        resp = c.post(
            "/api/v1/onboarding",
            headers=HEADERS,
            json={
                "current_title": "Marketing Specialist",
                "target_title": f"Growth Manager {suffix}",
                "target_salary": 400000,
                "weekly_study_minutes": 420,
                "skills": [{"name": "SQL", "current_level": 3, "target_level": 7}],
            },
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["profile"]["onboardingCompleted"] is True
        assert resp.json()["data"]["jobId"]


def test_skills_matrix_and_progress() -> None:
    with client() as c:
        matrix = c.get("/api/v1/skills/matrix", headers=HEADERS)
        assert matrix.status_code == 200
        items = matrix.json()["data"]["items"]
        assert len(items) > 0
        skill_id = items[0]["skillId"]
        resp = c.put(
            f"/api/v1/skills/{skill_id}/progress",
            headers=HEADERS,
            json={"currentLevel": 4, "targetLevel": 7, "confidence": 50},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["currentLevel"] == 4


def test_planner_generate() -> None:
    with client() as c:
        resp = c.post(
            "/api/v1/planner/generate",
            headers=HEADERS,
            json={"weeklyStudyMinutes": 420},
        )
        assert resp.status_code == 200
        tasks = resp.json()["data"]["tasks"]
        assert len(tasks) == 7
        assert tasks[0]["day"] == 1


def test_roadmap_generate() -> None:
    with client() as c:
        created = c.post(
            "/api/v1/roadmaps",
            headers=HEADERS,
            json={"title": "Test Roadmap", "horizonYears": 5},
        )
        roadmap_id = created.json()["data"]["id"]
        generated = c.post(f"/api/v1/roadmaps/{roadmap_id}/generate", headers=HEADERS)
        assert generated.status_code == 200
        assert len(generated.json()["data"]["milestones"]) == 5


def test_job_analysis() -> None:
    with client() as c:
        created = c.post(
            "/api/v1/jobs",
            headers=HEADERS,
            json={"title": "Data Analyst", "jd_raw": "SQL, Power BI, Python required"},
        )
        job_id = created.json()["data"]["id"]
        analyzed = c.post(f"/api/v1/jobs/{job_id}/analyze", headers=HEADERS)
        assert analyzed.status_code == 201
        body = analyzed.json()["data"]
        assert body["skillGaps"]
        assert body["matchScore"] is not None


def test_interview_flow() -> None:
    with client() as c:
        created = c.post(
            "/api/v1/interviews",
            headers=HEADERS,
            json={"title": "Mock Interview", "mode": "star", "role": "Growth Manager"},
        )
        interview_id = created.json()["data"]["id"]
        session = c.post(
            f"/api/v1/interviews/{interview_id}/sessions",
            headers=HEADERS,
            json={"questionCount": 3},
        )
        session_id = session.json()["data"]["sessionId"]
        question_id = session.json()["data"]["questions"][0]["id"]
        answer = c.post(
            f"/api/v1/sessions/{session_id}/answer",
            headers=HEADERS,
            json={"questionId": question_id, "answerText": "STAR answer"},
        )
        assert answer.status_code == 200
        finished = c.post(f"/api/v1/sessions/{session_id}/finish", headers=HEADERS)
        assert finished.status_code == 200
        feedback = c.get(f"/api/v1/sessions/{session_id}/feedback", headers=HEADERS)
        assert feedback.status_code == 200
        assert feedback.json()["data"]["overallScore"] > 0


def test_resume_flow() -> None:
    with client() as c:
        created = c.post("/api/v1/resumes", headers=HEADERS, json={"title": "My Resume"})
        resume_id = created.json()["data"]["id"]
        generated = c.post(
            f"/api/v1/resumes/{resume_id}/generate",
            headers=HEADERS,
            json={"language": "zh"},
        )
        assert generated.status_code == 201
        assert generated.json()["data"]["sections"]["skills"]
        exported = c.post(
            f"/api/v1/resumes/{resume_id}/export",
            headers=HEADERS,
            json={"format": "pdf"},
        )
        assert exported.status_code == 202
        downloads = c.get("/api/v1/downloads", headers=HEADERS)
        assert downloads.status_code == 200


def test_coach_flow() -> None:
    with client() as c:
        chat = c.post("/api/v1/coach/chats", headers=HEADERS, json={"title": "Coach Test"})
        chat_id = chat.json()["data"]["id"]
        message = c.post(
            f"/api/v1/coach/chats/{chat_id}/messages",
            headers=HEADERS,
            json={"content": "下一步学什么？"},
        )
        assert message.status_code == 201
        assert message.json()["data"]["assistantMessage"]["content"]
        messages = c.get(f"/api/v1/coach/chats/{chat_id}/messages", headers=HEADERS)
        assert len(messages.json()["data"]) == 2


def test_explorer_search_job() -> None:
    with client() as c:
        resp = c.post(
            "/api/v1/explore/search",
            headers=HEADERS,
            json={"query": "Power BI", "limit": 3},
        )
        assert resp.status_code == 202
        job_id = resp.json()["data"]["jobId"]
        result = None
        for _ in range(20):
            time.sleep(0.2)
            result = c.get(f"/api/v1/explore/jobs/{job_id}", headers=HEADERS).json()["data"]
            if result["status"] in ("succeeded", "failed"):
                break
        assert result is not None
        assert result["status"] == "succeeded"
        assert result["result"]["items"]
