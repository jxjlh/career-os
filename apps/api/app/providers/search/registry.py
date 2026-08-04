from app.core.config import get_settings
from app.providers.search.base import SearchProvider
from app.providers.search.bilibili_provider import BilibiliProvider
from app.providers.search.bing_provider import BingProvider
from app.providers.search.devto_provider import DevtoProvider
from app.providers.search.duckduckgo_provider import DuckDuckGoProvider
from app.providers.search.exa_provider import ExaProvider
from app.providers.search.github_provider import GitHubProvider
from app.providers.search.google_provider import GoogleSearchProvider
from app.providers.search.hackernews_provider import HackerNewsProvider
from app.providers.search.mock_provider import MockSearchProvider
from app.providers.search.stackoverflow_provider import StackOverflowProvider
from app.providers.search.tavily_provider import TavilyProvider
from app.providers.search.wikipedia_provider import WikipediaProvider
from app.providers.search.youtube_provider import YouTubeProvider


def get_search_providers() -> list[SearchProvider]:
    """返回启用的搜索源列表.

    默认 7 个免费无需 key 的 provider 全网搜索:
      - Wikipedia (百科知识)
      - GitHub (代码仓库/开源项目)
      - HackerNews (英文技术讨论)
      - Dev.to (英文技术博客)
      - DuckDuckGo (全网网页搜索, 含知乎/掘金/CSDN/B站等中文站点, 自动识别来源)
      - Bilibili (B站视频教程, 直接 API, 间歇风控时降级为空)
      - Stack Overflow (英文技术问答)
    有 API key 时追加 Tavily / Exa / Google / Bing / YouTube.
    """
    settings = get_settings()
    providers: list[SearchProvider] = [
        WikipediaProvider(),
        GitHubProvider(),
        HackerNewsProvider(),
        DevtoProvider(),
        DuckDuckGoProvider(),
        BilibiliProvider(),
        StackOverflowProvider(),
    ]
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
