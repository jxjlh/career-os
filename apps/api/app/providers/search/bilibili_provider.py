from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from app.providers.search.base import SearchProvider


class BilibiliProvider(SearchProvider):
    """B站视频搜索 (直接调用 Bilibili 官方公开 API, 免费, 无需 key).

    API: https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=...
    无需 cookie 即可拿到视频标题/UP主/播放量/封面/时长等元数据.
    适合「学习某项技术找视频教程」场景.
    """

    name = "bilibili"
    capabilities = {"web", "video", "tutorial"}

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com",
    }

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        language = filters.get("language", "zh")
        url = "https://api.bilibili.com/x/web-interface/search/type"
        params = {
            "search_type": "video",
            "keyword": query,
            "page_size": min(limit, 20),
            "page": 1,
            # order: totalrank 综合 / click 播放 / pubdate 发布 / dm 弹幕
            "order": "totalrank",
        }
        try:
            async with httpx.AsyncClient(timeout=10, headers=self.HEADERS) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                # B站风控时返回 HTML 风控页 (非 JSON), 直接降级返回空
                content_type = resp.headers.get("content-type", "")
                if "json" not in content_type or not resp.text.strip().startswith("{"):
                    return await self._fallback_search(query, limit, language)
                data = resp.json()
        except Exception:
            return await self._fallback_search(query, limit, language)

        # B站 API 在风控时可能返回 code: -412 / -799 等, 此时降级返回空
        if data.get("code") != 0:
            return await self._fallback_search(query, limit, language)

        items = (data.get("data") or {}).get("result") or []
        results: list[dict[str, Any]] = []
        for item in items[:limit]:
            title = _strip_tags(item.get("title", "")).strip()
            if not title:
                continue
            # B站返回的 arcurl 是 http://, 统一改成 https://
            video_url = (item.get("arcurl") or "").replace("http://", "https://")
            if not video_url:
                continue
            author = item.get("author", "")
            play_count = item.get("play", 0)
            danmaku = item.get("video_review", 0)
            duration = _parse_duration(item.get("duration"))
            cover = (item.get("pic") or "").replace("http://", "https://")
            # 播放量 / 弹幕量转中文可读
            snippet_parts = []
            if author:
                snippet_parts.append(f"UP主: {author}")
            if play_count:
                snippet_parts.append(f"▶️ {_format_count(play_count)} 播放")
            if danmaku:
                snippet_parts.append(f"💬 {_format_count(danmaku)} 弹幕")
            if duration:
                snippet_parts.append(f"⏱ {duration}")
            snippet = " · ".join(snippet_parts)
            # description 加在末尾做关键词命中
            description = _strip_tags(item.get("description") or "").strip()
            if description:
                snippet = f"{snippet} | {description[:150]}" if snippet else description[:150]
            results.append(
                {
                    "title": title,
                    "url": video_url,
                    "snippet": snippet[:300],
                    "source_name": "哔哩哔哩",
                    "provider": self.name,
                    "resource_type": "video",
                    "language": language,
                    "difficulty": "mixed",
                    "is_free": True,
                    "is_official": False,
                    "duration_minutes": duration // 60 if duration else None,
                    "published_at": _ts_to_iso(item.get("pubdate")),
                    "thumbnail_url": cover or None,
                    "metadata": {
                        "author": author,
                        "play_count": play_count,
                        "danmaku_count": danmaku,
                        "duration_seconds": duration,
                        "bvid": item.get("bvid"),
                        "cover": cover,
                    },
                }
            )
        return results or await self._fallback_search(query, limit, language)

    async def _fallback_search(self, query: str, limit: int, language: str) -> list[dict[str, Any]]:
        # B站官方接口经常返回风控 HTML（code -412/-799 或非 JSON）。
        # 先用 Bing 的公开 HTML 搜索做站内检索，避免 DDG 超时就完全没有结果。
        try:
            async with httpx.AsyncClient(
                timeout=12,
                follow_redirects=True,
                headers={"User-Agent": self.HEADERS["User-Agent"], "Accept-Language": "zh-CN,zh;q=0.9"},
            ) as client:
                response = await client.get(
                    "https://www.bing.com/search",
                    params={"q": f"site:bilibili.com {query}", "count": min(limit, 20)},
                )
                response.raise_for_status()
                rows = _parse_bing_results(response.text, limit=limit, language=language)
                if rows:
                    return rows
        except Exception:
            pass

        from app.providers.search.duckduckgo_provider import search_ddg_lite

        rows = await search_ddg_lite(
            query=query,
            limit=limit,
            language=language,
            site="bilibili.com",
            provider_name=self.name,
            source_name_override="哔哩哔哩",
        )
        return rows or [_bilibili_search_link(query, language)]

    async def healthcheck(self) -> bool:
        return True


def _parse_bing_results(html: str, limit: int, language: str) -> list[dict[str, Any]]:
    """Parse Bing's public result HTML and keep only Bilibili video links."""
    import re
    from html import unescape

    pattern = re.compile(
        r'<li[^>]*class=["\'][^"\']*b_algo[^"\']*["\'][^>]*>.*?'
        r'<h2[^>]*>\s*<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
        re.DOTALL | re.IGNORECASE,
    )
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for match in pattern.finditer(html):
        url = unescape(match.group(1)).strip()
        if not re.match(r"https?://(?:www\.)?bilibili\.com/video/", url, re.IGNORECASE):
            continue
        if url in seen:
            continue
        seen.add(url)
        title = _strip_tags(unescape(match.group(2))).strip() or url
        rows.append(
            {
                "title": title[:200],
                "url": url,
                "snippet": "Bing 站内搜索 · 哔哩哔哩视频",
                "source_name": "哔哩哔哩",
                "provider": "bilibili",
                "resource_type": "video",
                "language": language,
                "difficulty": "mixed",
                "is_free": True,
                "is_official": False,
            }
        )
        if len(rows) >= limit:
            break
    return rows


def _bilibili_search_link(query: str, language: str = "zh") -> dict[str, Any]:
    """Return a usable B站 search card when upstream scraping is blocked."""
    from urllib.parse import quote

    return {
        "title": f"在 B 站搜索：{query}",
        "url": f"https://search.bilibili.com/all?keyword={quote(query)}",
        "snippet": "B站接口暂时受限，点击打开 B 站搜索结果。",
        "source_name": "哔哩哔哩",
        "provider": "bilibili",
        "resource_type": "search",
        "language": language,
        "difficulty": "mixed",
        "is_free": True,
        "is_official": False,
    }


def _strip_tags(html: str) -> str:
    """B站 title 里有 <em class="keyword">高亮</em>, 需要去标签."""
    import re

    text = re.sub(r"<[^>]+>", "", html)
    from html import unescape

    return unescape(text).strip()


def _parse_duration(duration: Any) -> int:
    """B站 duration 字段格式 '12:34' 或 '1:02:03', 转秒数."""
    if isinstance(duration, int):
        return duration
    if not isinstance(duration, str) or not duration:
        return 0
    parts = duration.split(":")
    try:
        parts = [int(p) for p in parts]
    except ValueError:
        return 0
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return 0


def _format_count(n: int) -> str:
    """播放量/弹幕量转中文可读: 12345 → 1.2万."""
    if n >= 100000000:
        return f"{n / 100000000:.1f}亿"
    if n >= 10000:
        return f"{n / 10000:.1f}万"
    return str(n)


def _ts_to_iso(ts: Any) -> str | None:
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(int(ts), tz=UTC).isoformat()
    except (TypeError, ValueError):
        return None
