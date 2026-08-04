# CareerOS 周计划完善 + 系统板块联动

## Context

CareerOS 的周计划（Planner）板块严重不足：后端 `POST /planner/generate` 完全没有调用 AI，只是机械循环 7 天生成 `"学习 {topic} 基础与实战"` 的占位任务。`PlanTask` 没有关联人生目标、技能、职业里程碑。前端只有简陋的 7 列网格，不支持任务展开、完成切换、进度统计。整个系统的板块间缺乏联动——人生目标、技能、职业路径、周计划、Dashboard 各自孤立。

本次改造目标：让周计划真正 AI 化，生成包含「任务详情+预期产出+关联目标/技能+学习资源建议+每周复盘」的详细计划，并打通 LifeGoal / Skill / RoadmapMilestone 与周计划的双向关联，前端支持任务展开/完成切换/进度统计，Dashboard 集成本周进度。

---

## Phase 1：数据模型扩展 + 周计划 AI 生成

### 1.1 数据模型扩展

**修改文件**：`apps/api/app/db/models.py`（PlanTask L259-272, WeeklyPlan L247-256）

#### PlanTask 新增字段
```python
description: Mapped[str | None] = mapped_column(Text)          # AI 生成的"为什么做+怎么做"
goal_id: Mapped[str | None] = mapped_column(ForeignKey("goals.id", ondelete="SET NULL"), index=True)
life_goal_id: Mapped[str | None] = mapped_column(ForeignKey("life_goals.id", ondelete="SET NULL"), index=True)
skill_id: Mapped[str | None] = mapped_column(ForeignKey("skills.id", ondelete="SET NULL"), index=True)
milestone_id: Mapped[str | None] = mapped_column(ForeignKey("roadmap_milestones.id", ondelete="SET NULL"), index=True)
task_type: Mapped[str] = mapped_column(String(24), default="learning")  # learning/practice/project/review/rest
difficulty: Mapped[str] = mapped_column(String(16), default="medium")     # easy/medium/hard
completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
priority: Mapped[str] = mapped_column(String(16), default="medium")        # low/medium/high
resource_url: Mapped[str | None] = mapped_column(Text)
estimated_outcome: Mapped[str | None] = mapped_column(String(200))       # 预期产出
```

#### WeeklyPlan 新增字段
```python
summary: Mapped[str | None] = mapped_column(Text)
reflection: Mapped[str | None] = mapped_column(Text)
completion_rate: Mapped[float] = mapped_column(Float, default=0)
total_minutes: Mapped[int] = mapped_column(Integer, default=0)
completed_minutes: Mapped[int] = mapped_column(Integer, default=0)
goal_ids: Mapped[list] = mapped_column(JSON, default=list)
skill_ids: Mapped[list] = mapped_column(JSON, default=list)
context_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
ai_content_id: Mapped[str | None] = mapped_column(ForeignKey("ai_content.id", ondelete="SET NULL"))
updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)
weekly_focus: Mapped[str | None] = mapped_column(Text)     # AI 本周寄语
rationale: Mapped[str | None] = mapped_column(Text)         # AI 为什么这么安排
tips: Mapped[list] = mapped_column(JSON, default=list)       # AI 建议
```

#### 迁移策略
- 更新 `apps/api/app/core/database.py` 的 `ensure_columns()` additions 字典，加入 `weekly_plans` 和 `plan_tasks` 的新列（幂等自愈）
- 新建 Alembic migration `apps/api/migrations/versions/xxxx_add_planner_linkage.py`

### 1.2 AI Prompt 设计

**新建文件**：`apps/api/app/domains/ai/prompts/weekly_plan.py`

Prompt 核心要点：
- **System**：角色为"AI 周计划教练"，硬性规则包括每日任务数 1-3 个、单任务 25-120 分钟、至少 1 天轻量日、周日必须 review、`sourceId` 必须引用真实数据
- **User**：注入用户档案 + top 5 active goals + top 5 skills (按 gap 排序) + top 5 milestones + 上周完成情况 + 今日周几
- **输出 JSON**：`{title, weeklyFocus, rationale, tasks[{day, title, description, taskType, difficulty, estimatedMinutes, priority, estimatedOutcome, sourceType, sourceId, resourceSuggestion}], tips, milestoneProgress}`

### 1.3 PlannerContextBuilder + PlannerService

