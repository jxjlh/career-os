"""Book discovery using Open Library + Project Gutenberg (free, no API key required).

Open Library: 搜索 + 元数据
Project Gutenberg: 7万+公版书全文下载（EPUB/PDF/TXT）
"""

import logging
import re
from typing import Any

import httpx

logger = logging.getLogger("app.reading.sources")

OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json"
GUTENDEX_SEARCH_URL = "https://gutendex.com/books"


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
    if not normalized_query:
        return 0
    if _is_isbn(title_query) and any(_normalize(item.get("identifier")) == normalized_query for item in identifiers):
        return 100

    normalized_author_query = _normalize(author_query)
    normalized_authors = [_normalize(author) for author in authors]

    # Check if query matches authors (for author-only searches like "刘慈欣")
    query_matches_author = any(
        normalized_query in author or author in normalized_query for author in normalized_authors if author
    )

    # If user specifically searched for an author, check author match
    if normalized_author_query:
        author_matches = any(
            normalized_author_query in author or author in normalized_author_query
            for author in normalized_authors if author
        )
        if not author_matches:
            return 0
    elif query_matches_author:
        # Query matches an author - give it a good score
        if normalized_query == normalized_title:
            return 120
        return 70

    # Title matching
    if not normalized_title:
        return 0
    if normalized_query == normalized_title:
        return 100
    if normalized_query in normalized_title or normalized_title in normalized_query:
        return 80
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


def _pad_short_query(query: str) -> str:
    """Pad short queries to meet Open Library's minimum 3-character requirement."""
    if len(query.strip()) >= 3:
        return query.strip()
    # Add a space to help with short queries like "三体" (2 chars)
    return query.strip() + " "


async def _open_library_search(search_query: str, limit: int) -> list[dict[str, Any]]:
    """Search using Open Library API (free, no key required).
    
    Handles short queries by adding padding to meet the 3-character minimum.
    """
    padded_query = _pad_short_query(search_query)
    params = {"q": padded_query, "limit": min(limit * 3, 40), "fields": "key,title,author_name,cover_i,isbn,publish_year,first_sentence"}
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(OPEN_LIBRARY_SEARCH_URL, params=params)
        response.raise_for_status()
        data = response.json()
        docs = data.get("docs") or []
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
                    "industryIdentifiers": [
                        {"type": "ISBN_13" if len(str(isbn)) == 13 else "ISBN_10", "identifier": str(isbn)}
                        for isbn in isbns[:2]
                    ] if isbns else [],
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


