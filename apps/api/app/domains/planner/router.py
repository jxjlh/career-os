"""Planner 路由 - AI 周计划生成 + 任务执行 + 复盘."""

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import LifeGoal, PlanTask, Profile, RoadmapMilestone, Skill, WeeklyPlan
from app.domains.planner.service import (
    PlannerService,
    delete_task,
    submit_review,
    toggle_task,
    update_task,
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


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    day: int | None = Field(default=None, ge=1, le=7)
    estimatedMinutes: int | None = Field(default=None, ge=10, le=600)
    priority: str | None = None  # low/medium/high
    notes: str | None = None


class ReviewRequest(BaseModel):
    summary: str | None = None
    reflection: str | None = None


# ─────────────────────────────── Helpers ───────────────────────────────


def _week_start(day: date | None = None) -> date:
    target = day or date.today()
    return target - timedelta(days=target.weekday())


def _goal_lookup(db: Session, user_id: str) -> dict[str, str]:
    rows = db.query(LifeGoal).filter(LifeGoal.user_id == user_id).all()
    return {g.id: g.title for g in rows}


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
        "totalMinutes": plan.total_minutes,
        "completedMinutes": plan.completed_minutes,
        "goalIds": plan.goal_ids or [],
        "skillIds": plan.skill_ids or [],
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


@router.post("/planner/generate")
async def generate_plan(
    payload: GeneratePlanRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    start = payload.weekStart or _week_start()
    plan = await PlannerService(db).generate(
        user_id=current_user.id,
        week_start=start,
        weekly_minutes=payload.weeklyStudyMinutes,
        priority_skills=payload.prioritySkills,
        goal_ids=payload.goalIds,
    )
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
        today_weekday = date.today().weekday() + 1
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
