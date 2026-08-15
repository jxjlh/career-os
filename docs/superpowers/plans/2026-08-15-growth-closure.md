# Growth Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make life-record images durable and viewable, restore accurate reading discovery with lawful downloads and reading-plan tasks, add a target-role-to-skill-gap workflow, and remove AI Coach.

**Architecture:** Keep media objects in the private Supabase bucket and return signed URLs. Add focused APIs to the existing reading, skills, planner, and jobs domains instead of adding a second state store. Persist the selected role on `Profile`, use a saved `Job` plus `JobAnalysis` for JD gaps, and convert those gaps into `UserSkill` entries.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, httpx, Google Books API metadata, Next.js, React Query, TypeScript, pytest.

## Global Constraints

- Production image uploads must never fall back to Render-local media storage.
- Book results must be metadata-matched to the requested title/author/ISBN before UI display.
- Download links are surfaced only when the provider declares an EPUB/PDF download URL; all other results link to their information/preview page.
- Weekly planning uses `learning` skills and reading books, not English word-book plans.
- Delete skills without deleting completed historical plan tasks; clear only the task skill association.
- Remove AI Coach navigation and router registration without deleting stored records.

---

### Task 1: Media persistence and preview

**Files:**
- Modify: `apps/api/app/core/storage.py`
- Modify: `apps/api/app/domains/life/service.py`
- Modify: `apps/web/components/life/life-record-image.tsx`
- Test: `apps/api/tests/test_storage.py`

- [ ] Write failing tests for cloud-only production uploads, missing-bucket bootstrap, and unique object keys.
- [ ] Implement private bucket upload, signed resolution, and unique keys.
- [ ] Add keyboard-accessible image preview dialog.
- [ ] Run storage and life-record tests.

### Task 2: Accurate book search and download metadata

**Files:**
- Modify: `apps/api/app/domains/reading/sources.py`
- Modify: `apps/api/app/domains/reading/router.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/web/app/(app)/library/page.tsx`
- Test: `apps/api/tests/test_reading_sources.py`

- [ ] Write failing provider tests for exact title/author/ISBN ranking and download eligibility.
- [ ] Use canonical book metadata results with provider identifiers, source URL, and optional downloadable format URL.
- [ ] Re-register the reading router and render search job results, save actions, and legal download actions.
- [ ] Run reading API tests.

### Task 3: Target-role recommendation and JD gap conversion

**Files:**
- Modify: `apps/api/app/domains/jobs/router.py`
- Modify: `apps/api/app/domains/skills/router.py`
- Modify: `apps/web/app/(app)/skills/page.tsx`
- Test: `apps/api/tests/test_modules.py`

- [ ] Write failing tests for questionnaire recommendations, saving a role, JD requirement lookup, and idempotent skill creation.
- [ ] Persist selected role through the profile target-title field and save JD analyses as jobs.
- [ ] Add the “目标岗位” component with questionnaire, suggested roles, JD requirements, and one-click gap-skill actions.
- [ ] Run skills/jobs API tests.

### Task 4: Skill deletion and weekly reading plan

**Files:**
- Modify: `apps/api/app/domains/skills/router.py`
- Modify: `apps/api/app/domains/planner/router.py`
- Modify: `apps/api/app/domains/planner/service.py`
- Modify: `apps/web/app/(app)/planner/page.tsx`
- Test: `apps/api/tests/test_modules.py`

- [ ] Write failing tests for deleting a user skill with existing plan history and AI plan generation from learning skills plus reading books.
- [ ] Clear historical `PlanTask.skill_id` before removing the user association.
- [ ] Include reading tasks based on active books, pages remaining, and weekly available minutes; do not create English word-book tasks.
- [ ] Render skill and reading rationale in the planner.
- [ ] Run planner and skills regression tests.

### Task 5: Remove AI Coach and verify the integrated product

**Files:**
- Modify: `apps/web/components/sidebar/sidebar-nav.tsx`
- Modify: `apps/api/app/main.py`
- Modify/Delete: AI Coach route files only when they are not part of unrelated user changes.
- Test: existing affected API and web typecheck suites.

- [ ] Remove navigation and backend router registration.
- [ ] Run API tests, web typecheck, and a serial web build.
- [ ] Stage only files owned by this plan plus the already-implemented cloud-storage fix.
- [ ] Commit with a focused message and push `master` after reviewing staged diff.
