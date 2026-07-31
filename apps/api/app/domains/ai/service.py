import json

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import AIContent
from app.domains.ai.prompts.travel_plan import TRAVEL_PLAN_PROMPT
from app.domains.ai.repository import AIContentRepository
from app.domains.ai.schemas import TravelPlanRequest, TravelPlanResponse
from app.domains.life.repository import LifeGoalRepository
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
