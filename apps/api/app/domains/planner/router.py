"""Planner 路由 - AI 周计划生成 + 任务执行 + 复盘."""

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.core.security import get_current_user
from app.core.timeutil import today, week_start
from app.db.models import (
    LifeGoal,
    PlanTask,
    Profile,
    ReadingBook,
    RoadmapMilestone,
    Skill,
    UserSkill,
    WeeklyPlan,
)
from app.domains.planner.service import (
    PlannerService,
    daily_review_dict,
    delete_task,
    list_daily_reviews,
    submit_review,
    toggle_task,
    update_task,
    upsert_daily_review,
)

router = APIRouter(tags=["planner"])


# ─────────────────────────────── Schemas ───────────────────────────────


class GeneratePlanRequest(BaseModel):
    weekStart: date | None = None
    weeklyStudyMinutes: int = 420
    prioritySkills: list[str] = []
    goalIds: list[str] = []  # 用户选择的目标 ID 列表


class ManualTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    day: int = Field(default=1, ge=1, le=7)
    estimatedMinutes: int = Field(default=60, ge=10, le=600)
    notes: str | None = None
    skillId: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    day: int | None = Field(default=None, ge=1, le=7)
    estimatedMinutes: int | None = Field(default=None, ge=10, le=600)
    priority: str | None = None  # low/medium/high
    difficulty: str | None = None  # easy/medium/hard
    taskType: str | None = None  # learning/practice/project/review/english/reading/rest
    estimatedOutcome: str | None = Field(default=None, max_length=200)
    notes: str | None = None


class ReviewRequest(BaseModel):
    summary: str | None = None
    reflection: str | None = None


class DailyReviewUpdate(BaseModel):
    """每日总结 + 反思 + 心情（一天一条，多端同步）。"""

    summary: str | None = None
    reflection: str | None = None
    mood: int | None = Field(default=None, ge=0, le=5)  # 1-5 心情；0 或 null = 不改/清空


# ─────────────────────────────── Helpers ───────────────────────────────


def _week_start(day: date | None = None) -> date:
    """周一为一周起点，按用户时区计算（服务器是 UTC，直接用 date.today() 会跨周错位）。"""
    return week_start(day)


def _today() -> date:
    return today()


def _goal_lookup(db: Session, user_id: str) -> dict[str, str]:
    rows = db.query(LifeGoal).filter(LifeGoal.user_id == user_id).all()
    return {g.id: g.title for g in rows}