async def _gutenberg_search(search_query: str, limit: int) -> list[dict[str, Any]]:
    """Search Project Gutenberg via Gutendex API (free, public domain books only)."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(GUTENDEX_SEARCH_URL, params={"search": search_query})
        response.raise_for_status()
        data = response.json()
        results = []
        for book in (data.get("results") or [])[:limit]:
            formats = book.get("formats") or {}
            # 优先 EPUB，其次 PDF，最后 TXT/HTML
            download_url = None
            download_format = None
            for fmt_key, fmt_label in [
                ("application/epub+zip", "epub"),
                ("application/pdf", "pdf"),
                ("text/plain; charset=us-ascii", "txt"),
                ("text/plain; charset=utf-8", "txt"),
                ("text/html; charset=utf-8", "html"),
            ]:
                if fmt_key in formats and formats[fmt_key].startswith("https://"):
                    download_url = formats[fmt_key]
                    download_format = fmt_label
                    break
            authors = [a.get("name", "") for a in book.get("authors") or []]
            cover_url = None
            if book.get("formats", {}).get("image/jpeg"):
                cover_url = book["formats"]["image/jpeg"]
            results.append({
                "id": f"gutenberg_{book.get('id', '')}",
                "volumeInfo": {
                    "title": book.get("title", ""),
                    "authors": authors,
                    "description": f"公版书 · Project Gutenberg #{book.get('id', '')} · 下载量 {book.get('download_count', 0)}",
                    "imageLinks": {"thumbnail": cover_url} if cover_url else {},
                    "infoLink": f"https://www.gutenberg.org/ebooks/{book.get('id', '')}",
                    "previewLink": download_url,
                },
                "accessInfo": {
                    "downloadLink": download_url,
                    "downloadFormat": download_format,
                    "isAvailable": bool(download_url),
                },
                "_gutenberg_id": book.get("id"),
                "_download_url": download_url,
                "_download_format": download_format,
            })
        return results
    except httpx.HTTPError as exc:
        logger.warning("Gutenberg search failed for query %r: %s", search_query, exc)
        return []


async def search_book_sources(query: str, limit: int = 10, language: str = "zh") -> dict[str, Any]:
    """Search books using Open Library + Project Gutenberg.

    Supports:
    - Direct title search
    - Title + author search (e.g., "三体 刘慈欣")
    - ISBN search
    - Short queries (padded to meet minimum length)
    - Project Gutenberg public domain book downloads
    """
    normalized_query = _normalize(query)
    title_query, author_query = _split_title_author_query(query)
    isbn = _is_isbn(query)

    search_queries: list[str] = []
    if isbn:
        search_queries.append(f"isbn:{query}")
    elif author_query:
        search_queries.append(f"{title_query} {author_query}")
        search_queries.append(title_query)
    else:
        search_queries.append(title_query)

    all_raw_items: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    # 1. Open Library 搜索
    for sq in search_queries:
        raw_items = await _open_library_search(sq, limit)
        for raw in raw_items:
            rid = raw.get("id", "")
            if rid and rid not in seen_ids:
                seen_ids.add(rid)
                all_raw_items.append(raw)
        if all_raw_items:
            break

    # 2. Project Gutenberg 搜索（公版书，可下载）
    gutenberg_items = await _gutenberg_search(title_query, limit)
    for raw in gutenberg_items:
        rid = raw.get("id", "")
        if rid and rid not in seen_ids:
            seen_ids.add(rid)
            all_raw_items.append(raw)

    items: list[dict[str, Any]] = []
    for raw in all_raw_items:
        volume = raw.get("volumeInfo") or {}
        title = str(volume.get("title") or "").strip()
        identifiers = volume.get("industryIdentifiers") or []
        authors = [str(author) for author in volume.get("authors") or []]
        score = _match_score(title_query, author_query, title, authors, identifiers)
        # Gutenberg 结果匹配分数稍低也可接受（因为是公版书，质量有保障）
        is_gutenberg = raw.get("_gutenberg_id") is not None
        if score < 30 and not is_gutenberg:
            continue
        if is_gutenberg and score < 20:
            continue
        access = raw.get("accessInfo") or {}
        download_url = raw.get("_download_url") or access.get("downloadLink")
        download_format = raw.get("_download_format") or access.get("downloadFormat")
        if not download_url:
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
                "downloadPolicy": "public_domain" if is_gutenberg else ("provider_authorized" if download_url else None),
                "matchScore": score,
                "isExactMatch": score >= 100,
                "sourceKey": "gutenberg" if is_gutenberg else "open_library",
                "sourceName": "Project Gutenberg" if is_gutenberg else "Open Library",
                "isBookSource": True,
                "isComplete": bool(download_url),
            }
        )

    items.sort(key=lambda item: (-item["matchScore"], item["title"]))
    gutenberg_count = sum(1 for i in items if i["sourceKey"] == "gutenberg")
    open_lib_count = sum(1 for i in items if i["sourceKey"] == "open_library")
    sources = [
        {
            "key": "open_library",
            "name": "Open Library",
            "status": "succeeded",
            "resultCount": open_lib_count,
            "query": normalized_query,
        }
    ]
    if gutenberg_count > 0:
        sources.append({
            "key": "gutenberg",
            "name": "Project Gutenberg",
            "status": "succeeded",
            "resultCount": gutenberg_count,
            "query": normalized_query,
        })
    return {
        "items": items[:limit],
        "sources": sources,
    }