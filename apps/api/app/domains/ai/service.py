import json
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import AIContent, GoalTask
from app.domains.ai.prompts.growth_plan import GROWTH_PLAN_PROMPT
from app.domains.ai.prompts.travel_plan import TRAVEL_PLAN_PROMPT
from app.domains.ai.prompts.year_summary import YEAR_SUMMARY_PROMPT
from app.domains.ai.repository import AIContentRepository
from app.domains.ai.schemas import (
    GenerateTasksResponse,
    GrowthPlanRequest,
    GrowthPlanResponse,
    TravelPlanRequest,
    TravelPlanResponse,
    YearSummaryRequest,
    YearSummaryResponse,
)
from app.domains.life.repository import (
    LifeGoalRepository,
    LifeRecordRepository,
    UserLevelRepository,
)
from app.providers.ai.base import AIProvider, extract_json
from app.providers.ai.registry import get_ai_provider


class AIService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = AIContentRepository(db)

    async def generate_content(
        self,
        user_id: str,
        content_type: str,
        input_data: dict,
        prompt: str,
        provider: AIProvider | None = None,
        model: str | None = None,
    ) -> tuple[AIContent, dict]:
        ai = provider or get_ai_provider()
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps(input_data, ensure_ascii=False)},
        ]
        try:
            raw = await ai.complete(messages, response_format="json_object", temperature=0.4)
        except Exception as exc:
            raise AppError(code="AI_PROVIDER_ERROR", message=str(exc), status=502) from exc

        parsed = extract_json(raw)
        if parsed is None:
            raise AppError(code="AI_OUTPUT_INVALID", message="AI output is not valid JSON", status=422)

        record = self.repository.create(
            user_id=user_id,
            content_type=content_type,
            input_json=input_data,
            output_json=parsed,
            provider=ai.name,
            model=model or getattr(ai, "model", None) or "default",
        )
        return record, parsed


class TravelPlanService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)

    async def generate(self, user_id: str, payload: TravelPlanRequest) -> TravelPlanResponse:
        if payload.goal_id and self.goals.get_owned(user_id, payload.goal_id) is None:
            raise AppError(code="NOT_FOUND", message="Life goal not found", status=404)
        input_data = payload.model_dump()
        prompt = TRAVEL_PLAN_PROMPT.format(
            destination=payload.destination,
            days=payload.days,
            budget=payload.budget or "未指定",
            people=payload.people or "未指定",
            interests="、".join(payload.interests) or "未指定",
        )
        record, parsed = await self.ai.generate_content(
            user_id=user_id,
            content_type="travel_plan",
            input_data=input_data,
            prompt=prompt,
        )
        return TravelPlanResponse(
            id=record.id,
            aiContentId=record.id,
            title=parsed.get("title"),
            summary=parsed.get("summary"),
            bestTime=parsed.get("best_time"),
            route=parsed.get("route") or [],
            preparation=parsed.get("preparation") or [],
            tips=parsed.get("tips") or [],
        )


class GrowthPlanService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)

    async def generate(self, user_id: str, payload: GrowthPlanRequest) -> GrowthPlanResponse:
        if payload.goal_id and self.goals.get_owned(user_id, payload.goal_id) is None:
            raise AppError(code="NOT_FOUND", message="Life goal not found", status=404)
        input_data = {
            "goal_id": payload.goal_id,
            "goal_title": payload.goal_title,
            "target_description": payload.target_description,
            "available_time": payload.available_time,
            "difficulty": payload.difficulty,
        }
        prompt = GROWTH_PLAN_PROMPT.format(
            target_description=payload.target_description,
            current_status=payload.current_status or "未说明",
            available_time=payload.available_time or "未说明",
            difficulty=payload.difficulty or "medium",
        )
        record, parsed = await self.ai.generate_content(
            user_id=user_id,
            content_type="growth_plan",
            input_data=input_data,
            prompt=prompt,
        )
        return GrowthPlanResponse(
            id=record.id,
            aiContentId=record.id,
            title=parsed.get("title"),
            summary=parsed.get("summary"),
            phases=parsed.get("phases") or [],
            dailyPlan=parsed.get("daily_plan") or [],
            milestones=parsed.get("milestones") or [],
            tips=parsed.get("tips") or [],
        )


