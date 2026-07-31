from app.core.config import get_settings
from app.providers.search.base import SearchProvider
from app.providers.search.bing_provider import BingProvider
from app.providers.search.exa_provider import ExaProvider
from app.providers.search.github_provider import GitHubProvider
from app.providers.search.google_provider import GoogleSearchProvider
from app.providers.search.mock_provider import MockSearchProvider
from app.providers.search.tavily_provider import TavilyProvider
from app.providers.search.wikipedia_provider import WikipediaProvider
from app.providers.search.youtube_provider import YouTubeProvider


def get_search_providers() -> list[SearchProvider]:
    settings = get_settings()
    providers = [WikipediaProvider(), GitHubProvider()]
    if settings.tavily_api_key:
        providers.append(TavilyProvider())
    if settings.exa_api_key:
        providers.append(ExaProvider())
    if settings.google_search_api_key and settings.google_search_cx:
        providers.append(GoogleSearchProvider())
    if settings.bing_api_key:
        providers.append(BingProvider())
    if settings.youtube_api_key:
        providers.append(YouTubeProvider())
    if settings.app_env == "dev":
        providers.append(MockSearchProvider())
    return providers


def get_provider_list() -> list[dict[str, object]]:
    return [
        {
            "name": provider.name,
            "capabilities": sorted(provider.capabilities),
            "enabled": True,
        }
        for provider in get_search_providers()
    ]
