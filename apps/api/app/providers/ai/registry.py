from app.core.config import get_settings
from app.providers.ai.anthropic_provider import AnthropicProvider
from app.providers.ai.base import AIProvider
from app.providers.ai.deepseek_provider import DeepSeekProvider
from app.providers.ai.gemini_provider import GeminiProvider
from app.providers.ai.mock_provider import MockAIProvider
from app.providers.ai.openai_provider import OpenAIProvider
from app.providers.ai.xfyun_provider import XfyunSparkProvider


def get_ai_provider() -> AIProvider:
    settings = get_settings()
    # DeepSeek 优先：性价比高、支持 JSON mode、响应快
    if settings.finance_ai_api_key:
        return DeepSeekProvider()
    if settings.openai_api_key:
        return OpenAIProvider()
    if settings.xfyun_api_key and settings.xfyun_api_secret:
        return XfyunSparkProvider()
    if settings.anthropic_api_key:
        return AnthropicProvider()
    if settings.gemini_api_key:
        return GeminiProvider()
    return MockAIProvider()


def get_jd_ai_provider() -> AIProvider:
    return get_jd_ai_providers()[0]


def get_jd_ai_providers() -> list[AIProvider]:
    settings = get_settings()
    providers: list[AIProvider] = []
    if settings.jd_ai_api_key:
        providers.append(
            DeepSeekProvider(
                api_key=settings.jd_ai_api_key,
                base_url=settings.jd_ai_base_url or settings.openai_base_url,
                model=settings.jd_ai_model or settings.openai_model,
            )
        )
    primary = get_ai_provider()
    providers.append(primary)

    if settings.xfyun_api_key and settings.xfyun_api_secret and settings.xfyun_app_id:
        providers.append(XfyunSparkProvider())
    if settings.anthropic_api_key:
        providers.append(AnthropicProvider())
    if settings.gemini_api_key:
        providers.append(GeminiProvider())

    unique: list[AIProvider] = []
    seen: set[tuple[type[AIProvider], tuple[tuple[str, str], ...]]] = set()
    for provider in providers:
        configuration = tuple(
            sorted(
                (key, str(value))
                for key, value in vars(provider).items()
                if key in {"api_key", "base_url", "model", "api_secret", "app_id", "wss_url"}
            )
        )
        identity = (type(provider), configuration)
        if identity not in seen:
            unique.append(provider)
            seen.add(identity)
    return unique or [MockAIProvider()]
