# 技能矩阵学习模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/skills/` 改造成支持技能分类、技能详情、B站资源、AI考核、可编辑学习计划和进度可视化的学习工作区。

**Architecture:** 在现有 `Skill`/`UserSkill`/`WeeklyPlan`/`PlanTask` 数据模型上扩展用户技能分类状态，并在技能路由中提供单技能详情、B站资源和计划统计接口。前端将现有单页重构为矩阵总览、两个分类按钮和按选中技能显示的详情面板，计划继续通过已有 planner 任务接口持久化。

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, Next.js, React Query, ECharts, Bilibili search provider, pytest.

## Global Constraints

- 保留现有 Render 服务、路由前缀和生产域名，不迁移网站。
- “已经会的技能”和“想学的技能”是两个平行分类，同一技能可以移动分类。
- 新增技能默认进入“想学的技能”，不新增名为“相学”的技能。
- 技能资源搜索只使用 B站 provider，不回退到其他搜索来源。
- 未选中技能时不显示技能等级管理、AI知识点、考核和计划编辑区。
- 前端构建产物继续同步到 `apps/api/static`。

---

### Task 1: 扩展用户技能分类状态

**Files:**
- Modify: `apps/api/app/db/models.py:133-148`
- Create: `apps/api/migrations/versions/<new_revision>_add_skill_learning_status.py`
- Modify: `apps/api/app/domains/skills/repository.py`
- Modify: `apps/api/app/domains/skills/service.py`
- Test: `apps/api/tests/test_modules.py`

**Interfaces:**
- Produces `UserSkill.learning_status: str` with values `mastered` and `learning`.
- Produces `skill_dict()` field `learningStatus`.
- Existing rows migrate to `learning` when `target_level > current_level`, otherwise `mastered`.

- [ ] **Step 1: Write failing API tests**

Add tests that create a skill and assert it defaults to `learning`, update progress to equal levels and assert the explicit status remains stable, and move a skill between categories without changing levels.

