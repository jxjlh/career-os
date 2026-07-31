from app.core.config import get_settings
from app.providers.ai.anthropic_provider import AnthropicProvider
from app.providers.ai.base import AIProvider
from app.providers.ai.gemini_provider import GeminiProvider
from app.providers.ai.mock_provider import MockAIProvider
from app.providers.ai.openai_provider import OpenAIProvider
from app.providers.ai.xfyun_provider import XfyunSparkProvider


def get_ai_provider() -> AIProvider:
    settings = get_settings()
    if settings.xfyun_api_key and settings.xfyun_api_secret:
        return XfyunSparkProvider()
    if settings.openai_api_key:
        return OpenAIProvider()
    if settings.anthropic_api_key:
        return AnthropicProvider()
    if settings.gemini_api_key:
        return GeminiProvider()
    return MockAIProvider()
