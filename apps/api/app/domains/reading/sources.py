"""Canonical, metadata-backed book discovery with optional lawful download links."""

import logging
import re
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger("app.reading.sources")

GOOGLE_BOOKS_VOLUMES_URL = "https://www.googleapis.com/books/v1/volumes"
OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json"


def _normalize(value: str | None) -> str:
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]", "", (value or "").lower())


def _is_isbn(query: str) -> bool:
    compact = re.sub(r"[^0-9Xx]", "", query)
    return len(compact) in {10, 13}


def _split_title_author_query(query: str) -> tuple[str, str | None]:
    """Accept clear title-author searches without guessing ambiguous words."""
    cleaned = query.strip()
    for pattern in (r"\s+(?:by|作者|author)\s+", r"\s+[-—–]\s+"):
        parts = re.split(pattern, cleaned, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) == 2 and all(part.strip() for part in parts):
            return parts[0].strip(), parts[1].strip()
    return cleaned, None


def _char_overlap(a: str, b: str) -> int:
    """Count overlapping characters between two strings (for CJK matching)."""
    set_a = set(a)
    set_b = set(b)
    return len(set_a & set_b)


def _match_score(
    title_query: str,
    author_query: str | None,
    title: str,
    authors: list[str],
    identifiers: list[dict[str, str]],
) -> int:
    normalized_query = _normalize(title_query)
    normalized_title = _normalize(title)
    if not normalized_query or not normalized_title:
        return 0
    if _is_isbn(title_query) and any(_normalize(item.get("identifier")) == normalized_query for item in identifiers):
        return 100
    normalized_author_query = _normalize(author_query)
    normalized_authors = [_normalize(author) for author in authors]
    author_matches = not normalized_author_query or any(
        normalized_author_query in author or author in normalized_author_query for author in normalized_authors if author
    )
    if not author_matches:
        return 0
    if normalized_query == normalized_title:
        return 120 if normalized_author_query else 100
    if normalized_query in normalized_title or normalized_title in normalized_query:
        return 95 if normalized_author_query else 85
    overlap = _char_overlap(normalized_query, normalized_title)
    min_overlap = max(2, min(len(normalized_query), len(normalized_title)) // 3)
    if overlap >= min_overlap:
        return 60
    if overlap >= 2:
        return 30
    return 0


def _download_info(access: dict[str, Any]) -> tuple[str | None, str | None]:
    for format_name, key in (("EPUB", "epub"), ("PDF", "pdf")):
        data = access.get(key) or {}
        if data.get("isAvailable") and data.get("downloadLink"):
            return str(data["downloadLink"]), format_name
    return None, None


def _build_search_query(title_query: str, author_query: str | None, isbn: bool) -> str:
    """Build a Google Books search query with fallback strategies."""
    if isbn:
        return f"isbn:{title_query}"

    parts: list[str] = []
    parts.append(f'intitle:"{title_query}"')
    if author_query:
        parts.append(f'inauthor:"{author_query}"')
    parts.append(title_query)
    return " OR ".join(parts) if len(parts) > 1 else parts[0]


async def _google_books_search(search_query: str, limit: int) -> list[dict[str, Any]]:
    """Execute a single Google Books API search with optional API key and retry."""
    import asyncio as _asyncio_mod
    params: dict[str, Any] = {"q": search_query, "maxResults": min(limit * 3, 40), "printType": "books"}
    settings = get_settings()
    if settings.google_books_api_key:
        params["key"] = settings.google_books_api_key
    max_attempts = 4
    for attempt in range(max_attempts):
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                response = await client.get(GOOGLE_BOOKS_VOLUMES_URL, params=params)
            response.raise_for_status()
            items = response.json().get("items") or []
            return items
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429 and attempt < max_attempts - 1:
                delay = 2 * (attempt + 1)
                logger.info("Google Books rate limited, retrying in %ds (attempt %d/%d)", delay, attempt + 1, max_attempts)
                await _asyncio_mod.sleep(delay)
                continue
            logger.warning("Google Books search failed for query %r: %s", search_query, exc)
            return []
        except httpx.HTTPError as exc:
            logger.warning("Google Books search failed for query %r: %s", search_query, exc)
            return []
    return []

async def _open_library_search(search_query: str, limit: int) -> list[dict[str, Any]]:
    """Fallback search using Open Library API (free, no key required)."""
    params = {"q": search_query, "limit": min(limit * 3, 40), "fields": "key,title,author_name,cover_i,isbn,publish_year,first_sentence"}
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(OPEN_LIBRARY_SEARCH_URL, params=params)
        response.raise_for_status()
        data = response.json()
        docs = data.get("docs") or []
        # Normalize Open Library results to match Google Books format
        normalized: list[dict[str, Any]] = []
        for doc in docs:
            title = str(doc.get("title") or "").strip()
            authors = doc.get("author_name") or []
            isbns = doc.get("isbn") or []
            cover_id = doc.get("cover_i")
            key = doc.get("key", "")
            first_sentence = doc.get("first_sentence")
            description = first_sentence[0] if isinstance(first_sentence, list) and first_sentence else None
            cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else None
            normalized.append({
                "id": key,
                "volumeInfo": {
                    "title": title,
                    "authors": authors,
                    "industryIdentifiers": [{"type": "ISBN_13" if len(str(isbn)) == 13 else "ISBN_10", "identifier": str(isbn)} for isbn in isbns[:2]] if isbns else [],
                    "description": description,
                    "imageLinks": {"thumbnail": cover_url} if cover_url else {},
                    "infoLink": f"https://openlibrary.org{key}" if key else None,
                    "previewLink": f"https://openlibrary.org{key}" if key else None,
                },
                "accessInfo": {},
            })
        return normalized
    except httpx.HTTPError as exc:
        logger.warning("Open Library search failed for query %r: %s", search_query, exc)
        return []


async def search_book_sources(query: str, limit: int = 10, language: str = "zh") -> dict[str, Any]:
    normalized_query = _normalize(query)
    title_query, author_query = _split_title_author_query(query)
    isbn = _is_isbn(query)

    search_queries: list[str] = []
    if isbn:
        search_queries.append(f"isbn:{query}")
    elif author_query:
        search_queries.append(f'intitle:"{title_query}" inauthor:"{author_query}"')
        search_queries.append(f'"{title_query}" "{author_query}"')
    else:
        search_queries.append(f'intitle:"{title_query}"')
        search_queries.append(title_query)

    all_raw_items: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for sq in search_queries:
        raw_items = await _google_books_search(sq, limit)
        for raw in raw_items:
            rid = raw.get("id", "")
            if rid and rid not in seen_ids:
                seen_ids.add(rid)
                all_raw_items.append(raw)
        if all_raw_items:
            break

    if not all_raw_items:
        logger.info("Google Books returned no results, trying Open Library fallback for query %r", query)
        for sq in search_queries:
            raw_items = await _open_library_search(sq, limit)
            for raw in raw_items:
                rid = raw.get("id", "")
                if rid and rid not in seen_ids:
                    seen_ids.add(rid)
                    all_raw_items.append(raw)
            if all_raw_items:
                break

    items: list[dict[str, Any]] = []
    for raw in all_raw_items:
        volume = raw.get("volumeInfo") or {}
        title = str(volume.get("title") or "").strip()
        identifiers = volume.get("industryIdentifiers") or []
        authors = [str(author) for author in volume.get("authors") or []]
        score = _match_score(title_query, author_query, title, authors, identifiers)
        if score < 5:
            continue
        access = raw.get("accessInfo") or {}
        download_url, download_format = _download_info(access)
        image_links = volume.get("imageLinks") or {}
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
                "downloadPolicy": "provider_authorized" if download_url else None,
                "matchScore": score,
                "isExactMatch": score >= 100,
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