class GrowthTaskGeneratorService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIContentRepository(db)
        self.goals = LifeGoalRepository(db)

    def generate(self, user_id: str, ai_content_id: str) -> GenerateTasksResponse:
        content = self.ai.get_by_id(user_id, ai_content_id)
        if content is None:
            raise AppError(code="NOT_FOUND", message="AI content not found", status=404)
        if content.task_generated:
            raise AppError(code="ALREADY_GENERATED", message="Tasks already generated for this plan", status=409)
        goal_id = (content.input_json or {}).get("goal_id")
        if not goal_id:
            raise AppError(code="MISSING_GOAL", message="Growth plan is not linked to a life goal", status=400)
        goal = self.goals.get_owned(user_id, goal_id)
        if goal is None:
            raise AppError(code="NOT_FOUND", message="Life goal not found", status=404)

        daily_plan = (content.output_json or {}).get("daily_plan") or []
        start = goal.start_date or date.today()
        task_ids: list[str] = []
        for entry in daily_plan:
            day = max(1, int(entry.get("day", 1)))
            for title in entry.get("tasks", []):
                task = GoalTask(
                    user_id=user_id,
                    goal_id=None,
                    life_goal_id=goal.id,
                    title=str(title),
                    task_type="daily",
                    due_date=start + timedelta(days=day - 1),
                    status="todo",
                )
                self.db.add(task)
                self.db.flush()
                task_ids.append(task.id)
        content.task_generated = True
        self.db.commit()
        return GenerateTasksResponse(createdCount=len(task_ids), taskIds=task_ids)


class YearSummaryService:
    """Generates an AI year summary from completed goals, records and XP."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)
        self.records = LifeRecordRepository(db)
        self.levels = UserLevelRepository(db)

    async def generate(self, user_id: str, payload: YearSummaryRequest) -> YearSummaryResponse:
        year = payload.year or date.today().year
        completed = self._completed_goals(user_id, year)
        records = self._records(user_id, year)
        level = self.levels.get_by_user(user_id)
        if level is None:
            level = self.levels.create(user_id)

        goal_lines = "；".join(f"{goal.title}（{goal.category}）" for goal in completed) or "暂无"
        record_lines = []
        for record in records:
            location = " ".join(filter(None, [record.country, record.city]))
            when = record.created_at.date().isoformat() if record.created_at else ""
            record_lines.append(" ".join(filter(None, [when, location, record.content])))

        input_data = {
            "user_id": user_id,
            "year": year,
            "completed_goals": [
                {
                    "title": goal.title,
                    "category": goal.category,
                    "completed_at": goal.updated_at.isoformat() if goal.updated_at else None,
                }
                for goal in completed
            ],
            "records": [
                {
                    "content": record.content,
                    "location": " ".join(filter(None, [record.country, record.city])),
                    "created_at": record.created_at.isoformat() if record.created_at else None,
                }
                for record in records
            ],
            "xp": level.experience,
            "level": level.level,
        }
        prompt = YEAR_SUMMARY_PROMPT.format(
            year=year,
            completed_goals=goal_lines or "暂无",
            life_records="；".join(record_lines) or "暂无",
            xp=level.experience,
            level=level.level,
        )
        record, parsed = await self.ai.generate_content(
            user_id=user_id,
            content_type="year_summary",
            input_data=input_data,
            prompt=prompt,
        )
        return self._to_response(record, parsed, year)

    def get_latest(self, user_id: str, year: int | None = None) -> YearSummaryResponse | None:
        for content in self.ai.repository.list_by_type(user_id, "year_summary", limit=50):
            saved_year = (content.input_json or {}).get("year")
            if year is not None and saved_year != year:
                continue
            return self._to_response(content, content.output_json or {}, saved_year)
        return None

    def _completed_goals(self, user_id: str, year: int) -> list:
        return [
            goal
            for goal in self.goals.list_by_user(user_id)
            if goal.status == "completed" and goal.updated_at is not None and goal.updated_at.year == year
        ]

    def _records(self, user_id: str, year: int) -> list:
        return [
            record
            for record in self.records.list_by_user(user_id)
            if record.created_at is not None and record.created_at.year == year
        ]

    def _to_response(self, content, parsed: dict, year: int) -> YearSummaryResponse:
        return YearSummaryResponse(
            id=content.id,
            aiContentId=content.id,
            year=year,
            title=parsed.get("title"),
            summary=parsed.get("summary"),
            highlights=parsed.get("highlights") or [],
            growth=parsed.get("growth") or {},
            versions=parsed.get("versions") or {},
            createdAt=content.created_at.isoformat() if content.created_at else None,
        )
