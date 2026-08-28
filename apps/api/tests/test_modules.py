import time
import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.domains.explorer.router import _select_search_providers
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
        assert resp.json()["data"]["masteryPercent"] == 40
        assert resp.json()["data"]["targetProgressPercent"] == 57.1


def test_extract_skills_returns_structured_error_when_ai_provider_fails(monkeypatch) -> None:
    class FailingProvider:
        async def complete(self, *_args, **_kwargs):
            raise RuntimeError("JD provider unavailable")

    monkeypatch.setattr(
        "app.domains.skills.router.ai_registry.get_jd_ai_providers",
        lambda: [FailingProvider()],
    )

    with client() as c:
        response = c.post(
            "/api/v1/skills/from-jd",
            headers=HEADERS,
            json={"jd": "负责数据分析和报表建设，要求熟悉 SQL、Python 以及 Power BI 工具。"},
        )

    assert response.status_code == 200
    assert response.json()["data"] == {
        "skills": [],
        "provider": "error",
        "error": "AI 服务暂不可用，请稍后重试。",
    }


def test_extract_skills_falls_back_when_primary_provider_is_unauthorized(monkeypatch) -> None:
    class UnauthorizedProvider:
        name = "openai"

        async def complete(self, *_args, **_kwargs):
            raise RuntimeError("401 Unauthorized from upstream")

    class WorkingProvider:
        name = "xfyun_spark"

        async def complete(self, *_args, **_kwargs):
            return '{"skills":[{"name":"SQL","category":"数据库","suggestedLevel":5,"reason":"用于数据分析"}]}'

    monkeypatch.setattr(
        "app.domains.skills.router.ai_registry.get_jd_ai_providers",
        lambda: [UnauthorizedProvider(), WorkingProvider()],
    )

    with client() as c:
        response = c.post(
            "/api/v1/skills/from-jd",
            headers=HEADERS,
            json={"jd": "负责数据分析和报表建设，要求熟悉 SQL、Python 以及 Power BI 工具。"},
        )

    assert response.status_code == 200
    assert response.json()["data"]["provider"] == "xfyun_spark"
    assert response.json()["data"]["skills"][0]["name"] == "SQL"


def test_skill_categories_detail_and_knowledge() -> None:
    skill_name = f"分类详情技能-{uuid.uuid4().hex[:8]}"
    with client() as c:
        created = c.post(
            "/api/v1/skills",
            headers=HEADERS,
            json={"name": skill_name, "category": "学习", "currentLevel": 2, "targetLevel": 8},
        )
        assert created.status_code == 201
        skill_id = created.json()["data"]["skillId"]
        assert created.json()["data"]["learningStatus"] == "learning"

        moved = c.patch(
            f"/api/v1/skills/{skill_id}",
            headers=HEADERS,
            json={"learningStatus": "mastered"},
        )
        assert moved.status_code == 200
        assert moved.json()["data"]["learningStatus"] == "mastered"
        assert moved.json()["data"]["currentLevel"] == 2

        detail = c.get(f"/api/v1/skills/{skill_id}/detail", headers=HEADERS)
        assert detail.status_code == 200
        assert detail.json()["data"]["skill"]["skillId"] == skill_id
        assert "planStats" in detail.json()["data"]

        knowledge = c.post(f"/api/v1/skills/{skill_id}/knowledge", headers=HEADERS)
        assert knowledge.status_code == 200
        assert knowledge.json()["data"]["knowledgePoints"]

        resource_job = c.post(
            f"/api/v1/skills/{skill_id}/resources",
            headers=HEADERS,
            json={"query": "入门", "limit": 5},
        )
        assert resource_job.status_code == 202
        assert resource_job.json()["data"]["provider"] == "bilibili"

        task = c.post(
            "/api/v1/planner/tasks",
            headers=HEADERS,
            json={"title": "完成技能练习", "day": 2, "estimatedMinutes": 45, "skillId": skill_id},
        )
        assert task.status_code == 201
        assert task.json()["data"]["skillId"] == skill_id

        detail_after_task = c.get(f"/api/v1/skills/{skill_id}/detail", headers=HEADERS)
        assert detail_after_task.status_code == 200
        assert any(item["id"] == task.json()["data"]["id"] for item in detail_after_task.json()["data"]["tasks"])