**新建文件**：`apps/api/app/domains/planner/service.py`

- `PlannerContextBuilder.build(user_id, db)` → 聚合 goals/skills/milestones/last_week_completion，输出 prompt 上下文（参考 `apps/api/app/domains/coach/service.py:61-145` 的 CoachContextBuilder 模式）
- `PlannerService.generate(user_id, payload, db)` → 调用 AI、解析 JSON、校验 sourceId、fallback、持久化

### 1.4 重构后端路由

**修改文件**：`apps/api/app/domains/planner/router.py`

| 端点 | 变更 |
|------|------|
| `POST /planner/generate` | 改为 `async def`，调用 `PlannerService.generate()`，真正 AI 生成 + fallback |
| `PATCH /planner/tasks/{task_id}/toggle` | **新增**：切换完成状态，写入 completed_at，重算 completion_rate/completed_minutes |
| `PATCH /planner/tasks/{task_id}` | **新增**：更新 priority/notes/estimated_minutes |
| `DELETE /planner/tasks/{task_id}` | **新增**：删除任务，重算 completion_rate |
| `POST /planner/{plan_id}/review` | **新增**：提交周总结 + 反思 |
| `GET /planner/progress` | **新增**：返回本周 completion_rate/completed_minutes/today_tasks（供 Dashboard） |
| `_plan_dict()` | 扩展返回所有新字段 |

### 1.5 AI 调用与校验

- 复用 `AIService.generate_content()`（`apps/api/app/domains/ai/service.py:68-99`）或直接 `get_ai_provider().complete()`
- AI 响应用 `extract_json()` 解析
- **sourceId 校验**：每个任务的 sourceId 必须在上下文传入的 goals/skills/milestones ID 集合内，否则丢弃任务（参考 `BucketRecommendationService._parse_recommendations` 的 `cand_by_id` 模式）
- **Fallback**：AI 失败时沿用占位逻辑但补充关联字段（取第一个 active goal / first skill），`ai_generated=False`

---

## Phase 2：板块联动

### 2.1 人生目标 ↔ 周计划

- `PlannerContextBuilder` 注入 top 5 active LifeGoal
- AI 从中选择 1-3 个作为本周聚焦，任务通过 `life_goal_id` 关联
- **新增** `GET /life/goals/{goal_id}/weekly-tasks` 端点（在 `apps/api/app/domains/life/router.py`）
- Life Goal 详情页展示"本周推进任务"

### 2.2 技能 ↔ 周计划

- `PlannerContextBuilder` 注入 top 5 UserSkill（按 gap = target_level - current_level 降序）
- 任务通过 `skill_id` 关联
- 任务完成时累计该 skill 学习时长
- **新增** `GET /skills/{skill_id}/weekly-tasks` 端点

### 2.3 职业路径 ↔ 周计划

- `PlannerContextBuilder` 注入 top 5 active RoadmapMilestone
- AI 将里程碑拆解为本周子任务，通过 `milestone_id` 关联
- **新增** `GET /roadmaps/milestones/{milestone_id}/weekly-tasks` 端点

### 2.4 AI 教练 ↔ 周计划

- 修改 `apps/api/app/domains/coach/service.py` 的 `CoachContextBuilder.build()`：注入"本周计划: 完成 X/Y 任务, 完成率 Z%"
- CoachAdviceService 的 `_build_reminders()` 新增"周计划进度落后"提醒
- Coach 对话能读取本周 PlanTask 给建议

### 2.5 Dashboard 端点扩展

**修改文件**：`apps/api/app/domains/dashboard/router.py`

`/dashboard/summary` 新增字段：
```python
"weeklyPlanProgress": {
    "completionRate": 0.0,
    "completedTasks": 0,
    "totalTasks": 0,
    "completedMinutes": 0,
    "totalMinutes": 0,
    "todayTasks": 0,
    "todayDone": 0,
}
```

---

## Phase 3：前端完善 + Dashboard 集成

### 3.1 Planner 页面重构

**修改文件**：`apps/web/app/(app)/planner/page.tsx`

保留 7 列网格 + 生成按钮，新增：

