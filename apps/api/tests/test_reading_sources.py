from types import SimpleNamespace

import pytest

import app.domains.reading.sources as sources


@pytest.mark.asyncio
async def test_search_book_sources_keeps_exact_metadata_match(monkeypatch) -> None:
    """Open Library returns docs; exact title matches must be kept with metadata."""
    payload = {
        "docs": [
            {
                "key": "/works/OL12345W",
                "title": "Deep Work",
                "author_name": ["Cal Newport"],
                "isbn": ["9781455586691"],
                "cover_i": 12345,
                "first_sentence": ["An engaging read about focus."],
            },
            {
                "key": "/works/OL99999W",
                "title": "食谱大全",
                "author_name": ["某人"],
            },
        ]
    }

    class Client:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return False
        async def get(self, *args, **kwargs):
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: payload)

    monkeypatch.setattr(sources.httpx, "AsyncClient", lambda **kwargs: Client())
    result = await sources.search_book_sources("Deep Work")

    assert [item["title"] for item in result["items"]] == ["Deep Work"]
    assert result["items"][0]["author"] == "Cal Newport"
    assert result["items"][0]["isExactMatch"] is True
    assert result["items"][0]["isbn"] == "9781455586691"
    assert result["items"][0]["sourceKey"] == "open_library"


@pytest.mark.asyncio
async def test_search_book_sources_requires_matching_author_when_query_includes_one(monkeypatch) -> None:
    """When query includes author, only author-matching docs must be returned."""
    payload = {
        "docs": [
            {
                "key": "/works/OL11111W",
                "title": "Deep Work",
                "author_name": ["Another Author"],
            },
            {
                "key": "/works/OL22222W",
                "title": "Deep Work",
                "author_name": ["Cal Newport"],
                "isbn": ["9781455586691"],
            },
        ]
    }

    class Client:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return False
        async def get(self, *args, **kwargs):
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: payload)

    monkeypatch.setattr(sources.httpx, "AsyncClient", lambda **kwargs: Client())
    result = await sources.search_book_sources("Deep Work - Cal Newport")

    assert [item["id"] for item in result["items"]] == ["/works/OL22222W"]
    assert result["items"][0]["isExactMatch"] is True
    assert result["items"][0]["author"] == "Cal Newport"