def test_skill_resources_only_select_bilibili_provider(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.domains.explorer.router.get_search_providers",
        lambda: [SimpleNamespace(name="bilibili"), SimpleNamespace(name="mock")],
    )
    providers = _select_search_providers(["bilibili"])
    assert [provider.name for provider in providers] == ["bilibili"]


def test_english_books_use_complete_relation_data() -> None:
    with client() as c:
        books = c.get("/api/v1/english/books", headers=HEADERS)
        assert books.status_code == 200
        cet4 = next(book for book in books.json()["data"] if book["code"] == "cet4")
        assert cet4["totalWords"] == 8806

        page = c.get(
            f"/api/v1/english/books/{cet4['id']}/words?offset=5000&limit=100",
            headers=HEADERS,
        )
        assert page.status_code == 200
        assert len(page.json()["data"]) == 100
        assert all(word["spelling"] and word["meaning"] for word in page.json()["data"])


def test_reading_book_progress_and_plan() -> None:
    with client() as c:
        created = c.post(
            "/api/v1/library/reading/books",
            headers=HEADERS,
            json={
                "title": f"测试阅读-{uuid.uuid4().hex[:8]}",
                "author": "测试作者",
                "totalPages": 300,
                "targetDate": "2026-09-01",
                "dailyMinutes": 30,
                "planNote": "每天读一章",
                "isComplete": True,
            },
        )
        assert created.status_code == 201
        book_id = created.json()["data"]["id"]
        assert created.json()["data"]["status"] == "want"

        updated = c.patch(
            f"/api/v1/library/reading/books/{book_id}",
            headers=HEADERS,
            json={"currentPage": 75},
        )
        assert updated.status_code == 200
        assert updated.json()["data"]["status"] == "reading"
        assert updated.json()["data"]["progressPercent"] == 25

        listing = c.get("/api/v1/library/reading/books?status=reading", headers=HEADERS)
        assert listing.status_code == 200
        assert any(item["id"] == book_id for item in listing.json()["data"])

        generated = c.post(
            "/api/v1/planner/generate",
            headers=HEADERS,
            json={"weeklyStudyMinutes": 420, "prioritySkills": []},
        )
        assert generated.status_code == 200
        reading_tasks = [task for task in generated.json()["data"]["tasks"] if task["taskType"] == "reading"]
        assert any(task["title"] == f"阅读《{created.json()['data']['title']}》" for task in reading_tasks)

        deleted = c.delete(f"/api/v1/library/reading/books/{book_id}", headers=HEADERS)
        assert deleted.status_code == 204


def test_skill_recommendations_endpoint() -> None:
    with client() as c:
        matrix = c.get("/api/v1/skills/matrix", headers=HEADERS)
        skill_id = matrix.json()["data"]["items"][0]["skillId"]
        response = c.post(
            f"/api/v1/skills/{skill_id}/recommendations",
            headers=HEADERS,
            json={"currentSituation": "刚入门，希望完成一个实战项目", "weeklyMinutes": 420},
        )
        assert response.status_code == 200
        body = response.json()["data"]
        assert body["resources"]
        assert len(body["plan"]) == 7
        assert body["assessment"]


def test_skill_plan_generation_persists_tasks_for_selected_skill() -> None:
    with client() as c:
        matrix = c.get("/api/v1/skills/matrix", headers=HEADERS)
        skill_id = matrix.json()["data"]["items"][0]["skillId"]
        response = c.post(
            f"/api/v1/skills/{skill_id}/plan",
            headers=HEADERS,
            json={"weeklyMinutes": 420},
        )
        assert response.status_code == 200
        body = response.json()["data"]
        assert body["skillId"] == skill_id
        assert len(body["tasks"]) == 7
        assert all(task["skillId"] == skill_id for task in body["tasks"])


