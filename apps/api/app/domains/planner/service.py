"""Planner 服务 - AI 周计划生成核心.

聚合用户的四条成长线构建上下文并调用 AI 生成本周计划:
    ① 技能矩阵: 正在学的技能 + 已学到的进度（接着进度往下排, 不重复从头学）
    ② 英语学习: 在背的词书 + 掌握/学习中/新词进度 + 到期复习量 + 打卡与听力正确率
    ③ 本周内到期的人生目标: 只要本周到期, 硬保证一定出现在周计划里
    ④ 职业里程碑 + 其他进行中的目标

生成的任务持久化到 PlanTask, 支持 sourceId 校验、本周目标兜底注入和 fallback.
"""

import logging
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.timeutil import today
from app.db.models import (
    DailyReview,
    EnglishStudySession,
    GoalTask,
    LifeGoal,
    ListeningAttempt,
    PlanTask,
    Profile,
    RoadmapMilestone,
    Skill,
    UserSkill,
    UserWord,
    WeeklyPlan,
    WordBook,
    WordReviewLog,
)
from app.domains.ai.prompts.weekly_plan import WEEKLY_PLAN_PROMPT
from app.domains.ai.repository import AIContentRepository
from app.domains.ai.service import AIService
from app.providers.ai.base import extract_json
from app.providers.ai.registry import get_ai_provider

logger = logging.getLogger("app.planner")


# 任务类型常量, 与前端 i18n key 对齐
TASK_TYPES = {"learning", "practice", "project", "review", "english", "reading", "rest"}
DIFFICULTIES = {"easy", "medium", "hard"}
PRIORITIES = {"low", "medium", "high"}

# 英语任务在 PlanTask 上的 sourceType/sourceId 约定值（不关联具体表, 仅作标记）
ENGLISH_SOURCE_ID = "english"

# 单个技能本周已投入超过该分钟数后不再加重
SKILL_WEEKLY_MINUTES_SOFT_CAP = 120


