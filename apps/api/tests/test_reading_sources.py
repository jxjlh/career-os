import pytest

from app.domains.reading.sources import BOOK_SOURCE_SITES, search_book_sources


def test_reading_sources_include_requested_sites() -> None:
    assert [source.key for source in BOOK_SOURCE_SITES] == [
        "jiumodiary",
        "zlibrary",
        "gutenberg",
        "libgen",
        "free_ebooks",
    ]
    assert {source.domain for source in BOOK_SOURCE_SITES} == {
        "jiumodiary.com",
        "zlibrary-sg.se",
        "gutenberg.org",
        "libgen.ee",
        "free-ebooks.net",
    }


@pytest.mark.asyncio
async def test_search_book_sources_keeps_source_metadata_and_filters_domains(monkeypatch) -> None:
    async def fake_search_ddg_lite(*, query, limit, language, site, provider_name, source_name_override):
        return [
            {
                "title": f"{source_name_override} - {query}",
                "url": f"https://{site}/ebooks/example",
                "snippet": "完整书籍来源",
                "source_name": source_name_override,
                "provider": provider_name,
            },
            {
                "title": "外部误匹配",
                "url": "https://example.com/not-a-book-source",
                "snippet": "不应返回",
                "source_name": source_name_override,
                "provider": provider_name,
            },
        ]

    monkeypatch.setattr("app.domains.reading.sources.search_ddg_lite", fake_search_ddg_lite)

    result = await search_book_sources("The Hobbit", limit=3, language="en")

    assert len(result["items"]) == 5
    assert {item["sourceKey"] for item in result["items"]} == {
        "jiumodiary",
        "zlibrary",
        "gutenberg",
        "libgen",
        "free_ebooks",
    }
    assert all(item["isBookSource"] is True for item in result["items"])
    assert all("example.com" not in item["url"] for item in result["items"])
    assert len(result["sources"]) == 5
    assert all(source["status"] == "succeeded" for source in result["sources"])