def _week_goals_payload(db: Session, user_id: str, week_start: date) -> list[dict]:
    """本周内到期的人生目标 + 其本周到期子任务, 供前端在周计划页顶部展示."""
    week_end = week_start + timedelta(days=6)
    from app.db.models import GoalTask

    goals = (
        db.query(LifeGoal)
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
    sub_tasks = (
        db.query(GoalTask)
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
    goal_ids = {g.id for g in goals}
    extra_ids = {t.life_goal_id for t in sub_tasks if t.life_goal_id and t.life_goal_id not in goal_ids}
    if extra_ids:
        goals = list(goals) + db.query(LifeGoal).filter(LifeGoal.id.in_(extra_ids)).all()

    result = []
    for g in goals:
        result.append(
            {
                "id": g.id,
                "title": g.title,
                "category": g.category,
                "status": g.status,
                "targetDate": g.target_date.isoformat() if g.target_date else None,
                "dayIndex": (g.target_date - week_start).days + 1 if g.target_date else None,
                "daysLeft": (g.target_date - today()).days if g.target_date else None,
                "subTasks": [
                    {
                        "id": t.id,
                        "title": t.title,
                        "dueDate": t.due_date.isoformat() if t.due_date else None,
                        "status": t.status,
                    }
                    for t in sub_tasks
                    if t.life_goal_id == g.id
                ],
            }
        )
    return result


def _skill_lookup(db: Session, user_id: str) -> dict[str, str]:
    """返回该用户所有相关技能 (按 user_skills 关联), 供前端展示标签."""
    from app.db.models import UserSkill

    rows = (
        db.query(Skill)
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .filter(UserSkill.user_id == user_id)
        .all()
    )
    return {s.id: s.name for s in rows}


def _milestone_lookup(db: Session, user_id: str) -> dict[str, str]:
    rows = db.query(RoadmapMilestone).filter(RoadmapMilestone.user_id == user_id).all()
    return {m.id: m.title for m in rows}


def _task_dict(
    t: PlanTask,
    goals: dict[str, str],
    skills: dict[str, str],
    milestones: dict[str, str],
) -> dict:
    goal_id = t.life_goal_id or t.goal_id
    return {
        "id": t.id,
        "title": t.title,
        "day": t.day,
        "estimatedMinutes": t.estimated_minutes,
        "resourceId": t.resource_id,
        "status": t.status,
        "sortOrder": t.sort_order,
        "notes": t.notes,
        # 新字段
        "description": t.description,
        "taskType": t.task_type,
        "difficulty": t.difficulty,
        "priority": t.priority,
        "aiGenerated": t.ai_generated,
        "resourceUrl": t.resource_url,
        "estimatedOutcome": t.estimated_outcome,
        "completedAt": t.completed_at.isoformat() if t.completed_at else None,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
        # 关联标签 (供前端展示 #目标名)
        "goalId": goal_id,
        "goalName": goals.get(goal_id) if goal_id else None,
        "skillId": t.skill_id,
        "skillName": skills.get(t.skill_id) if t.skill_id else None,
        "milestoneId": t.milestone_id,
        "milestoneName": milestones.get(t.milestone_id) if t.milestone_id else None,
    }


def _plan_dict(db: Session, plan: WeeklyPlan) -> dict:
    tasks = (
        db.query(PlanTask)
        .filter(PlanTask.plan_id == plan.id)
        .order_by(PlanTask.day, PlanTask.sort_order)
        .all()
    )
    user_id = plan.user_id
    goals = _goal_lookup(db, user_id)
    skills = _skill_lookup(db, user_id)
    milestones = _milestone_lookup(db, user_id)
    return {
        "id": plan.id,
        "weekStart": plan.week_start.isoformat(),
        "title": plan.title,
        "status": plan.status,
        "aiGenerated": plan.ai_generated,
        "weeklyFocus": plan.weekly_focus,
        "rationale": plan.rationale,
        "tips": plan.tips or [],
        "summary": plan.summary,
        "reflection": plan.reflection,
        "completionRate": plan.completion_rate,
        "totalTasks": len(tasks),
        "completedTasks": sum(1 for t in tasks if t.status == "done"),
        "totalMinutes": plan.total_minutes,
        "completedMinutes": plan.completed_minutes,
        "weeklyMinutesBudget": (plan.context_snapshot or {}).get("weeklyMinutes"),
        "goalIds": plan.goal_ids or [],
        "skillIds": plan.skill_ids or [],
        # 本周内到期的人生目标（硬性要进周计划的内容）
        "weekGoals": _week_goals_payload(db, user_id, plan.week_start),
        # 本次生成时的上下文快照（技能矩阵 / 英语进度）
        "contextSnapshot": plan.context_snapshot or {},
        "tasks": [_task_dict(t, goals, skills, milestones) for t in tasks],
    }


# ─────────────────────────────── Endpoints ───────────────────────────────


@router.get("/planner/current")
def current_plan(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    start = _week_start()
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id, WeeklyPlan.week_start == start)
        .order_by(WeeklyPlan.created_at.desc())
        .first()
    )
    if plan is None:
        plan = WeeklyPlan(user_id=current_user.id, week_start=start, title="本周计划", status="draft")
        db.add(plan)
        db.commit()
        db.refresh(plan)
    return {"data": _plan_dict(db, plan)}


@router.get("/planner/weeks")
def list_recent_weeks(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(16, ge=2, le=52),
    includeEmpty: bool = Query(True),
) -> dict:
    """近 N 周的周计划摘要（按周升序）, 供日历与历史完成率可视化使用.

    includeEmpty=True 时会补上没有计划的周（completionRate=0）, 这样图表是连续的一段。
    """
    current_start = _week_start()
    earliest = current_start - timedelta(weeks=limit - 1)
    plans = (
        db.query(WeeklyPlan)
        .filter(
            WeeklyPlan.user_id == current_user.id,
            WeeklyPlan.week_start >= earliest,
            WeeklyPlan.week_start <= current_start,
        )
        .all()
    )
    by_start = {p.week_start: p for p in plans}
    plan_ids = [p.id for p in plans]
    tasks = db.query(PlanTask).filter(PlanTask.plan_id.in_(plan_ids)).all() if plan_ids else []
    tasks_by_plan: dict[str, list[PlanTask]] = {}
    for t in tasks:
        tasks_by_plan.setdefault(t.plan_id, []).append(t)

    items: list[dict] = []
    for offset in range(limit - 1, -1, -1):
        ws = current_start - timedelta(weeks=offset)
        plan = by_start.get(ws)
        if plan is None:
            if not includeEmpty:
                continue
            items.append(
                {
                    "weekStart": ws.isoformat(),
                    "weekEnd": (ws + timedelta(days=6)).isoformat(),
                    "title": None,
                    "status": "empty",
                    "aiGenerated": False,
                    "totalTasks": 0,
                    "completedTasks": 0,
                    "completionRate": 0.0,
                    "totalMinutes": 0,
                    "completedMinutes": 0,
                    "weeklyFocus": None,
                    "isCurrent": offset == 0,
                    "taskTypes": {},
                }
            )
            continue

        plan_tasks = tasks_by_plan.get(plan.id, [])
        type_counts: dict[str, int] = {}
        for t in plan_tasks:
            key = t.task_type or "learning"
            type_counts[key] = type_counts.get(key, 0) + 1
        items.append(
            {
                "weekStart": ws.isoformat(),
                "weekEnd": (ws + timedelta(days=6)).isoformat(),
                "title": plan.title,
                "status": plan.status,
                "aiGenerated": plan.ai_generated,
                "totalTasks": len(plan_tasks),
                "completedTasks": sum(1 for t in plan_tasks if t.status == "done"),
                "completionRate": plan.completion_rate,
                "totalMinutes": plan.total_minutes,
                "completedMinutes": plan.completed_minutes,
                "weeklyFocus": plan.weekly_focus,
                "isCurrent": offset == 0,
                "taskTypes": type_counts,
            }
        )

    return {
        "data": items,
        "meta": {"currentWeekStart": current_start.isoformat(), "limit": limit},
    }


@router.get("/planner/week")
def week_plan(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    weekStart: date = Query(...),
) -> dict:
    """查指定周的计划（日历里点某周时用）. 该周没有计划时 data 返回 null."""
    start = weekStart - timedelta(days=weekStart.weekday())
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id, WeeklyPlan.week_start == start)
        .first()
    )
    if plan is None:
        return {"data": None, "meta": {"weekStart": start.isoformat(), "exists": False}}
    return {
        "data": _plan_dict(db, plan),
        "meta": {"weekStart": start.isoformat(), "exists": True},
    }


