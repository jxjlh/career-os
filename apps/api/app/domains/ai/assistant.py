from datetime import date

from sqlalchemy.orm import Session

from app.db.models import GoalTask
from app.domains.ai.prompts.life_assistant import LIFE_ASSISTANT_PROMPT
from app.domains.ai.schemas import LifeAssistantResponse
from app.domains.ai.service import AIService
from app.domains.life.repository import (
    LifeGoalRepository,
    LifeRecordRepository,
    UserLevelRepository,
)


class LifeAssistantService:
    """Builds today's AI life advice from the user's life data.

    The result is cached per user per day to avoid repeated provider calls.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)
        self.levels = UserLevelRepository(db)
        self.records = LifeRecordRepository(db)

    async def daily(self, user_id: str) -> LifeAssistantResponse:
        today = date.today()
        cached = self.ai.repository.get_latest_by_type(user_id, "life_assistant")
        if cached is not None and cached.created_at is not None and cached.created_at.date() == today:
            state = self._load_state(user_id)
            return self._build_response(cached.output_json or {}, state)

        state = self._load_state(user_id)
        _, parsed = await self.ai.generate_content(
            user_id=user_id,
            content_type="life_assistant",
            input_data=state["input"],
            prompt=LIFE_ASSISTANT_PROMPT.format(**state["prompt"]),
        )
        return self._build_response(parsed, state)

    def _load_state(self, user_id: str) -> dict:
        today = date.today()
        goal = self.goals.get_active(user_id)
        level = self.levels.get_by_user(user_id)
        if level is None:
            level = self.levels.create(user_id)
        records = self.records.list_recent_by_user(user_id, 5)

        tasks = self._goal_tasks(user_id, goal.id) if goal else []
        today_tasks = sorted(
            (
                task
                for task in tasks
                if task.status != "done" and task.due_date is not None and task.due_date <= today
            ),
            key=lambda task: task.due_date,
        )
        completed = sum(1 for task in tasks if task.status == "done")
        total = len(tasks)
        progress = round(completed * 100 / total) if total else 0

        recent_lines = []
        for record in records:
            recent_lines.append(" ".join(filter(None, [record.content, record.city, record.country])))

        goal_payload = None
        if goal is not None:
            goal_payload = {
                "id": goal.id,
                "title": goal.title,
                "category": goal.category,
                "status": goal.status,
                "progress": progress,
            }

        return {
            "goal": goal_payload,
            "today_tasks": today_tasks,
            "completed": completed,
            "total": total,
            "progress": progress,
            "level": level,
            "input": {
                "user_id": user_id,
                "date": today.isoformat(),
                "goal": goal_payload,
                "tasks": {
                    "total": total,
                    "completed": completed,
                    "today": [task.title for task in today_tasks],
                },
                "level": level.level,
                "experience": level.experience,
                "recent_records": recent_lines,
            },
            "prompt": {
                "goal_title": goal.title if goal else "尚未设定人生目标",
                "goal_progress": f"{progress}%",
                "today_tasks": "、".join(task.title for task in today_tasks) or "暂无今日任务",
                "completed_tasks": completed,
                "total_tasks": total,
                "level": level.level,
                "xp": level.experience,
                "recent_records": "；".join(recent_lines) or "暂无记录",
            },
        }

    def _goal_tasks(self, user_id: str, life_goal_id: str) -> list[GoalTask]:
        return (
            self.db.query(GoalTask)
            .filter(GoalTask.user_id == user_id, GoalTask.life_goal_id == life_goal_id)
            .order_by(GoalTask.due_date, GoalTask.created_at)
            .all()
        )

    def _build_response(self, parsed: dict, state: dict) -> LifeAssistantResponse:
        if state["goal"] is None:
            focus = {"title": "尚未设定人生目标", "reason": "创建一个人生目标，让 AI 为你规划下一步"}
        else:
            focus = dict(parsed.get("focus_goal") or {})
            focus.setdefault("title", state["goal"]["title"])
        focus["progress"] = f"{state['progress']}%"

        suggestions = list(parsed.get("today_focus") or []) + list(parsed.get("suggestions") or [])
        return LifeAssistantResponse(
            greeting=parsed.get("greeting"),
            focusGoal=focus,
            todayTasks=[
                {
                    "id": task.id,
                    "title": task.title,
                    "priority": "high" if task.status == "in_progress" else "medium",
                }
                for task in state["today_tasks"]
            ],
            progress={
                "completedTasks": state["completed"],
                "totalTasks": state["total"],
                "level": state["level"].level,
                "xp": state["level"].experience,
            },
            suggestions=suggestions[:6],
            motivation=parsed.get("motivation"),
            dailySummary=parsed.get("daily_summary"),
        )
