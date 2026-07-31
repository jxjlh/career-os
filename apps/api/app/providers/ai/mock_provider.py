from app.providers.ai.base import AIProvider


class MockAIProvider(AIProvider):
    name = "mock"

    async def complete(self, messages, response_format=None, **kwargs) -> str:
        last = messages[-1].get("content", "") if messages else ""
        return f"（开发模式示例回复）我收到了你的问题：{last[:80]}。正式版将接入讯飞星火 Spark-X2-Flash。"

    async def healthcheck(self) -> bool:
        return True
