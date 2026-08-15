"""Canonical, metadata-backed book discovery with optional lawful download links."""

import re
from typing import Any

import httpx

GOOGLE_BOOKS_VOLUMES_URL = "https://www.googleapis.com/books/v1/volumes"


def _normalize(value: str | None) -> str:
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]", "", (value or "").lower())


def _is_isbn(query: str) -> bool:
    compact = re.sub(r"[^0-9Xx]", "", query)
    return len(compact) in {10, 13}


def _match_score(query: str, title: str, identifiers: list[dict[str, str]]) -> int:
    normalized_query = _normalize(query)
    normalized_title = _normalize(title)
    if not normalized_query or not normalized_title:
        return 0
    if _is_isbn(query) and any(_normalize(item.get("identifier")) == normalized_query for item in identifiers):
        return 100
    if normalized_query == normalized_title:
        return 100
    if normalized_query in normalized_title or normalized_title in normalized_query:
        return 85
    return 0


def _download_info(access: dict[str, Any]) -> tuple[str | None, str | None]:
    for format_name, key in (("EPUB", "epub"), ("PDF", "pdf")):
        data = access.get(key) or {}
        if data.get("isAvailable") and data.get("downloadLink"):
            return str(data["downloadLink"]), format_name
    return None, None


async def search_book_sources(query: str, limit: int = 10, language: str = "zh") -> dict[str, Any]:
    normalized_query = _normalize(query)
    search_query = f"isbn:{query}" if _is_isbn(query) else f'intitle:"{query}"'
    params = {"q": search_query, "maxResults": min(limit * 3, 40), "printType": "books"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(GOOGLE_BOOKS_VOLUMES_URL, params=params)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        return {
            "items": [],
            "sources": [{"key": "google_books", "name": "Google Books", "status": "failed", "resultCount": 0, "error": str(exc)}],
        }

    items: list[dict[str, Any]] = []
    for raw in response.json().get("items") or []:
        volume = raw.get("volumeInfo") or {}
        title = str(volume.get("title") or "").strip()
        identifiers = volume.get("industryIdentifiers") or []
        score = _match_score(query, title, identifiers)
        if score < 60:
            continue
        access = raw.get("accessInfo") or {}
        download_url, download_format = _download_info(access)
        image_links = volume.get("imageLinks") or {}
        authors = [str(author) for author in volume.get("authors") or []]
        items.append(
            {
                "id": raw.get("id"),
                "title": title,
                "author": ", ".join(authors) or None,
                "description": volume.get("description"),
                "isbn": next((item.get("identifier") for item in identifiers if item.get("type") in {"ISBN_13", "ISBN_10"}), None),
                "coverUrl": image_links.get("thumbnail") or image_links.get("smallThumbnail"),
                "url": volume.get("infoLink") or volume.get("previewLink"),
                "downloadUrl": download_url,
                "downloadFormat": download_format,
                "canDownload": bool(download_url),
                "matchScore": score,
                "isExactMatch": score == 100,
                "sourceKey": "google_books",
                "sourceName": "Google Books",
                "isBookSource": True,
                "isComplete": bool(download_url),
            }
        )

    items.sort(key=lambda item: (-item["matchScore"], item["title"]))
    return {
        "items": items[:limit],
        "sources": [{"key": "google_books", "name": "Google Books", "status": "succeeded", "resultCount": len(items), "query": normalized_query}],
    }