class PlannerContextBuilder:
    """聚合用户全部成长数据, 输出给 AI 的 prompt 上下文 + sourceId 白名单."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def build(
        self,
        user_id: str,
        weekly_minutes: int,
        week_start: date,
        goal_ids: list[str] | None = None,
    ) -> tuple[str, dict[str, set[str]], dict[str, Any]]:
        """返回 (prompt_filled, id_whitelist, snapshot).

        id_whitelist 形如 {"goal": {...ids}, "skill": {...}, "milestone": {...}, "english": {"english"}},
        用于后续校验 AI 返回的 sourceId 是否合法.

        传入 goal_ids 时优先使用指定目标, 否则使用所有活跃目标.
        snapshot 是该次生成用到的原始上下文, 落库到 weekly_plans.context_snapshot 便于复盘.
        """
        week_end = week_start + timedelta(days=6)

        profile = self.db.query(Profile).filter(Profile.id == user_id).first()
        profile_text = self._profile_text(profile)

        # 本周内到期的人生目标 —— 单独一档, 硬要求进计划
        week_goals, week_goal_tasks = self._week_goals(user_id, week_start, week_end)

        if goal_ids:
            goals = self._goals_by_ids(user_id, goal_ids)
        else:
            goals = self._active_goals(user_id, limit=10)

        # 已从「本周到期目标」里排除, 避免重复出现在「其他目标」中
        # 同时限制总数, 目标过多会让 AI 注意力分散
        week_goal_ids = {g.id for g in week_goals}
        goals = [g for g in goals if g.id not in week_goal_ids][:8]

        skill_rows = self._skill_matrix(user_id, week_start)
        milestones = self._active_milestones(user_id, limit=5)
        last_week = self._last_week_summary(user_id)
        english = self._english_snapshot(user_id, week_start)

        skill_matrix_text, skill_ids = self._skill_matrix_text(skill_rows)
        week_goals_text, week_goal_id_set = self._week_goals_text(week_goals, week_goal_tasks, week_start)
        goals_text, goal_id_set = self._goals_text(goals)
        milestones_text, milestone_ids = self._milestones_text(milestones)
        english_text = self._english_text(english)

        today_weekday = today().weekday() + 1  # 1=周一 ... 7=周日
        # 单任务最少 25 分钟 → 任务数上限, 避免 AI 排太多导致总时长必然超标
        max_tasks = max(7, weekly_minutes // 25)
        prompt = WEEKLY_PLAN_PROMPT.format(
            profile=profile_text,
            weekly_minutes=weekly_minutes,
            max_tasks=max_tasks,
            today_weekday=today_weekday,
            skill_matrix=skill_matrix_text,
            english=english_text,
            week_goals=week_goals_text,
            goals=goals_text,
            skills=skill_matrix_text,
            milestones=milestones_text,
            last_week=last_week,
        )

        whitelist = {
            "goal": goal_id_set | week_goal_id_set,
            "skill": skill_ids,
            "milestone": milestone_ids,
            "english": {ENGLISH_SOURCE_ID},
        }
        snapshot = {
            "weekStart": week_start.isoformat(),
            "weekEnd": week_end.isoformat(),
            "weeklyMinutes": weekly_minutes,
            "weekGoalIds": sorted(week_goal_id_set),
            "goalIds": sorted(goal_id_set),
            "skillIds": sorted(skill_ids),
            "english": english,
            "skillMatrix": [
                {
                    "skillId": skill.id,
                    "name": skill.name,
                    "status": us.learning_status,
                    "currentLevel": us.current_level,
                    "targetLevel": us.target_level,
                    "weeklyMinutesSpent": minutes,
                }
                for skill, us, minutes in skill_rows
            ],
        }
        return prompt, whitelist, snapshot

    # ── 档案 ──────────────────────────────────────────────────────────

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

    # ── ① 技能矩阵 ───────────────────────────────────────────────────

    def _skill_matrix(self, user_id: str, week_start: date) -> list[tuple[Skill, UserSkill, int]]:
        """返回 (skill, user_skill, 本周已投入分钟数).

        排序: 正在学的排前面（gap 大的优先）, 已掌握的排后面.
        """
        rows = (
            self.db.query(Skill, UserSkill)
            .join(UserSkill, UserSkill.skill_id == Skill.id)
            .filter(UserSkill.user_id == user_id)
            .all()
        )

        # 本周每个技能已安排的分钟数（用于提示 AI 不要重复加重）
        spent_rows = (
            self.db.query(PlanTask.skill_id, PlanTask.estimated_minutes)
            .join(WeeklyPlan, WeeklyPlan.id == PlanTask.plan_id)
            .filter(
                WeeklyPlan.user_id == user_id,
                WeeklyPlan.week_start == week_start,
                PlanTask.skill_id.isnot(None),
            )
            .all()
        )
        spent: dict[str, int] = {}
        for skill_id, minutes in spent_rows:
            spent[skill_id] = spent.get(skill_id, 0) + (minutes or 0)

        def rank(item: tuple[Skill, UserSkill]) -> tuple:
            skill, us = item
            learning = 0 if (us.learning_status or "learning") == "learning" else 1
            gap = us.target_level - us.current_level
            return (learning, -gap, us.current_level)

        rows.sort(key=rank)
        return [(skill, us, spent.get(skill.id, 0)) for skill, us in rows]

    def _skill_matrix_text(self, rows: list[tuple[Skill, UserSkill, int]]) -> tuple[str, set[str]]:
        if not rows:
            return "（技能矩阵为空, 请优先安排通用职业能力提升）", set()
        lines = []
        ids: set[str] = set()
        for skill, us, minutes in rows:
            ids.add(skill.id)
            status = us.learning_status or "learning"
            gap = us.target_level - us.current_level
            confidence = f"{us.confidence:.0%}" if us.confidence else "—"
            notes = (us.notes or "").strip().replace("\n", " ")[:60]
            lines.append(
                f"- id={skill.id} | {skill.name} [分类:{skill.category}] "
                f"status={status} 已学 L{us.current_level} → 目标 L{us.target_level} 差距 {gap} "
                f"信心 {confidence} 本周已排 {minutes} 分钟"
                + (f" 备注:{notes}" if notes else "")
            )
        return "\n".join(lines), ids

    # ── ② 英语学习 ───────────────────────────────────────────────────

    def _english_snapshot(self, user_id: str, week_start: date) -> dict[str, Any]:
        """汇总英语学习进度: 词书 / SRS 状态分布 / 到期复习 / 打卡 / 听力."""
        statuses = (
            self.db.query(UserWord.status, UserWord.book_id)
            .filter(UserWord.user_id == user_id)
            .all()
        )
        if not statuses:
            return {"active": False}

        by_book: dict[str, dict[str, int]] = {}
        for status, book_id in statuses:
            bucket = by_book.setdefault(book_id, {"new": 0, "learning": 0, "review": 0, "mastered": 0})
            key = status if status in bucket else "new"
            bucket[key] += 1

        books = []
        for book_id, counts in by_book.items():
            book = self.db.query(WordBook).filter(WordBook.id == book_id).first()
            if book is None:
                continue
            learned = counts["mastered"] + counts["learning"] + counts["review"]
            due = (
                self.db.query(UserWord)
                .filter(
                    UserWord.user_id == user_id,
                    UserWord.book_id == book_id,
                    UserWord.due_date <= today(),
                    UserWord.status.in_(["learning", "review"]),
                )
                .count()
            )
            again = (
                self.db.query(UserWord)
                .filter(
                    UserWord.user_id == user_id,
                    UserWord.book_id == book_id,
                    UserWord.status == "learning",
                    UserWord.repetitions == 0,
                )
                .count()
            )
            books.append(
                {
                    "bookId": book.id,
                    "name": book.name,
                    "level": book.level,
                    "totalWords": book.total_words,
                    "newCount": counts["new"],
                    "learningCount": counts["learning"] + counts["review"],
                    "masteredCount": counts["mastered"],
                    "learnedCount": learned,
                    "progressPercent": round(learned * 100 / book.total_words) if book.total_words else 0,
                    "dueCount": due,
                    "againCount": again,
                }
            )
        books.sort(key=lambda b: (-b["learnedCount"], b["name"]))

        # 本周学习时长 / 词量
        sessions = (
            self.db.query(EnglishStudySession)
            .filter(
                EnglishStudySession.user_id == user_id,
                EnglishStudySession.session_date >= week_start,
            )
            .all()
        )
        minutes_this_week = sum(s.duration_minutes or 0 for s in sessions)
        new_words_this_week = sum(s.new_words or 0 for s in sessions)
        review_words_this_week = sum(s.review_words or 0 for s in sessions)

        # 连续打卡天数
        streak = 0
        cursor = today()
        recent_dates = {
            s.session_date
            for s in self.db.query(EnglishStudySession)
            .filter(EnglishStudySession.user_id == user_id)
            .all()
        }
        while cursor in recent_dates:
            streak += 1
            cursor -= timedelta(days=1)

        # 近 7 天复习量与正确率
        reviews_7d = (
            self.db.query(WordReviewLog)
            .filter(
                WordReviewLog.user_id == user_id,
                WordReviewLog.reviewed_at >= today() - timedelta(days=7),
            )
            .count()
        )
        attempts = (
            self.db.query(ListeningAttempt)
            .filter(ListeningAttempt.user_id == user_id)
            .all()
        )
        listening_total = len(attempts)
        listening_correct = sum(1 for a in attempts if a.is_correct)
        listening_accuracy = round(listening_correct * 100 / listening_total) if listening_total else None

        primary = books[0] if books else None
        suggested_daily_new = 15
        if primary and primary["totalWords"]:
            total = primary["totalWords"]
            suggested_daily_new = 10 if total <= 50 else 12 if total <= 100 else 15 if total <= 200 else 20

        return {
            "active": True,
            "books": books,
            "streakDays": streak,
            "minutesThisWeek": minutes_this_week,
            "newWordsThisWeek": new_words_this_week,
            "reviewWordsThisWeek": review_words_this_week,
            "reviewsLast7Days": reviews_7d,
            "listeningTotal": listening_total,
            "listeningAccuracy": listening_accuracy,
            "suggestedDailyNewWords": suggested_daily_new,
        }

    def _english_text(self, snap: dict[str, Any]) -> str:
        if not snap.get("active"):
            return "暂无英语学习记录（用户还没有开始背单词，本周不要编造英语任务）"
        lines = [
            f"连续打卡: {snap['streakDays']} 天 | 本周已学 {snap['minutesThisWeek']} 分钟 "
            f"(新词 {snap['newWordsThisWeek']} / 复习 {snap['reviewWordsThisWeek']}) | 近7天复习 {snap['reviewsLast7Days']} 次",
        ]
        if snap["listeningTotal"]:
            lines.append(f"听力: 共答 {snap['listeningTotal']} 题, 正确率 {snap['listeningAccuracy']}%")
        else:
            lines.append("听力: 暂无练习记录")
        lines.append(f"建议每日新词量: {snap['suggestedDailyNewWords']} 词")
        lines.append("正在背的词书:")
        for b in snap["books"]:
            lines.append(
                f"- {b['name']}({b['level']}) 进度 {b['progressPercent']}% "
                f"[{b['learnedCount']}/{b['totalWords']}] "
                f"已掌握 {b['masteredCount']} 学习中 {b['learningCount']} 未学 {b['newCount']} "
                f"今日到期复习 {b['dueCount']} 需重背 {b['againCount']}"
            )
        return "\n".join(lines)

    # ── ③ 本周内到期的人生目标 ────────────────────────────────────────

    def _week_goals(self, user_id: str, week_start: date, week_end: date) -> tuple[list[LifeGoal], list[GoalTask]]:
        """本周内到期的人生目标 + 本周内到期的目标子任务."""
        goals = (
            self.db.query(LifeGoal)
            .filter(
                LifeGoal.user_id == user_id,
                LifeGoal.status.in_(["pending", "in_progress"]),
                LifeGoal.target_date.isnot(None),
                LifeGoal.target_date >= week_start,
                LifeGoal.target_date <= week_end,
            )
            .order_by(LifeGoal.target_date)
            .all()
        )
        goal_ids = {g.id for g in goals}
        sub_tasks = (
            self.db.query(GoalTask)
            .filter(
                GoalTask.user_id == user_id,
                GoalTask.status != "done",
                GoalTask.due_date.isnot(None),
                GoalTask.due_date >= week_start,
                GoalTask.due_date <= week_end,
            )
            .order_by(GoalTask.due_date)
            .all()
        )
        # 子任务所属目标也视为本周目标（即便目标本身截止日不在本周）
        extra_ids = {t.life_goal_id for t in sub_tasks if t.life_goal_id and t.life_goal_id not in goal_ids}
        if extra_ids:
            goals = list(goals) + (
                self.db.query(LifeGoal)
                .filter(LifeGoal.user_id == user_id, LifeGoal.id.in_(extra_ids))
                .all()
            )
        return goals, sub_tasks

    def _week_goals_text(
        self,
        goals: list[LifeGoal],
        sub_tasks: list[GoalTask],
        week_start: date,
    ) -> tuple[str, set[str]]:
        if not goals:
            return "（本周没有到期的人生目标）", set()
        sub_by_goal: dict[str, list[GoalTask]] = {}
        for t in sub_tasks:
            if t.life_goal_id:
                sub_by_goal.setdefault(t.life_goal_id, []).append(t)

        lines = []
        ids: set[str] = set()
        for g in goals:
            ids.add(g.id)
            deadline = g.target_date.isoformat() if g.target_date else "无截止"
            weekday = (g.target_date - week_start).days + 1 if g.target_date else 7
            desc = (g.description or "").strip().replace("\n", " ")[:80]
            lines.append(
                f"- id={g.id} | {g.title} [分类:{g.category} 状态:{g.status} "
                f"截止:{deadline} (本周第{weekday}天)] {desc}"
            )
            for t in sub_by_goal.get(g.id, []):
                due = t.due_date.isoformat() if t.due_date else "无"
                lines.append(f"    · 待办子任务: {t.title} (截止 {due})")
        return "\n".join(lines), ids

    # ── ④ 其他目标 / 里程碑 ──────────────────────────────────────────

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

    def _active_milestones(self, user_id: str, limit: int = 5) -> list[RoadmapMilestone]:
        return (
            self.db.query(RoadmapMilestone)
            .filter(RoadmapMilestone.user_id == user_id, RoadmapMilestone.status.in_(["planned", "in_progress"]))
            .order_by(RoadmapMilestone.sort_order, RoadmapMilestone.target_date)
            .limit(limit)
            .all()
        )

    def _last_week_summary(self, user_id: str) -> str:
        last_week_start = today() - timedelta(days=today().weekday() + 7)
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
        undone = [t.title for t in tasks if t.status != "done"][:5]
        text = (
            f"上周共 {len(tasks)} 个任务, 完成 {done} 个; "
            f"投入 {done_minutes}/{total_minutes} 分钟"
        )
        if undone:
            text += f"; 未完成: {'、'.join(undone)}（本周优先补上或明确放弃）"
        return text

    def _goals_text(self, goals: list[LifeGoal]) -> tuple[str, set[str]]:
        if not goals:
            return "（暂无其他进行中的目标）", set()
        lines = []
        ids: set[str] = set()
        for g in goals:
            ids.add(g.id)
            deadline = g.target_date.isoformat() if g.target_date else "无截止"
            desc = (g.description or "").strip().replace("\n", " ")[:80]
            lines.append(f"- id={g.id} | {g.title} [分类:{g.category} 状态:{g.status} 截止:{deadline}] {desc}")
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
    """调用 AI 生成本周详细计划, 含本周目标/英语任务兜底与 fallback."""

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
        week_end = week_start + timedelta(days=6)

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

        prompt, whitelist, snapshot = self.context.build(
            user_id, weekly_minutes, week_start, goal_ids=goal_ids
        )
        priority_skill_rows = (
            self.db.query(Skill)
            .filter(Skill.id.in_(priority_skills or []))
            .all()
        )
        whitelist["skill"].update(skill.id for skill in priority_skill_rows)

        week_goals, week_sub_tasks = self.context._week_goals(user_id, week_start, week_end)

        ai_ok = False
        used_goal_ids: set[str] = set()
        used_skill_ids: set[str] = set()
        has_english_task = False
        try:
            ai = get_ai_provider()
            raw = await ai.complete(
                [
                    {"role": "system", "content": prompt},
                    {
                        "role": "user",
                        "content": f"请基于上面的档案生成本周（{week_start.isoformat()} 开始）计划，严格输出 JSON",
                    },
                ],
                response_format="json_object",
                temperature=0.5,
                max_tokens=4000,
            )
            logger.info("Weekly plan AI response length: %d", len(raw or ""))
            parsed = extract_json(raw)
            if parsed is None:
                logger.warning("Weekly plan: extract_json returned None. Raw: %s", (raw or "")[:500])
                raise AppError(code="AI_OUTPUT_INVALID", message="AI output is not valid JSON", status=422)
            used_goal_ids, used_skill_ids, has_english_task = self._persist_ai_plan(
                plan, parsed, whitelist, user_id, ai_generated=True
            )
            plan.ai_generated = True
            plan.ai_content_id = None  # 不强制落 ai_content, 减少 DB 写入
            ai_ok = True
        except Exception as exc:
            # fallback: 占位计划
            logger.error("Weekly plan AI failed, using fallback: %s", exc, exc_info=True)
            self._fallback_plan(plan, user_id, weekly_minutes, priority_skills or [])
            plan.ai_generated = False
            used_goal_ids = set(plan.goal_ids or [])
            used_skill_ids = set(plan.skill_ids or [])

        # ── 硬保证: 本周内到期的人生目标必须出现在周计划里 ──
        self._ensure_week_goals(plan, week_goals, week_sub_tasks, used_goal_ids, user_id, week_start)

        # ── 硬保证: 有在背词书时, 周计划里必须有英语任务 ──
        english_snapshot = snapshot.get("english") or {}
        if english_snapshot.get("active") and not has_english_task:
            self._ensure_english_task(plan, english_snapshot, user_id, ai_generated=ai_ok)

        plan.goal_ids = sorted(used_goal_ids)
        plan.skill_ids = sorted(used_skill_ids)

        # 时长预算兜底: AI 常常超排, 这里确定性压回预算内（不调 AI, 保证同输入同输出）
        trimmed = enforce_budget(self.db, plan, weekly_minutes)
        snapshot["budgetTrimmedMinutes"] = trimmed
        plan.context_snapshot = snapshot

        # 重算统计 + 落库
        self._recompute_stats(plan)
        plan.title = plan.title or "本周计划"
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
    ) -> tuple[set[str], set[str], bool]:
        """落库 AI 任务, 返回 (用到的 goal_id 集合, skill_id 集合, 是否含英语任务)."""
        plan.title = (parsed.get("title") or "本周计划").strip()[:200]
        plan.weekly_focus = (parsed.get("weeklyFocus") or "").strip() or None
        plan.rationale = (parsed.get("rationale") or "").strip() or None
        tips = parsed.get("tips") or []
        plan.tips = [str(t).strip() for t in tips if str(t).strip()][:6]

        used_goal_ids: set[str] = set()
        used_skill_ids: set[str] = set()
        has_english_task = False
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
            life_goal_id, skill_id, milestone_id, is_english = self._resolve_source(
                source_type, source_id, whitelist
            )
            if life_goal_id:
                used_goal_ids.add(life_goal_id)
            if skill_id:
                used_skill_ids.add(skill_id)
            if is_english:
                has_english_task = True

            # 单任务 25-120 分钟（与 prompt 规则一致, 保证预算可控）
            estimated = int(task.get("estimatedMinutes") or 60)
            estimated = max(25, min(estimated, 120))
            task_type = self._norm_enum(task.get("taskType"), TASK_TYPES, "learning")
            if is_english and task_type not in {"english", "review"}:
                task_type = "english"

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
                    task_type=task_type,
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

        return used_goal_ids, used_skill_ids, has_english_task

    def _resolve_source(
        self,
        source_type: str,
        source_id: str,
        whitelist: dict[str, set[str]],
    ) -> tuple[str | None, str | None, str | None, bool]:
        """校验 sourceId 是否在白名单内, 不在则丢弃 (None).

        返回 (life_goal_id, skill_id, milestone_id, is_english).
        """
        if not source_id:
            return None, None, None, False
        if source_type == "goal" and source_id in whitelist["goal"]:
            return source_id, None, None, False
        if source_type == "skill" and source_id in whitelist["skill"]:
            return None, source_id, None, False
        if source_type == "milestone" and source_id in whitelist["milestone"]:
            return None, None, source_id, False
        if source_type == "english" and source_id in whitelist["english"]:
            return None, None, None, True
        return None, None, None, False

    def _norm_enum(self, value: Any, allowed: set[str], default: str) -> str:
        v = str(value or "").strip().lower()
        return v if v in allowed else default

    # ── 兜底注入 ─────────────────────────────────────────────────────

    def _ensure_week_goals(
        self,
        plan: WeeklyPlan,
        week_goals: list[LifeGoal],
        week_sub_tasks: list[GoalTask],
        covered: set[str],
        user_id: str,
        week_start: date,
    ) -> None:
        """本周内到期的人生目标若 AI 没覆盖, 由后端强制补任务, 保证一定出现在周计划里."""
        if not week_goals:
            return
        self.db.flush()
        sort_base = self.db.query(PlanTask).filter(PlanTask.plan_id == plan.id).count()

        for goal in week_goals:
            if goal.id in covered:
                continue
            # 排在截止日对应的周内天数, 没有截止日则排周六
            day = (goal.target_date - week_start).days + 1 if goal.target_date else 6
            day = max(1, min(day, 7))
            sub_titles = [t.title for t in week_sub_tasks if t.life_goal_id == goal.id][:2]
            detail = f"优先完成: {'、'.join(sub_titles)}" if sub_titles else (goal.description or "推进该目标的关键一步")[:120]
            deadline = goal.target_date.isoformat() if goal.target_date else "本周内"
            self.db.add(
                PlanTask(
                    plan_id=plan.id,
                    user_id=user_id,
                    title=f"推进目标: {goal.title}",
                    day=day,
                    estimated_minutes=60,
                    status="todo",
                    sort_order=sort_base,
                    description=f"为什么做: 该目标截止日是 {deadline}, 就在本周内, 必须推进否则会逾期。\n怎么做: {detail}",
                    task_type="project",
                    difficulty="medium",
                    priority="high",
                    ai_generated=False,
                    estimated_outcome=f"让「{goal.title}」在本周截止前往前推进一步",
                    life_goal_id=goal.id,
                )
            )
            covered.add(goal.id)
            sort_base += 1

    def _ensure_english_task(
        self,
        plan: WeeklyPlan,
        english: dict[str, Any],
        user_id: str,
        ai_generated: bool,
    ) -> None:
        """有在背词书但 AI 没排英语任务时, 后端补一组每日英语任务."""
        books = english.get("books") or []
        if not books:
            return
        self.db.flush()
        primary = books[0]
        daily_new = english.get("suggestedDailyNewWords") or 15
        due = primary.get("dueCount") or 0
        again = primary.get("againCount") or 0
        sort_base = self.db.query(PlanTask).filter(PlanTask.plan_id == plan.id).count()
        name = primary.get("name") or "当前词书"

        for idx, day in enumerate((1, 2, 3, 4, 5, 6)):
            review_count = max(due // 3, again, 10)
            self.db.add(
                PlanTask(
                    plan_id=plan.id,
                    user_id=user_id,
                    title=f"英语: 新学 {daily_new} 词 + 复习 {review_count} 词（{name}）",
                    day=day,
                    estimated_minutes=30,
                    status="todo",
                    sort_order=sort_base + idx,
                    description=(
                        f"为什么做: {name} 已学 {primary.get('learnedCount')}/{primary.get('totalWords')} 词"
                        f"（{primary.get('progressPercent')}%），需要保持每天的输入与复习节奏。\n"
                        f"怎么做: 先清掉 {again} 个上次不会的词和 {due} 个到期词，再新学 {daily_new} 个新词。"
                    ),
                    task_type="english",
                    difficulty="easy",
                    priority="medium",
                    ai_generated=ai_generated,
                    estimated_outcome=f"新增 {daily_new} 个进入记忆周期的词，清掉到期复习队列",
                )
            )

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
            .filter(UserSkill.user_id == user_id, UserSkill.learning_status == "learning")
            .order_by((UserSkill.target_level - UserSkill.current_level).desc())
            .first()
        )
        if skill_row is None:
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
        # Session 是 autoflush=False, 必须先 flush 才能统计到刚 add 的任务
        self.db.flush()
        tasks = self.db.query(PlanTask).filter(PlanTask.plan_id == plan.id).all()
        total = sum(t.estimated_minutes for t in tasks)
        done_minutes = sum(t.estimated_minutes for t in tasks if t.status == "done")
        done_count = sum(1 for t in tasks if t.status == "done")
        plan.total_minutes = total
        plan.completed_minutes = done_minutes
        plan.completion_rate = round(done_count / len(tasks), 4) if tasks else 0.0


def enforce_budget(db: Session, plan: WeeklyPlan, weekly_minutes: int) -> int:
    """把计划任务总时长压回 weekly_minutes 以内, 返回被削减的分钟数.

    削减顺序: 先削低优先级的长任务, 每个任务最低保留 30 分钟。
    纯确定性逻辑, 不调 AI。
    """
    # Session 是 autoflush=False, 必须先 flush 才能查到刚 add 的任务
    db.flush()
    tasks = db.query(PlanTask).filter(PlanTask.plan_id == plan.id).all()
    total = sum(t.estimated_minutes for t in tasks)
    if total <= weekly_minutes:
        return 0

    excess = total - weekly_minutes
    rank = {"low": 0, "medium": 1, "high": 2}
    ordered = sorted(
        tasks,
        key=lambda t: (rank.get(t.priority or "medium", 1), -t.estimated_minutes),
    )
    trimmed = 0
    for task in ordered:
        if excess <= 0:
            break
        reducible = task.estimated_minutes - 30
        if reducible <= 0:
            continue
        cut = min(reducible, excess)
        task.estimated_minutes -= cut
        excess -= cut
        trimmed += cut
    return trimmed


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
        task.completed_at = today()

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
    difficulty: str | None = None,
    task_type: str | None = None,
    estimated_outcome: str | None = None,
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
    if difficulty is not None and difficulty in DIFFICULTIES:
        task.difficulty = difficulty
    if task_type is not None and task_type in TASK_TYPES:
        task.task_type = task_type
    if estimated_outcome is not None:
        task.estimated_outcome = estimated_outcome.strip()[:200] or None
    # 用户手改过的任务不再标记为纯 AI 生成
    if any(v is not None for v in (title, day, difficulty, task_type, estimated_minutes)):
        task.ai_generated = False
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
    # Session 是 autoflush=False, 必须先 flush 才能统计到刚 add 的任务
    db.flush()
    tasks = db.query(PlanTask).filter(PlanTask.plan_id == plan.id).all()
    total = sum(t.estimated_minutes for t in tasks)
    done_minutes = sum(t.estimated_minutes for t in tasks if t.status == "done")
    done_count = sum(1 for t in tasks if t.status == "done")
    plan.total_minutes = total
    plan.completed_minutes = done_minutes
    plan.completion_rate = round(done_count / len(tasks), 4) if tasks else 0.0


# ────────────────────────── 每日总结与反思 ──────────────────────────


def _day_index(target: date) -> int:
    """周一=1 … 周日=7，与 PlanTask.day 对齐。"""
    return target.weekday() + 1


def daily_task_stats(db: Session, user_id: str, target: date) -> dict:
    """某一天的任务统计（取该天所属周计划里 day 相同的任务）。"""
    week_start = target - timedelta(days=target.weekday())
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == user_id, WeeklyPlan.week_start == week_start)
        .first()
    )
    if plan is None:
        return {"totalTasks": 0, "doneTasks": 0, "plannedMinutes": 0, "doneMinutes": 0}
    tasks = (
        db.query(PlanTask)
        .filter(PlanTask.plan_id == plan.id, PlanTask.day == _day_index(target))
        .all()
    )
    done = [t for t in tasks if t.status == "done"]
    return {
        "totalTasks": len(tasks),
        "doneTasks": len(done),
        "plannedMinutes": sum(t.estimated_minutes or 0 for t in tasks),
        "doneMinutes": sum(t.estimated_minutes or 0 for t in done),
    }


def get_daily_review(db: Session, user_id: str, target: date) -> DailyReview | None:
    return (
        db.query(DailyReview)
        .filter(DailyReview.user_id == user_id, DailyReview.review_date == target)
        .first()
    )


def daily_review_dict(db: Session, user_id: str, target: date) -> dict:
    row = get_daily_review(db, user_id, target)
    stats = daily_task_stats(db, user_id, target)
    return {
        "date": target.isoformat(),
        "summary": row.summary if row else None,
        "reflection": row.reflection if row else None,
        "mood": row.mood if row else None,
        "updatedAt": row.updated_at.isoformat() if (row and row.updated_at) else None,
        "stats": stats,
    }


def upsert_daily_review(
    db: Session,
    user_id: str,
    target: date,
    *,
    summary: str | None = None,
    reflection: str | None = None,
    mood: int | None = None,
) -> DailyReview:
    row = get_daily_review(db, user_id, target)
    if row is None:
        row = DailyReview(user_id=user_id, review_date=target)
        db.add(row)
    if summary is not None:
        row.summary = summary.strip() or None
    if reflection is not None:
        row.reflection = reflection.strip() or None
    if mood is not None:
        row.mood = max(1, min(5, int(mood))) if mood else None
    stats = daily_task_stats(db, user_id, target)
    row.total_tasks = stats["totalTasks"]
    row.done_tasks = stats["doneTasks"]
    row.planned_minutes = stats["plannedMinutes"]
    row.done_minutes = stats["doneMinutes"]
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


def list_daily_reviews(db: Session, user_id: str, days: int = 30) -> list[dict]:
    """最近 N 天（含今天）的每日记录，供成长分析/日历使用。"""
    end = today()
    start = end - timedelta(days=max(1, days) - 1)
    rows = (
        db.query(DailyReview)
        .filter(
            DailyReview.user_id == user_id,
            DailyReview.review_date >= start,
            DailyReview.review_date <= end,
        )
        .order_by(DailyReview.review_date.desc())
        .all()
    )
    by_date = {r.review_date: r for r in rows}
    result = []
    for offset in range(max(1, days)):
        day = end - timedelta(days=offset)
        row = by_date.get(day)
        if row is not None:
            result.append(
                {
                    "date": day.isoformat(),
                    "summary": row.summary,
                    "reflection": row.reflection,
                    "mood": row.mood,
                    "totalTasks": row.total_tasks or 0,
                    "doneTasks": row.done_tasks or 0,
                    "plannedMinutes": row.planned_minutes or 0,
                    "doneMinutes": row.done_minutes or 0,
                    "hasReview": bool(row.summary or row.reflection),
                }
            )
        else:
            stats = daily_task_stats(db, user_id, day)
            result.append(
                {
                    "date": day.isoformat(),
                    "summary": None,
                    "reflection": None,
                    "mood": None,
                    **stats,
                    "hasReview": False,
                }
            )
    return result