def test_custom_skill_crud_and_career_assessment() -> None:
    skill_name = f"自定义技能-{uuid.uuid4().hex[:8]}"
    with client() as c:
        created = c.post(
            "/api/v1/skills",
            headers=HEADERS,
            json={"name": skill_name, "category": "实战", "currentLevel": 2, "targetLevel": 8},
        )
        assert created.status_code == 201
        skill_id = created.json()["data"]["skillId"]
        assert created.json()["data"]["targetLevel"] == 8

        updated = c.patch(f"/api/v1/skills/{skill_id}", headers=HEADERS, json={"name": f"{skill_name}-改名"})
        assert updated.status_code == 200
        assert updated.json()["data"]["name"].endswith("-改名")

        questions = c.post(
            "/api/v1/career/assessment",
            headers=HEADERS,
            json={"topic": skill_name, "level": "入门"},
        )
        assert questions.status_code == 200
        assert len(questions.json()["data"]["questions"]) == 5

        scored = c.post(
            "/api/v1/career/assessment",
            headers=HEADERS,
            json={
                "topic": skill_name,
                "answers": [{"question": "如何应用？", "answer": "我会结合项目拆解步骤并验证结果。"}],
            },
        )
        assert scored.status_code == 200
        assert 0 <= scored.json()["data"]["score"] <= 100

        deleted = c.delete(f"/api/v1/skills/{skill_id}", headers=HEADERS)
        assert deleted.status_code == 204


def test_planner_generate() -> None:
    with client() as c:
        resp = c.post(
            "/api/v1/planner/generate",
            headers=HEADERS,
            json={"weeklyStudyMinutes": 420},
        )
        assert resp.status_code == 200
        body = resp.json()["data"]
        # AI 生成的周计划应包含寄语/rationale/tips 等元信息
        assert body["weeklyFocus"]
        assert body["rationale"]
        assert isinstance(body["tips"], list)
        # 至少有任务且 day 在 1-7 范围内
        tasks = body["tasks"]
        assert len(tasks) >= 1
        assert all(1 <= t["day"] <= 7 for t in tasks)
        # 新字段齐备
        first = tasks[0]
        assert "taskType" in first
        assert "difficulty" in first
        assert "priority" in first
        assert "aiGenerated" in first
        # 统计字段已重算
        assert body["totalMinutes"] >= 0
        assert body["completionRate"] == 0  # 刚生成, 没人完成


def test_planner_toggle_and_progress() -> None:
    """任务完成切换 + 进度重算 + /planner/progress 端点."""
    with client() as c:
        # 先生成计划
        gen = c.post(
            "/api/v1/planner/generate",
            headers=HEADERS,
            json={"weeklyStudyMinutes": 420},
        )
        assert gen.status_code == 200
        task_id = gen.json()["data"]["tasks"][0]["id"]

        # 切换完成
        toggle = c.patch(f"/api/v1/planner/tasks/{task_id}/toggle", headers=HEADERS)
        assert toggle.status_code == 200
        assert toggle.json()["data"]["status"] == "done"
        assert toggle.json()["data"]["completedAt"]

        # 再切回 todo
        toggle2 = c.patch(f"/api/v1/planner/tasks/{task_id}/toggle", headers=HEADERS)
        assert toggle2.json()["data"]["status"] == "todo"
        assert toggle2.json()["data"]["completedAt"] is None

        # progress 端点
        prog = c.get("/api/v1/planner/progress", headers=HEADERS)
        assert prog.status_code == 200
        pdata = prog.json()["data"]
        assert pdata["totalTasks"] >= 1
        assert pdata["weekStart"]


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


def test_target_role_recommendation_and_skills_are_idempotent() -> None:
    with client() as c:
        recommended = c.post("/api/v1/jobs/target-role/recommend", headers=HEADERS, json={"interests": ["数据", "商业"]})
        assert recommended.status_code == 200
        role = recommended.json()["data"]["roles"][0]
        saved = c.put("/api/v1/jobs/target-role", headers=HEADERS, json={"title": role["title"]})
        assert saved.status_code == 200
        requirements = [item["name"] for item in role["requirements"]]
        assert c.post("/api/v1/jobs/target-role/skills", headers=HEADERS, json={"skills": requirements}).status_code == 200
        repeat = c.post("/api/v1/jobs/target-role/skills", headers=HEADERS, json={"skills": requirements})
        assert repeat.status_code == 200
        assert repeat.json()["data"]["added"] == []


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
