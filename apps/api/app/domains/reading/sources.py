"""指定阅读来源的聚合搜索。只保存来源链接，不下载或镜像第三方文件。"""

import asyncio
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from app.providers.search.duckduckgo_provider import search_ddg_lite


@dataclass(frozen=True)
class BookSourceSite:
    key: str
    name: str
    domain: str
    homepage: str


BOOK_SOURCE_SITES = (
    BookSourceSite("jiumodiary", "九摩电子书", "jiumodiary.com", "https://www.jiumodiary.com/"),
    BookSourceSite("zlibrary", "Z-Library", "zlibrary-sg.se", "https://zlibrary-sg.se/"),
    BookSourceSite("gutenberg", "Project Gutenberg", "gutenberg.org", "https://www.gutenberg.org/"),
    BookSourceSite("libgen", "LibGen", "libgen.ee", "https://libgen.ee/"),
    BookSourceSite("free_ebooks", "Free-Ebooks.net", "free-ebooks.net", "https://www.free-ebooks.net/"),
)


def _belongs_to_source(url: str, domain: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    except ValueError:
        return False
    return host == domain or host.endswith(f".{domain}")


async def _search_one_source(
    source: BookSourceSite,
    query: str,
    limit: int,
    language: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    try:
        raw_results = await search_ddg_lite(
            query=f'"{query}" full book ebook',
            limit=limit,
            language=language,
            site=source.domain,
            provider_name=f"book_source:{source.key}",
            source_name_override=source.name,
        )
        results = []
        for item in raw_results:
            url = item.get("url", "")
            if not _belongs_to_source(url, source.domain):
                continue
            results.append(
                {
                    **item,
                    "sourceKey": source.key,
                    "sourceName": source.name,
                    "sourceHomepage": source.homepage,
                    "isBookSource": True,
                    "isComplete": False,
                }
            )
        return (
            {
                "key": source.key,
                "name": source.name,
                "domain": source.domain,
                "homepage": source.homepage,
                "status": "succeeded",
                "resultCount": len(results),
            },
            results,
        )
    except Exception as exc:  # pragma: no cover - network/provider boundary
        return (
            {
                "key": source.key,
                "name": source.name,
                "domain": source.domain,
                "homepage": source.homepage,
                "status": "failed",
                "resultCount": 0,
                "error": str(exc),
            },
            [],
        )


async def search_book_sources(query: str, limit: int = 10, language: str = "zh") -> dict[str, Any]:
    responses = await asyncio.gather(
        *(_search_one_source(source, query, limit, language) for source in BOOK_SOURCE_SITES)
    )
    sources = [source for source, _ in responses]
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for _, source_items in responses:
        for item in source_items:
            url = item["url"].rstrip("/")
            if url in seen:
                continue
            seen.add(url)
            items.append(item)
    return {"items": items, "sources": sources}
