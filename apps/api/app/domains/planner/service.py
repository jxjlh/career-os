"""Planner 服务 - AI 周计划生成核心.

聚合用户的人生目标 / 技能差距 / 职业里程碑 / 上周完成情况构建上下文,
调用 AI 生成详细的本周计划, 持久化任务到 PlanTask, 支持 sourceId 校验和 fallback.
"""

from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import (
    LifeGoal,
    PlanTask,
    Profile,
    RoadmapMilestone,
    Skill,
    UserSkill,
    WeeklyPlan,
)
from app.domains.ai.prompts.weekly_plan import WEEKLY_PLAN_PROMPT
from app.domains.ai.repository import AIContentRepository
from app.domains.ai.service import AIService
from app.providers.ai.base import extract_json
from app.providers.ai.registry import get_ai_provider


# 任务类型常量, 与前端 i18n key 对齐
TASK_TYPES = {"learning", "practice", "project", "review", "rest"}
DIFFICULTIES = {"easy", "medium", "hard"}
PRIORITIES = {"low", "medium", "high"}


class PlannerContextBuilder:
    """聚合用户全部成长数据, 输出给 AI 的 prompt 上下文 + sourceId 白名单."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def build(self, user_id: str, weekly_minutes: int, goal_ids: list[str] | None = None) -> tuple[str, dict[str, set[str]]]:
        """返回 (prompt_filled, id_whitelist) .

        id_whitelist 形如 {"goal": {...ids}, "skill": {...}, "milestone": {...}},
        用于后续校验 AI 返回的 sourceId 是否合法.
        
        如果传入 goal_ids，则只使用指定的目标，否则使用所有活跃目标。
        """
        profile = self.db.query(Profile).filter(Profile.id == user_id).first()
        profile_text = self._profile_text(profile)

        if goal_ids:
            goals = self._goals_by_ids(user_id, goal_ids)
        else:
            goals = self._active_goals(user_id, limit=10)
        skills = self._skill_gaps(user_id, limit=5)
        milestones = self._active_milestones(user_id, limit=5)
        last_week = self._last_week_summary(user_id)

        goals_text, goal_id_set = self._goals_text(goals)
        skills_text, skill_ids = self._skills_text(skills)
        milestones_text, milestone_ids = self._milestones_text(milestones)

        today_weekday = date.today().weekday() + 1  # 1=周一 ... 7=周日
        prompt = WEEKLY_PLAN_PROMPT.format(
            profile=profile_text,
            weekly_minutes=weekly_minutes,
            goals=goals_text,
            skills=skills_text,
            milestones=milestones_text,
            last_week=last_week,
            today_weekday=today_weekday,
        )
        whitelist = {
            "goal": goal_id_set,
            "skill": skill_ids,
            "milestone": milestone_ids,
        }
        return prompt, whitelist

    def _profile_text(self, profile: Profile | None) -> str:
        if profile is None:
            return "（档案缺失）"
        parts = []
        if profile.display_name:
            parts.append(f"姓名: {profile.display_name}")
        if profile.current_title:
            parts.append(f"当前岗位: {profile.current_title}")
        if profile.target_title:
            parts.append(f"目标岗位: {profile.target_title}")
        if profile.experience_years is not None:
            parts.append(f"工作年限: {profile.experience_years}")
        if profile.company:
            parts.append(f"公司: {profile.company}")
        return " | ".join(parts) if parts else "（档案不完整）"

    def _active_goals(self, user_id: str, limit: int = 5) -> list[LifeGoal]:
        return (
            self.db.query(LifeGoal)
            .filter(LifeGoal.user_id == user_id, LifeGoal.status.in_(["pending", "in_progress"]))
            .order_by(LifeGoal.updated_at.desc(), LifeGoal.created_at.desc())
            .limit(limit)
            .all()
        )

    def _goals_by_ids(self, user_id: str, goal_ids: list[str]) -> list[LifeGoal]:
        """根据指定 ID 列表获取目标（包括已完成和未完成的）。"""
        if not goal_ids:
            return self._active_goals(user_id, limit=10)
        return (
            self.db.query(LifeGoal)
            .filter(
                LifeGoal.user_id == user_id,
                LifeGoal.id.in_(goal_ids),
            )
            .order_by(LifeGoal.updated_at.desc())
            .all()
        )

    def _skill_gaps(self, user_id: str, limit: int = 5) -> list[tuple[Skill, UserSkill]]:
        rows = (
            self.db.query(Skill, UserSkill)
            .join(UserSkill, UserSkill.skill_id == Skill.id)
            .filter(UserSkill.user_id == user_id)
            .all()
        )
        # 按 gap = target - current 降序, gap 相同时按 current 升序
        rows.sort(key=lambda r: (r[1].target_level - r[1].current_level, -r[1].current_level), reverse=True)
        return rows[:limit]

    def _active_milestones(self, user_id: str, limit: int = 5) -> list[RoadmapMilestone]:
        return (
            self.db.query(RoadmapMilestone)
            .filter(RoadmapMilestone.user_id == user_id, RoadmapMilestone.status.in_(["planned", "in_progress"]))
            .order_by(RoadmapMilestone.sort_order, RoadmapMilestone.target_date)
            .limit(limit)
            .all()
        )

    def _last_week_summary(self, user_id: str) -> str:
        last_week_start = date.today() - timedelta(days=date.today().weekday() + 7)
        tasks = (
            self.db.query(PlanTask)
            .join(WeeklyPlan, WeeklyPlan.id == PlanTask.plan_id)
            .filter(
                WeeklyPlan.user_id == user_id,
                WeeklyPlan.week_start == last_week_start,
            )
            .all()
        )
        if not tasks:
            return "上周无计划记录"
        done = sum(1 for t in tasks if t.status == "done")
        total_minutes = sum(t.estimated_minutes for t in tasks)
        done_minutes = sum(t.estimated_minutes for t in tasks if t.status == "done")
        return (
            f"上周共 {len(tasks)} 个任务, 完成 {done} 个; "
            f"投入 {done_minutes}/{total_minutes} 分钟"
        )

    def _goals_text(self, goals: list[LifeGoal]) -> tuple[str, set[str]]:
        if not goals:
            return "（暂无活跃目标）", set()
        lines = []
        ids: set[str] = set()
        for g in goals:
            ids.add(g.id)
            deadline = g.target_date.isoformat() if g.target_date else "无截止"
            desc = (g.description or "").strip()[:80]
            lines.append(f"- id={g.id} | {g.title} [分类:{g.category} 状态:{g.status} 截止:{deadline}] {desc}")
        return "\n".join(lines), ids

    def _skills_text(self, skills: list[tuple[Skill, UserSkill]]) -> tuple[str, set[str]]:
        if not skills:
            return "（暂无技能记录）", set()
        lines = []
        ids: set[str] = set()
        for skill, us in skills:
            ids.add(skill.id)
            gap = us.target_level - us.current_level
            lines.append(
                f"- id={skill.id} | {skill.name} [分类:{skill.category} "
                f"当前 L{us.current_level} 目标 L{us.target_level} 差距 {gap}]"
            )
        return "\n".join(lines), ids

    def _milestones_text(self, milestones: list[RoadmapMilestone]) -> tuple[str, set[str]]:
        if not milestones:
            return "（暂无里程碑）", set()
        lines = []
        ids: set[str] = set()
        for m in milestones:
            ids.add(m.id)
            target = m.target_date.isoformat() if m.target_date else "无日期"
            phase = m.phase or "未分类"
            lines.append(f"- id={m.id} | {m.title} [阶段:{phase} 目标日:{target} 状态:{m.status}]")
        return "\n".join(lines), ids


class PlannerService:
    """调用 AI 生成本周详细计划, 含 fallback."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.context = PlannerContextBuilder(db)
        self.repo = AIContentRepository(db)

    async def generate(
        self,
        user_id: str,
        week_start: date,
        weekly_minutes: int,
        priority_skills: list[str] | None = None,
        goal_ids: list[str] | None = None,
    ) -> WeeklyPlan:
        """生成 AI 周计划. AI 失败时回落到占位逻辑, ai_generated=False."""
        # 取/建本周计划
        plan = (
            self.db.query(WeeklyPlan)
            .filter(WeeklyPlan.user_id == user_id, WeeklyPlan.week_start == week_start)
            .first()
        )
        if plan is None:
            plan = WeeklyPlan(user_id=user_id, week_start=week_start, title="AI 本周计划")
            self.db.add(plan)
            self.db.flush()

        # 清空旧任务 (重新生成)
        self.db.query(PlanTask).filter(PlanTask.plan_id == plan.id).delete()

        prompt, whitelist = self.context.build(user_id, weekly_minutes, goal_ids=goal_ids)
        priority_skill_rows = (
            self.db.query(Skill)
            .filter(Skill.id.in_(priority_skills or []))
            .all()
        )
        whitelist["skill"].update(skill.id for skill in priority_skill_rows)
        input_data = {
            "week_start": week_start.isoformat(),
            "weekly_minutes": weekly_minutes,
            "priority_skills": priority_skills or [],
            "goal_ids": goal_ids or [],
        }

        try:
            ai = get_ai_provider()
            raw = await ai.complete(
                [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"请基于上面的档案生成本周（{week_start.isoformat()} 开始）计划"},
                ],
                response_format="json_object",
                temperature=0.5,
            )
            parsed = extract_json(raw)
            if parsed is None:
                raise AppError(code="AI_OUTPUT_INVALID", message="AI output is not valid JSON", status=422)
            self._persist_ai_plan(plan, parsed, whitelist, user_id, ai_generated=True)
            plan.ai_content_id = None  # 不强制落 ai_content, 减少 DB 写入
        except Exception:
            # fallback: 占位计划
            self._fallback_plan(plan, user_id, weekly_minutes, priority_skills or [])

        # 重算统计 + 落库
        self._recompute_stats(plan)
        plan.title = plan.title or "本周计划"
        plan.ai_generated = True if plan.ai_generated else False
        plan.status = "active"
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def _persist_ai_plan(
        self,
        plan: WeeklyPlan,
        parsed: dict,
        whitelist: dict[str, set[str]],
        user_id: str,
        ai_generated: bool,
    ) -> None:
        plan.title = (parsed.get("title") or "本周计划").strip()[:200]
        plan.weekly_focus = (parsed.get("weeklyFocus") or "").strip() or None
        plan.rationale = (parsed.get("rationale") or "").strip() or None
        tips = parsed.get("tips") or []
        plan.tips = [str(t).strip() for t in tips if str(t).strip()][:6]
        plan.goal_ids = sorted(whitelist["goal"])
        plan.skill_ids = sorted(whitelist["skill"])

        sort_idx = 0
        for task in parsed.get("tasks") or []:
            if not isinstance(task, dict):
                continue
            day = int(task.get("day") or 1)
            if day < 1 or day > 7:
                continue
            title = (task.get("title") or "").strip()
            if not title:
                continue
            source_type = (task.get("sourceType") or "none").strip().lower()
            source_id = (task.get("sourceId") or "").strip()
            life_goal_id, skill_id, milestone_id = self._resolve_source(source_type, source_id, whitelist)

            estimated = int(task.get("estimatedMinutes") or 60)
            estimated = max(10, min(estimated, 600))
            self.db.add(
                PlanTask(
                    plan_id=plan.id,
                    user_id=user_id,
                    title=title[:300],
                    day=day,
                    estimated_minutes=estimated,
                    status="todo",
                    sort_order=sort_idx,
                    description=(task.get("description") or "").strip() or None,
                    task_type=self._norm_enum(task.get("taskType"), TASK_TYPES, "learning"),
                    difficulty=self._norm_enum(task.get("difficulty"), DIFFICULTIES, "medium"),
                    priority=self._norm_enum(task.get("priority"), PRIORITIES, "medium"),
                    ai_generated=ai_generated,
                    resource_url=(task.get("resourceSuggestion") or "").strip() or None,
                    estimated_outcome=(task.get("estimatedOutcome") or "").strip()[:200] or None,
                    # life_goals 表才是用户人生目标, goals 表是另一套 (CareerGoal), 此处只关联 life_goal_id
                    life_goal_id=life_goal_id,
                    skill_id=skill_id,
                    milestone_id=milestone_id,
                )
            )
            sort_idx += 1

        # 若 AI 没产出任务, 抛出异常走 fallback
        if sort_idx == 0:
            raise AppError(code="AI_OUTPUT_EMPTY", message="AI generated no tasks", status=422)

    def _resolve_source(
        self,
        source_type: str,
        source_id: str,
        whitelist: dict[str, set[str]],
    ) -> tuple[str | None, str | None, str | None]:
        """校验 sourceId 是否在白名单内, 不在则丢弃 (None).

        返回 (life_goal_id, skill_id, milestone_id).
        """
        if not source_id:
            return None, None, None
        if source_type == "goal" and source_id in whitelist["goal"]:
            return source_id, None, None
        if source_type == "skill" and source_id in whitelist["skill"]:
            return None, source_id, None
        if source_type == "milestone" and source_id in whitelist["milestone"]:
            return None, None, source_id
        return None, None, None

    def _norm_enum(self, value: Any, allowed: set[str], default: str) -> str:
        v = str(value or "").strip().lower()
        return v if v in allowed else default

    def _fallback_plan(
        self,
        plan: WeeklyPlan,
        user_id: str,
        weekly_minutes: int,
        priority_skills: list[str],
    ) -> None:
        """AI 失败时的兜底: 沿用旧占位逻辑但补关联字段."""
        # 取第一个目标/技能做关联
        goal = (
            self.db.query(LifeGoal)
            .filter(LifeGoal.user_id == user_id, LifeGoal.status.in_(["pending", "in_progress"]))
            .order_by(LifeGoal.updated_at.desc())
            .first()
        )
        skill_row = (
            self.db.query(Skill)
            .join(UserSkill, UserSkill.skill_id == Skill.id)
            .filter(UserSkill.user_id == user_id)
            .order_by((UserSkill.target_level - UserSkill.current_level).desc())
            .first()
        )
        if priority_skills:
            selected_skill = self.db.query(Skill).filter(Skill.id.in_(priority_skills)).first()
            if selected_skill is not None:
                skill_row = selected_skill

        priority_skill_rows = self.db.query(Skill).filter(Skill.id.in_(priority_skills)).all() if priority_skills else []
        topics = [skill.name for skill in priority_skill_rows[:3]]
        if not topics and skill_row:
            topics = [skill_row.name]
        if not topics:
            topics = ["职业规划"]

        plan.title = "本周计划 (AI 不可用, 已生成基础版)"
        plan.weekly_focus = "本周先从一件小事开始, 完成比完美更重要。"
        plan.rationale = "AI 服务暂时不可用, 已按你的优先技能生成基础学习计划, 完成后可手动添加更多任务。"
        plan.tips = ["每天专注 1 小时", "周日晚做一次周回顾"]
        plan.goal_ids = [goal.id] if goal else []
        plan.skill_ids = [skill_row.id] if skill_row else []
        plan.ai_generated = False

        per_day_minutes = max(30, weekly_minutes // 7)
        for day in range(1, 8):
            topic = topics[(day - 1) % len(topics)]
            task_type = "review" if day == 7 else "learning"
            self.db.add(
                PlanTask(
                    plan_id=plan.id,
                    user_id=user_id,
                    title=f"学习 {topic} 基础与实战" if day != 7 else "周回顾: 整理笔记 + 复盘",
                    day=day,
                    estimated_minutes=per_day_minutes if day != 7 else 30,
                    status="todo",
                    sort_order=day,
                    description=None,
                    task_type=task_type,
                    difficulty="medium",
                    priority="medium" if day != 7 else "low",
                    ai_generated=False,
                    estimated_outcome=None,
                    life_goal_id=goal.id if goal else None,
                    skill_id=skill_row.id if skill_row else None,
                )
            )

    def _recompute_stats(self, plan: WeeklyPlan) -> None:
        """重算 completion_rate / total_minutes / completed_minutes."""
        tasks = self.db.query(PlanTask).filter(PlanTask.plan_id == plan.id).all()
        total = sum(t.estimated_minutes for t in tasks)
        done_minutes = sum(t.estimated_minutes for t in tasks if t.status == "done")
        done_count = sum(1 for t in tasks if t.status == "done")
        plan.total_minutes = total
        plan.completed_minutes = done_minutes
        plan.completion_rate = round(done_count / len(tasks), 4) if tasks else 0.0


def toggle_task(db: Session, user_id: str, task_id: str) -> PlanTask:
    """切换任务完成状态, 重算 plan 统计."""
    task = (
        db.query(PlanTask)
        .filter(PlanTask.id == task_id, PlanTask.user_id == user_id)
        .first()
    )
    if task is None:
        raise AppError(code="NOT_FOUND", message="Task not found", status=404)

    if task.status == "done":
        task.status = "todo"
        task.completed_at = None
    else:
        task.status = "done"
        task.completed_at = date.today()

    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == task.plan_id).first()
    if plan is not None:
        _recompute_plan_stats(db, plan)
    db.commit()
    db.refresh(task)
    return task


