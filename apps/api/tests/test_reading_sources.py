from types import SimpleNamespace

import pytest

import app.domains.reading.sources as sources


@pytest.mark.asyncio
async def test_search_book_sources_keeps_exact_metadata_match_and_download_url(monkeypatch) -> None:
    payload = {
        "items": [
            {
                "id": "exact",
                "volumeInfo": {
                    "title": "Deep Work",
                    "authors": ["Cal Newport"],
                    "industryIdentifiers": [{"type": "ISBN_13", "identifier": "9781455586691"}],
                    "infoLink": "https://books.example/deep-work",
                },
                "accessInfo": {"epub": {"isAvailable": True, "downloadLink": "https://books.example/deep-work.epub"}},
            },
            {"id": "wrong", "volumeInfo": {"title": "Unrelated Book"}, "accessInfo": {}},
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
    assert result["items"][0]["canDownload"] is True
    assert result["items"][0]["downloadUrl"].endswith(".epub")


@pytest.mark.asyncio
async def test_search_book_sources_requires_matching_author_when_query_includes_one(monkeypatch) -> None:
    payload = {
        "items": [
            {
                "id": "same-title-wrong-author",
                "volumeInfo": {"title": "Deep Work", "authors": ["Another Author"]},
                "accessInfo": {},
            },
            {
                "id": "exact-title-and-author",
                "volumeInfo": {
                    "title": "Deep Work",
                    "authors": ["Cal Newport"],
                    "infoLink": "https://books.example/deep-work",
                },
                "accessInfo": {"pdf": {"isAvailable": True, "downloadLink": "https://books.example/deep-work.pdf"}},
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

    assert [item["id"] for item in result["items"]] == ["exact-title-and-author"]
    assert result["items"][0]["isExactMatch"] is True
    assert result["items"][0]["downloadFormat"] == "PDF"
