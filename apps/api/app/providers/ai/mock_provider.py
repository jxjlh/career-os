from app.providers.ai.base import AIProvider


class MockAIProvider(AIProvider):
    name = "mock"

    async def complete(self, messages, response_format=None, **kwargs) -> str:
        last = messages[-1].get("content", "") if messages else ""
        if response_format == "json_object":
            return (
                '{"analysis":"基于当前数据给出的开发模式分析。",'
                '"content":"基于当前数据给出的开发模式分析。",'
                '"summary":"开发模式摘要",'
                '"advice":[{"title":"记录今日瞬间","detail":"保持记录习惯"}],'
                '"title":"开发模式复盘",'
                '"highlights":["当前处于开发模式"],'
                '"suggestions":["继续使用真实 AI 配置后生成个性化内容"],'
                '"reflection":"以上内容为开发模式示例。",'
                '"metrics":{}}'
            )
        return f"（开发模式示例回复）我收到了你的问题：{last[:80]}。正式版将接入讯飞星火 Spark-X2-Flash。"

    async def healthcheck(self) -> bool:
        return True
