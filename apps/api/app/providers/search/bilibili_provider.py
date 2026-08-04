from __future__ import annotations

from datetime import datetime, timezone
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
                    return []
                data = resp.json()
        except Exception:
            return []

        # B站 API 在风控时可能返回 code: -412 / -799 等, 此时降级返回空
        if data.get("code") != 0:
            return []

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
        return results

    async def healthcheck(self) -> bool:
        return True


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
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except (TypeError, ValueError):
        return None
