import json

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import AIContent
from app.domains.ai.repository import AIContentRepository
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
