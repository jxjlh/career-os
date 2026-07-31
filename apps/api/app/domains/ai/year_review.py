from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import GoalTask
from app.domains.ai.prompts.year_review import YEAR_REVIEW_PROMPT
from app.domains.ai.schemas import YearReviewRequest, YearReviewResponse
from app.domains.ai.service import AIService
from app.domains.life.repository import (
    LifeGoalRepository,
    LifeRecordRepository,
    UserLevelRepository,
)


class YearReviewService:
    """Aggregates a user's yearly life data and generates an AI year report."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)
        self.records = LifeRecordRepository(db)
        self.levels = UserLevelRepository(db)

    async def generate(self, user_id: str, payload: YearReviewRequest) -> YearReviewResponse:
        style = payload.style or "personal"
        cached = self._find_cached(user_id, payload.year, style)
        if cached is not None:
            return self._to_response(cached, cached.output_json or {}, payload.year)

        context = self._build_context(user_id, payload.year)
        context["style"] = style
        prompt = YEAR_REVIEW_PROMPT.format(style=style)
        record, parsed = await self.ai.generate_content(
            user_id=user_id,
            content_type="year_review",
            input_data=context,
            prompt=prompt,
        )
        return self._to_response(record, parsed, payload.year)

    def _find_cached(self, user_id: str, year: int, style: str):
        for content in self.ai.repository.list_by_type(user_id, "year_review", limit=50):
            meta = content.input_json or {}
            if meta.get("year") == year and meta.get("style", "personal") == style:
                return content
        return None

    def _build_context(self, user_id: str, year: int) -> dict:
        goals = [
            goal
            for goal in self.goals.list_by_user(user_id)
            if goal.created_at is not None and goal.created_at.year == year
        ]
        completed_goals = [goal for goal in goals if goal.status == "completed"]

        category_stats: dict[str, int] = {}
        for goal in goals:
            category_stats[goal.category] = category_stats.get(goal.category, 0) + 1

        records = [
            record
            for record in self.records.list_by_user(user_id)
            if record.created_at is not None and record.created_at.year == year
        ]
        cities = {(record.country, record.city) for record in records if record.country or record.city}
        goal_titles = {goal.id: goal.title for goal in self.goals.list_by_user(user_id)}
        memories = []
        for record in sorted(records, key=lambda item: item.created_at, reverse=True)[:5]:
            memories.append(
                {
                    "title": goal_titles.get(record.goal_id) or "人生记录",
                    "description": " ".join(filter(None, [record.content, record.city, record.country]))
                    or "记录了一个特别的时刻",
                    "date": record.created_at.date().isoformat() if record.created_at else None,
                }
            )

        start = datetime(year, 1, 1)
        end = datetime(year + 1, 1, 1)
        tasks = (
            self.db.query(GoalTask)
            .filter(
                GoalTask.user_id == user_id,
                GoalTask.created_at >= start,
                GoalTask.created_at < end,
            )
            .all()
        )
        completed_tasks = sum(1 for task in tasks if task.status == "done")
        task_total = len(tasks)

        level = self.levels.get_by_user(user_id)
        if level is None:
            level = self.levels.create(user_id)

        return {
            "user_id": user_id,
            "year": year,
            "goals": {
                "total": len(goals),
                "completed": len(completed_goals),
                "by_category": category_stats,
                "completed_titles": [goal.title for goal in completed_goals],
            },
            "tasks": {
                "total": task_total,
                "completed": completed_tasks,
                "completion_rate": round(completed_tasks * 100 / task_total) if task_total else 0,
            },
            "records": {
                "count": len(records),
                "cities_visited": [f"{country or ''} {city or ''}".strip() for country, city in cities if country or city],
                "memories": memories,
            },
            "level": {"xp": level.experience, "level": level.level},
        }

    def _to_response(self, content, parsed: dict, year: int) -> YearReviewResponse:
        return YearReviewResponse(
            id=content.id,
            aiContentId=content.id,
            year=year,
            title=parsed.get("title"),
            summary=parsed.get("summary"),
            statistics=parsed.get("statistics") or {},
            achievements=parsed.get("achievements") or [],
            growth=parsed.get("growth") or {},
            memories=parsed.get("memories") or [],
            reflection=parsed.get("reflection"),
            nextYearPlan=parsed.get("next_year_plan") or [],
        )