def update_task(
    db: Session,
    user_id: str,
    task_id: str,
    *,
    priority: str | None = None,
    notes: str | None = None,
    estimated_minutes: int | None = None,
    title: str | None = None,
    day: int | None = None,
) -> PlanTask:
    task = (
        db.query(PlanTask)
        .filter(PlanTask.id == task_id, PlanTask.user_id == user_id)
        .first()
    )
    if task is None:
        raise AppError(code="NOT_FOUND", message="Task not found", status=404)
    if priority is not None and priority in PRIORITIES:
        task.priority = priority
    if notes is not None:
        task.notes = notes.strip() or None
    if estimated_minutes is not None:
        task.estimated_minutes = max(10, min(int(estimated_minutes), 600))
    if title is not None and title.strip():
        task.title = title.strip()[:300]
    if day is not None and 1 <= day <= 7:
        task.day = int(day)
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == task.plan_id).first()
    if plan is not None:
        _recompute_plan_stats(db, plan)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, user_id: str, task_id: str) -> None:
    task = (
        db.query(PlanTask)
        .filter(PlanTask.id == task_id, PlanTask.user_id == user_id)
        .first()
    )
    if task is None:
        raise AppError(code="NOT_FOUND", message="Task not found", status=404)
    plan_id = task.plan_id
    db.delete(task)
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if plan is not None:
        _recompute_plan_stats(db, plan)
    db.commit()


def submit_review(
    db: Session,
    user_id: str,
    plan_id: str,
    summary: str | None,
    reflection: str | None,
) -> WeeklyPlan:
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.id == plan_id, WeeklyPlan.user_id == user_id)
        .first()
    )
    if plan is None:
        raise AppError(code="NOT_FOUND", message="Plan not found", status=404)
    if summary is not None:
        plan.summary = summary.strip() or None
    if reflection is not None:
        plan.reflection = reflection.strip() or None
    plan.status = "reviewed"
    db.commit()
    db.refresh(plan)
    return plan


def _recompute_plan_stats(db: Session, plan: WeeklyPlan) -> None:
    tasks = db.query(PlanTask).filter(PlanTask.plan_id == plan.id).all()
    total = sum(t.estimated_minutes for t in tasks)
    done_minutes = sum(t.estimated_minutes for t in tasks if t.status == "done")
    done_count = sum(1 for t in tasks if t.status == "done")
    plan.total_minutes = total
    plan.completed_minutes = done_minutes
    plan.completion_rate = round(done_count / len(tasks), 4) if tasks else 0.0