@router.post("/planner/generate")
async def generate_plan(
    payload: GeneratePlanRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    start = payload.weekStart or _week_start()
    priority_skills = payload.prioritySkills or [
        row.skill_id
        for row in (
            db.query(UserSkill)
            .filter(UserSkill.user_id == current_user.id, UserSkill.learning_status == "learning")
            .order_by((UserSkill.target_level - UserSkill.current_level).desc())
            .limit(5)
            .all()
        )
    ]
    plan = await PlannerService(db).generate(
        user_id=current_user.id,
        week_start=start,
        weekly_minutes=payload.weeklyStudyMinutes,
        priority_skills=priority_skills,
        goal_ids=payload.goalIds,
    )
    books = (
        db.query(ReadingBook)
        .filter(ReadingBook.user_id == current_user.id, ReadingBook.status.in_(["want", "reading", "unread"]))
        .order_by(ReadingBook.status == "reading", ReadingBook.updated_at.desc())
        .limit(2)
        .all()
    )
    db.flush()  # autoflush=False, 先 flush 才能数到刚落库的任务
    task_count = db.query(PlanTask).filter(PlanTask.plan_id == plan.id).count()
    for index, book in enumerate(books, start=1):
        remaining_pages = max((book.total_pages or 0) - book.current_page, 0)
        minutes = book.daily_minutes or max(20, min(45, payload.weeklyStudyMinutes // 14))
        db.add(
            PlanTask(
                plan_id=plan.id,
                user_id=current_user.id,
                title=f"阅读《{book.title}》",
                description=(f"本周推进约 {max(remaining_pages // 4, 10)} 页，记录一个可实践的观点。"),
                day=6 if index == 1 else 7,
                estimated_minutes=minutes,
                status="todo",
                sort_order=task_count + index,
                task_type="reading",
                difficulty="easy",
                priority="medium",
                ai_generated=True,
                resource_url=book.source_url,
                estimated_outcome="完成阅读记录并更新阅读进度",
            )
        )
    if books:
        plan.rationale = f"{plan.rationale or '已按想学技能生成学习任务。'} 同时加入 {len(books)} 本在读/想读书籍的阅读任务。"
    from app.domains.planner.service import _recompute_plan_stats, enforce_budget

    # 阅读任务也算进本周预算, 超了就按优先级削减（确定性逻辑, 不调 AI）
    enforce_budget(db, plan, payload.weeklyStudyMinutes)
    _recompute_plan_stats(db, plan)
    db.commit()
    return {"data": _plan_dict(db, plan)}


@router.post("/planner/tasks", status_code=201)
def add_manual_task(
    payload: ManualTaskCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """用户手动添加学习计划任务 (也可由 AI 教练同步)."""
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id, WeeklyPlan.week_start == _week_start())
        .first()
    )
    if plan is None:
        plan = WeeklyPlan(user_id=current_user.id, week_start=_week_start(), title="本周计划", status="active")
        db.add(plan)
        db.flush()
    task = PlanTask(
        plan_id=plan.id,
        user_id=current_user.id,
        title=payload.title,
        day=payload.day,
        estimated_minutes=payload.estimatedMinutes,
        status="todo",
        sort_order=db.query(PlanTask).filter(PlanTask.plan_id == plan.id).count() + 1,
        notes=payload.notes,
        skill_id=payload.skillId,
        ai_generated=False,
        task_type="learning",
        difficulty="medium",
        priority="medium",
    )
    db.add(task)
    plan.status = "active"
    # 重算 stats
    from app.domains.planner.service import _recompute_plan_stats

    _recompute_plan_stats(db, plan)
    db.commit()
    db.refresh(task)
    goals = _goal_lookup(db, current_user.id)
    skills = _skill_lookup(db, current_user.id)
    milestones = _milestone_lookup(db, current_user.id)
    return {"data": _task_dict(task, goals, skills, milestones)}


@router.patch("/planner/tasks/{task_id}/toggle")
def toggle_task_status(
    task_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """切换任务完成状态."""
    task = toggle_task(db, current_user.id, task_id)
    goals = _goal_lookup(db, current_user.id)
    skills = _skill_lookup(db, current_user.id)
    milestones = _milestone_lookup(db, current_user.id)
    return {"data": _task_dict(task, goals, skills, milestones)}


@router.patch("/planner/tasks/{task_id}")
def patch_task(
    task_id: str,
    payload: TaskUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """更新任务 priority/notes/estimated_minutes/title/day."""
    task = update_task(
        db,
        current_user.id,
        task_id,
        priority=payload.priority,
        notes=payload.notes,
        estimated_minutes=payload.estimatedMinutes,
        title=payload.title,
        day=payload.day,
        difficulty=payload.difficulty,
        task_type=payload.taskType,
        estimated_outcome=payload.estimatedOutcome,
    )
    goals = _goal_lookup(db, current_user.id)
    skills = _skill_lookup(db, current_user.id)
    milestones = _milestone_lookup(db, current_user.id)
    return {"data": _task_dict(task, goals, skills, milestones)}


@router.delete("/planner/tasks/{task_id}", status_code=204)
def remove_task(
    task_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    delete_task(db, current_user.id, task_id)


def _parse_date(value: str | None) -> date:
    if not value:
        return today()
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise AppError(code="INVALID_DATE", message="日期格式应为 YYYY-MM-DD", status=422) from exc


@router.get("/planner/daily")
def get_daily(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    date_: str | None = Query(default=None, alias="date"),
) -> dict:
    """读取某一天的总结/反思/心情 + 当天任务统计。缺省为今天。"""
    return {"data": daily_review_dict(db, current_user.id, _parse_date(date_))}


@router.put("/planner/daily")
def save_daily(
    payload: DailyReviewUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    date_: str | None = Query(default=None, alias="date"),
) -> dict:
    """写入（upsert）某一天的总结/反思/心情。"""
    upsert_daily_review(
        db,
        current_user.id,
        _parse_date(date_),
        summary=payload.summary,
        reflection=payload.reflection,
        mood=payload.mood,
    )
    return {"data": daily_review_dict(db, current_user.id, _parse_date(date_))}


@router.get("/planner/daily/range")
def list_daily(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    days: int = Query(default=30, ge=1, le=180),
) -> dict:
    """最近 N 天的每日记录（含任务统计），供成长分析与日历使用。"""
    return {"data": {"items": list_daily_reviews(db, current_user.id, days)}}


@router.post("/planner/{plan_id}/review")
def review_plan(
    plan_id: str,
    payload: ReviewRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """提交周总结 + 反思."""
    plan = submit_review(db, current_user.id, plan_id, payload.summary, payload.reflection)
    return {"data": _plan_dict(db, plan)}


@router.get("/planner/progress")
def planner_progress(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """返回本周进度概览 (供 Dashboard 使用).
    整合: 周计划任务完成率 + 人生目标进度 + 英语学习统计."""
    start = _week_start()
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id, WeeklyPlan.week_start == start)
        .first()
    )

    # ── 1. 周计划任务统计 ────────────────────────────────────────────
    if plan is None:
        plan_tasks_done = 0
        plan_tasks_total = 0
        plan_completion = 0.0
        plan_minutes_done = 0
        plan_minutes_total = 0
        today_tasks_count = 0
        today_done_count = 0
        plan_id = None
        plan_title = None
        weekly_focus = None
    else:
        plan_id = plan.id
        plan_title = plan.title
        weekly_focus = plan.weekly_focus
        today_weekday = today().weekday() + 1
        today_tasks = (
            db.query(PlanTask)
            .filter(PlanTask.plan_id == plan.id, PlanTask.day == today_weekday)
            .all()
        )
        today_done_count = sum(1 for t in today_tasks if t.status == "done")
        plan_tasks_total = db.query(PlanTask).filter(PlanTask.plan_id == plan.id).count()
        plan_tasks_done = (
            db.query(PlanTask)
            .filter(PlanTask.plan_id == plan.id, PlanTask.status == "done")
            .count()
        )
        plan_completion = plan.completion_rate
        plan_minutes_done = plan.completed_minutes
        plan_minutes_total = plan.total_minutes
        today_tasks_count = len(today_tasks)

    # ── 2. 人生目标进度 ──────────────────────────────────────────────
    from app.db.models import GoalTask, LifeGoal

    active_goals = (
        db.query(LifeGoal)
        .filter(LifeGoal.user_id == current_user.id, LifeGoal.status != "completed")
        .order_by(LifeGoal.created_at.desc())
        .limit(5)
        .all()
    )
    completed_goals_count = (
        db.query(LifeGoal)
        .filter(LifeGoal.user_id == current_user.id, LifeGoal.status == "completed")
        .count()
    )
    total_goals_count = (
        db.query(LifeGoal)
        .filter(LifeGoal.user_id == current_user.id)
        .count()
    )

    goal_progress_items = []
    for g in active_goals:
        # 查询该目标下的任务完成情况
        tasks_done = (
            db.query(GoalTask)
            .filter(GoalTask.life_goal_id == g.id, GoalTask.status == "done")
            .count()
        )
        tasks_total = (
            db.query(GoalTask)
            .filter(GoalTask.life_goal_id == g.id)
            .count()
        )
        goal_progress_items.append({
            "id": g.id,
            "title": g.title,
            "category": g.category,
            "status": g.status,
            "tasksDone": tasks_done,
            "tasksTotal": tasks_total,
            "progress": (tasks_done / tasks_total * 100) if tasks_total > 0 else (100 if g.status == "completed" else 0),
        })

    # ── 3. 英语学习统计 ──────────────────────────────────────────────
    from app.db.models import UserWord, WordReviewLog, StudySession

    # 本周学习单词数 (新增 + 复习)
    week_start_date = start
    words_learned_this_week = (
        db.query(WordReviewLog)
        .filter(
            WordReviewLog.user_id == current_user.id,
            WordReviewLog.reviewed_at >= week_start_date,
        )
        .count()
    )

    # 本周学习时长 (分钟)
    study_sessions_this_week = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == current_user.id,
            StudySession.started_at >= week_start_date,
        )
        .all()
    )
    study_minutes_this_week = sum(s.duration_minutes or 0 for s in study_sessions_this_week)

    # 掌握单词总数
    total_mastered_words = (
        db.query(UserWord)
        .filter(UserWord.user_id == current_user.id, UserWord.status == "mastered")
        .count()
    )

    # ── 4. 综合进度 ──────────────────────────────────────────────────
    # 综合 = 周计划完成率 * 0.5 + 人生目标进度 * 0.3 + 学习活跃度 * 0.2
    goal_avg_progress = (
        sum(g["progress"] for g in goal_progress_items) / len(goal_progress_items)
        if goal_progress_items
        else 0
    )
    study_activity = min(100, (words_learned_this_week / 50) * 100)  # 50词/周为满分
    overall_completion = (
        plan_completion * 0.5 + goal_avg_progress / 100 * 0.3 + study_activity / 100 * 0.2
    )

    return {
        "data": {
            # 周计划
            "planId": plan_id,
            "title": plan_title,
            "weekStart": start.isoformat(),
            "completionRate": overall_completion,  # 综合完成率
            "planCompletionRate": plan_completion,   # 仅周计划
            "completedTasks": plan_tasks_done,
            "totalTasks": plan_tasks_total,
            "completedMinutes": plan_minutes_done,
            "totalMinutes": plan_minutes_total,
            "todayTasks": today_tasks_count,
            "todayDone": today_done_count,
            "weeklyFocus": weekly_focus,
            # 人生目标
            "goals": goal_progress_items,
            "goalsCompleted": completed_goals_count,
            "goalsTotal": total_goals_count,
            "goalsActive": len(active_goals),
            # 学习统计
            "wordsLearnedThisWeek": words_learned_this_week,
            "studyMinutesThisWeek": study_minutes_this_week,
            "totalMasteredWords": total_mastered_words,
        }
    }