```python
def test_skill_defaults_to_learning_and_can_move_category() -> None:
    created = c.post(
        "/api/v1/skills",
        headers=HEADERS,
        json={"name": f"分类技能-{uuid.uuid4().hex[:8]}", "currentLevel": 1, "targetLevel": 8},
    )
    assert created.status_code == 201
    skill_id = created.json()["data"]["skillId"]
    assert created.json()["data"]["learningStatus"] == "learning"

    moved = c.patch(f"/api/v1/skills/{skill_id}", headers=HEADERS, json={"learningStatus": "mastered"})
    assert moved.status_code == 200
    assert moved.json()["data"]["learningStatus"] == "mastered"
    assert moved.json()["data"]["currentLevel"] == 1
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `uv run --project apps/api pytest apps/api/tests/test_modules.py -k category -v`

Expected: FAIL because the response has no `learningStatus` and the patch schema rejects the new field.

- [ ] **Step 3: Add the model field and migration**

Add a non-null indexed `learning_status` column to `user_skills` with default `learning`. The Alembic upgrade adds the column and backfills existing rows from their levels; downgrade removes the column.

- [ ] **Step 4: Update skill schemas, repository, service, and CRUD routes**

Extend `SkillCreate` with optional `learningStatus` defaulting to `learning`, extend `SkillUpdate` with optional validated `learningStatus`, persist it on create/update, and include camelCase output in `skill_dict()`.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `uv run --project apps/api pytest apps/api/tests/test_modules.py -k category -v`

Expected: PASS.

- [ ] **Step 6: Commit the backend category change**

```bash
git add apps/api/app/db/models.py apps/api/app/domains/skills apps/api/migrations/versions/<new_revision>_add_skill_learning_status.py apps/api/tests/test_modules.py
git commit -m "feat: 支持技能学习分类"
```

### Task 2: 固定技能资源搜索为 B 站

**Files:**
- Modify: `apps/api/app/domains/explorer/router.py:run_search_job/explore_search`
- Modify: `apps/api/app/providers/search/registry.py`
- Test: `apps/api/tests/test_modules.py`

**Interfaces:**
- `POST /api/v1/skills/{skill_id}/resources` accepts `{query, limit}` and returns a background job whose provider list is exactly `bilibili`.
- Existing general `/explore/search` behavior remains unchanged.

- [ ] **Step 1: Write a failing test for the B站-only skill search**

Patch the Bilibili provider in the test and assert the skill-specific request creates a search job with `payload.providers == ["bilibili"]`, while unrelated providers are not called.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `uv run --project apps/api pytest apps/api/tests/test_modules.py -k bilibili -v`

Expected: FAIL because the skill-specific resource endpoint does not exist.

- [ ] **Step 3: Implement the skill resource endpoint**

Add a validated request model and endpoint in `skills/router.py`. Confirm the skill belongs to the current user or return `404`; enqueue the existing explorer job with `providers=["bilibili"]` and query text composed from skill name plus user query.

- [ ] **Step 4: Make provider filtering explicit in the explorer job**

Ensure the background job uses the payload provider list when present and does not silently merge the default provider registry. Keep the existing general search default unchanged when `providers` is omitted.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `uv run --project apps/api pytest apps/api/tests/test_modules.py -k bilibili -v`

Expected: PASS.

- [ ] **Step 6: Commit the B站 search change**

```bash
git add apps/api/app/domains/skills/router.py apps/api/app/domains/explorer/router.py apps/api/providers/search/registry.py apps/api/tests/test_modules.py
git commit -m "feat: 技能资源固定搜索B站"
```

### Task 3: Add skill detail, knowledge points, assessment, and progress APIs

**Files:**
- Modify: `apps/api/app/domains/skills/router.py`
- Modify: `apps/api/app/domains/skills/service.py`
- Modify: `apps/api/app/domains/skills/repository.py`
- Test: `apps/api/tests/test_modules.py`

**Interfaces:**
- `GET /api/v1/skills/{skill_id}/detail` returns skill data, learning status, knowledge points, plan summary, assessment history, and progress series.
- `POST /api/v1/skills/{skill_id}/knowledge` returns AI-generated `knowledgePoints`.
- Existing `/skills/{skill_id}/recommendations` remains available but its resource section is replaced in the UI by the B站-only endpoint.
- Existing `/career/assessment` remains the scoring endpoint; the detail response stores the latest result in the returned assessment summary.

- [ ] **Step 1: Write failing tests for detail and knowledge response shapes**

Create a custom skill, call detail and knowledge endpoints with the mock AI provider, and assert the response contains `skill`, `knowledgePoints`, `planStats`, `assessment`, and `progress`. Assert unauthenticated/foreign skill access returns `404`.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `uv run --project apps/api pytest apps/api/tests/test_modules.py -k "skill_detail or knowledge" -v`

Expected: FAIL with `404` for the new endpoints.

- [ ] **Step 3: Implement service serializers and aggregation**

Add service helpers that load the current user’s `UserSkill`, this week’s linked `PlanTask` rows, completed/total minutes, and recent assessment records available in the existing AI/career data. Return a stable camelCase envelope for the frontend.

- [ ] **Step 4: Implement AI knowledge-point generation**

Use the registered AI provider with a JSON prompt containing skill name, current level, target level, and description. Normalize malformed/empty provider output to a short fallback list so the page remains usable when AI is unavailable.

- [ ] **Step 5: Implement the new routes**

Add ownership checks and route handlers for detail, knowledge, B站 resources, and progress aggregation. Keep all mutations scoped to `current_user.id`.

- [ ] **Step 6: Run the focused tests and verify they pass**

Run: `uv run --project apps/api pytest apps/api/tests/test_modules.py -k "skill_detail or knowledge" -v`

Expected: PASS.

- [ ] **Step 7: Commit the detail API change**

```bash
git add apps/api/app/domains/skills apps/api/tests/test_modules.py
git commit -m "feat: 增加技能详情与学习进度接口"
```

### Task 4: Rebuild the skills page around two categories and selected detail

**Files:**
- Modify: `apps/web/app/(app)/skills/page.tsx`
- Modify: `apps/web/lib/i18n.tsx:165-260`
- Test: `apps/web/app/(app)/skills/page.tsx` via typecheck/build and existing frontend test setup

**Interfaces:**
- Consumes `/skills/matrix`, `/skills`, `/skills/{id}`, `/skills/{id}/detail`, `/skills/{id}/knowledge`, `/skills/{id}/resources`, `/career/assessment`, `/planner/generate`, `/planner/tasks`, `/planner/tasks/{id}`, and `/planner/tasks/{id}/toggle`.
- Produces a page where no skill detail editor is rendered until a skill card is clicked.

- [ ] **Step 1: Add frontend behavior checks**

Add or extend the existing frontend test setup to assert the page renders the two classification buttons, hides detail-only labels before selection, and renders B站 resource labels after selecting a skill. If this repository has no runnable component test setup, preserve these checks as build-time route markers and cover behavior through the API tests and manual browser smoke flow.

- [ ] **Step 2: Run the frontend check and verify it fails**

Run: `npm --workspace apps/web run typecheck`

Expected: FAIL after introducing references to the new state/components before implementation.

- [ ] **Step 3: Refactor page state and category list**

Add `activeCategory` and `selectedSkillId`, derive `masteredSkills` and `learningSkills` from `learningStatus`, render the two parallel buttons, and add compact skill cards with add/edit/delete/move actions. Clear knowledge, search, assessment, and plan draft state when selection changes.

- [ ] **Step 4: Add selected-skill detail sections**

Render the level editor, mastery progress, AI knowledge points, B站 resources, assessment form/score, and weekly plan only when `selectedSkillId` is set. Use React Query invalidation after every mutation and show loading/error states.

- [ ] **Step 5: Add editable plan controls and visualizations**

Use the existing planner endpoints to generate a selected-skill plan, add a minimal manual task form, edit title/day/minutes, delete tasks, toggle completion, and render completion cards plus an EChart trend/progress visualization.

- [ ] **Step 6: Update Chinese labels and remove old all-skills level block**

Add translations for the new buttons and detail labels. Remove the old page-wide “技能等级管理” list so it only exists inside selected skill detail.

- [ ] **Step 7: Run frontend checks and verify they pass**

Run: `npm --workspace apps/web run typecheck && npm --workspace apps/web run lint && npm --workspace apps/web run build`

Expected: typecheck and build pass; lint may report only pre-existing warnings outside the changed page.

- [ ] **Step 8: Commit the skills page change**

```bash
git add 'apps/web/app/(app)/skills/page.tsx' apps/web/lib/i18n.tsx apps/web/out apps/api/static
git commit -m "feat: 重构技能矩阵学习工作区"
```

### Task 5: Integration verification and Render deployment

**Files:**
- Modify: `apps/api/static` generated files only
- Test: `apps/api/tests/test_modules.py`, online `/skills/`

- [ ] **Step 1: Run backend regression tests**

Run: `uv run --project apps/api pytest`

Expected: all existing and new API tests pass.

- [ ] **Step 2: Build and synchronize the embedded frontend**

Run: `npm --workspace apps/web run build && rsync -a --delete apps/web/out/ apps/api/static/`

Expected: generated `/skills/index.html` contains the new category and B站 labels.

- [ ] **Step 3: Run diff and artifact checks**

Run: `git diff --check && git status --short`

Expected: only intended skill page, backend, migration, tests, and generated static files are changed.

- [ ] **Step 4: Push both production branches**

```bash
git push origin master
git push origin master:main
```

- [ ] **Step 5: Verify GitHub and Render**

Confirm `main` and `master` point to the same commit, GitHub CI succeeds, and `GET https://ai-life-os-api-4y3x.onrender.com/skills/` contains the new category buttons and no old page-wide level-management block. Confirm `/ready` remains healthy.