1. **顶部进度条**：本周完成率 count-up + 已完成分钟数/总分钟数 + 今日任务数
2. **本周寄语卡片**：展示 `weeklyFocus` + `rationale` + `tips`，带 Sparkles 图标
3. **任务卡片增强**：
   - task_type 图标（📖 learning / 🛠 practice / 🚀 project / 🔍 review / ☕ rest）
   - difficulty 色点（easy 绿 / medium 黄 / hard 红）
   - 关联标签 `#目标名` / `#技能名`（点击跳转）
   - estimated_outcome 预期产出
   - **完成切换**：圆形 checkbox，点击调 toggle API，150ms ease-out scale + 划线
   - **展开详情**：点击展开 description / resource_url / notes，300ms height 动画
4. **周日复盘区**：周日展示 reflection 输入框 + summary
5. **空状态引导**：无计划时"生成你的第一份 AI 周计划"卡片
6. **移动端**：7 列改为纵向单日轮播 + sticky 进度条 + bottom sheet 详情

### 3.2 Dashboard 集成

**新建文件**：`apps/web/components/dashboard/weekly-plan-progress.tsx`

在 `apps/web/app/(app)/dashboard/page.tsx` 的 `ActiveGoals` 和 `LifeMapPreview` 之间插入：
- 标题 "THIS WEEK"
- 大数字：完成率百分比 + count-up
- 7 个圆点表示本周 7 天（参考 `streak-card.tsx` 圆点设计）
- 今日 N 个任务，M 个已完成
- 点击跳转 `/planner`

### 3.3 i18n 扩展

**修改文件**：`apps/web/lib/i18n.tsx`

新增 planner 相关 key：taskType / difficulty / weeklyFocus / rationale / tips / review / reflection / completionRate 等。

---

## 关键文件清单

### 后端修改
- `apps/api/app/db/models.py` — PlanTask + WeeklyPlan 新字段
- `apps/api/app/core/database.py` — ensure_columns 新列
- `apps/api/app/domains/planner/router.py` — 重构 generate + 新增 toggle/review/progress 端点
- `apps/api/app/domains/planner/service.py` — **新建** PlannerContextBuilder + PlannerService
- `apps/api/app/domains/ai/prompts/weekly_plan.py` — **新建** AI prompt
- `apps/api/app/domains/life/router.py` — 新增 weekly-tasks 端点
- `apps/api/app/domains/skills/router.py` — 新增 weekly-tasks 端点
- `apps/api/app/domains/roadmap/router.py` — 新增 milestone weekly-tasks 端点
- `apps/api/app/domains/coach/service.py` — CoachContextBuilder 注入周计划进度
- `apps/api/app/domains/dashboard/router.py` — summary 新增 weeklyPlanProgress
- `apps/api/migrations/versions/xxxx_add_planner_linkage.py` — **新建** migration

### 前端修改
- `apps/web/app/(app)/planner/page.tsx` — 全面重构
- `apps/web/components/dashboard/weekly-plan-progress.tsx` — **新建**
- `apps/web/app/(app)/dashboard/page.tsx` — 插入 WeeklyPlanProgress
- `apps/web/lib/i18n.tsx` — 新增 planner keys

### 复用的现有工具
- `app.providers.ai.registry.get_ai_provider()` — AI provider 调用
- `app.domains.ai.service.AIService.generate_content()` — AI 调用包装 + JSON 解析
- `app.domains.coach.service.CoachContextBuilder` — 上下文构建参考模式
- `app.core.database.ensure_columns()` — 幂等补列
- `extract_json()` — AI 响应解析
- 前端 `streak-card.tsx` 的 count-up + 圆点设计模式
- 前端 `framer-motion` + `easeStandard` 微交互

---

## 验证方案

1. **后端单元测试**：
   - `/planner/generate` AI 成功 → 任务有 description/goal_id/skill_id，sourceId 校验通过
   - AI 失败 → fallback 返回占位计划，`ai_generated=False`
   - `/planner/tasks/{id}/toggle` → completion_rate 正确重算
   - sourceId 编造 → 任务被丢弃

2. **前端验证**：
   - `npm run build` 通过
   - 浏览器打开 `/planner`，点击生成 → 看到详细任务卡片
   - 点击完成切换 → 划线动画 + 进度条更新
   - 点击任务卡片 → 展开详情
   - Dashboard 首页看到本周进度模块

3. **端到端**：
   - 先在 `/life` 创建一个人生目标
   - 在 `/skills` 添加一个技能
   - 回到 `/planner` 生成 → 任务关联到该目标/技能
   - 点击关联标签 → 跳转到对应详情页
   - 标记完成 → Dashboard 进度更新
