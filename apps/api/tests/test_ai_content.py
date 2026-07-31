import asyncio

from app.core.database import SessionLocal
from app.domains.ai.repository import AIContentRepository
from app.domains.ai.service import AIService

DEV_USER = "00000000-0000-0000-0000-000000000001"
OTHER_USER = "00000000-0000-0000-0000-000000000002"


class FakeAI:
    name = "openai"
    model = "gpt-test"

    async def complete(self, messages, response_format=None, **kwargs):
        return '{"title":"西藏旅行计划","days":7}'


def test_ai_content_create_and_isolate() -> None:
    async def run() -> None:
        db = SessionLocal()
        try:
            service = AIService(db)
            record, parsed = await service.generate_content(
                user_id=DEV_USER,
                content_type="travel_plan",
                input_data={"destination": "西藏", "days": 7},
                prompt="你是专业旅行规划师",
                provider=FakeAI(),
            )
            assert parsed["title"] == "西藏旅行计划"

            repository = AIContentRepository(db)
            found = repository.get_by_id(DEV_USER, record.id)
            assert found is not None
            assert found.output_json["days"] == 7

            other = repository.get_by_id(OTHER_USER, record.id)
            assert other is None

            by_type = repository.list_by_type(DEV_USER, "travel_plan")
            assert any(item.id == record.id for item in by_type)
        finally:
            db.close()

    asyncio.run(run())
