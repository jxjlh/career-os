from __future__ import annotations

import re
from html import unescape
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx

from app.providers.search.base import SearchProvider

# User-Agent 必须带, 否则 DuckDuckGo 会拒绝
_DD_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
}

# 编译一次正则, 复用给所有 DDG 站点搜索 provider (zhihu / juejin / 等)
_LINK_PATTERN = re.compile(
    r'<a\s+rel="nofollow"\s+href="([^"]+)"\s+class=[\'"]result-link[\'"]\s*>(.*?)</a>',
    re.DOTALL,
)
_SNIPPET_PATTERN = re.compile(
    r"<td\s+class=[\'\"]result-snippet[\'\"]\s*>(.*?)</td>",
    re.DOTALL,
)


async def search_ddg_lite(
    query: str,
    limit: int = 10,
    language: str = "zh",
    site: str | None = None,
    provider_name: str = "duckduckgo",
    source_name_override: str | None = None,
) -> list[dict[str, Any]]:
    """DuckDuckGo Lite HTML 端点解析的核心实现 (供 DuckDuckGoProvider 和 site 限定 provider 复用).

    Args:
        site: 传 'zhihu.com' / 'juejin.cn' 等域名做站内搜索, 绕过站点反爬.
        provider_name: 落到结果 dict 的 provider 字段, 用于前端按源过滤.
        source_name_override: 不传则从 URL 域名推导.
    """
    # site 限定: query 前缀加 site:domain
    full_query = f"site:{site} {query}" if site else query
    region = "cn-zh" if language.startswith("zh") else "us-en"
    try:
        async with httpx.AsyncClient(timeout=12, headers=_DD_HEADERS, follow_redirects=True) as client:
            resp = await client.post(
                "https://lite.duckduckgo.com/lite/",
                data={"q": full_query, "kl": region, "k1": "-1", "df": ""},
            )
            resp.raise_for_status()
            html = resp.text
    except Exception:
        return []

    results: list[dict[str, Any]] = []
    link_spans = list(_LINK_PATTERN.finditer(html))
    for i, match in enumerate(link_spans):
        raw_url = match.group(1)
        title_html = match.group(2)
        tail_start = match.end()
        tail_end = link_spans[i + 1].start() if i + 1 < len(link_spans) else len(html)
        tail = html[tail_start:tail_end]

        url = _unwrap_redirect(raw_url)
        if not url or url.startswith("javascript:"):
            continue
        if "duckduckgo.com" in url and "/lite/" not in url:
            continue
        title = _strip_tags(title_html).strip()
        if not title:
            title = url
        snippet = ""
        snip_match = _SNIPPET_PATTERN.search(tail)
        if snip_match:
            snippet = _strip_tags(snip_match.group(1))
        results.append(
            {
                "title": title,
                "url": url,
                "snippet": snippet[:300],
                "source_name": source_name_override or _domain_name(url),
                "provider": provider_name,
                "resource_type": _resource_type_for_url(url),
                "language": language,
                "difficulty": "mixed",
                "is_free": True,
                "is_official": False,
            }
        )
        if len(results) >= limit:
            break
    return results


class DuckDuckGoProvider(SearchProvider):
    """DuckDuckGo Lite HTML 端点解析 (免费, 无需 key).

    这是真正能搜索全网网页的兜底 provider, 不依赖任何 API key.
    通过抓 https://lite.duckduckgo.com/lite/ 的 HTML 并正则解析结果链接.
    鲁棒性: 任意异常都返回空 list, 让上层并行 gather 容错.
    """

    name = "duckduckgo"
    capabilities = {"web", "docs", "news"}

    async def search(self, query: str, limit: int = 10, **filters: Any) -> list[dict[str, Any]]:
        return await search_ddg_lite(
            query=query,
            limit=limit,
            language=filters.get("language", "zh"),
            provider_name=self.name,
        )

    async def healthcheck(self) -> bool:
        return True


def _unwrap_redirect(raw_url: str) -> str:
    """DDG lite 链接可能形如 //duckduckgo.com/l/?uddg=<encoded>&rut=...
    也可能是直接目标 URL. 兼容两种."""
    if raw_url.startswith("//"):
        raw_url = "https:" + raw_url
    parsed = urlparse(raw_url)
    if "duckduckgo.com" in (parsed.hostname or "") and parsed.path.startswith("/l/"):
        qs = parse_qs(parsed.query)
        uddg = qs.get("uddg", [""])
        if uddg and uddg[0]:
            return unescape(uddg[0])
    return raw_url


def _strip_tags(html: str) -> str:
    """去掉 HTML 标签并反转义实体."""
    text = re.sub(r"<[^>]+>", "", html)
    return unescape(text).strip()


def _extract_snippet(html: str) -> str:
    """从结果行剩余 HTML 中抽出一段描述文本."""
    # lite 页面 snippet 通常在 <td class="result-snippet"> 之后, 或者直接是 <a> 后的纯文本
    # 优先找 class=result-snippet / class="text-muted" 的内容
    m = re.search(
        r'class="(?:result-snippet|text-muted|links)"[^>]*>(.*?)</td>',
        html,
        re.DOTALL,
    )
    if m:
        return _strip_tags(m.group(1))
    # 退到 <a> 后的纯文本
    after = re.split(r"</a>", html, maxsplit=1)
    if len(after) > 1:
        return _strip_tags(after[1])[:300]
    return ""


def _domain_name(url: str) -> str:
    """根据 URL 域名返回可读的来源名 (知乎/掘金/B站/CSDN 等中文站点自动识别)."""
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return "DuckDuckGo"

    # 中文技术社区/平台域名 → 可读名称映射
    DOMAIN_NAMES = {
        "zhihu.com": "知乎",
        "zhuanlan.zhihu.com": "知乎专栏",
        "juejin.cn": "掘金",
        "juejin.im": "掘金",
        "bilibili.com": "哔哩哔哩",
        "www.bilibili.com": "哔哩哔哩",
        "csdn.net": "CSDN",
        "blog.csdn.net": "CSDN",
        "cnblogs.com": "博客园",
        "www.cnblogs.com": "博客园",
        "segmentfault.com": "SegmentFault",
        "runoob.com": "菜鸟教程",
        "www.runoob.com": "菜鸟教程",
        "stackoverflow.com": "Stack Overflow",
        "github.com": "GitHub",
        "medium.com": "Medium",
        "dev.to": "Dev.to",
        "mdn.mozilla.org": "MDN",
        "developer.mozilla.org": "MDN",
        "w3school.com.cn": "W3School",
        "www.w3school.com.cn": "W3School",
        "leetcode.cn": "力扣",
        "leetcode.com": "LeetCode",
        "khanacademy.org": "可汗学院",
        "coursera.org": "Coursera",
        "freecodecamp.org": "freeCodeCamp",
    }
    for domain, name in DOMAIN_NAMES.items():
        if host == domain or host.endswith("." + domain):
            return name
    return host.removeprefix("www.") or "DuckDuckGo"


def _resource_type_for_url(url: str) -> str:
    """根据 URL 域名推断资源类型 (视频/问答/文章/代码等)."""
    try:
        host = (urlparse(url).hostname or "").lower()
        path = (urlparse(url).path or "").lower()
    except Exception:
        return "web"

    if "bilibili.com" in host or "youtube.com" in host or "youtu.be" in host:
        return "video"
    if "zhihu.com" in host and ("/question/" in path or "/answer/" in path):
        return "discussion"
    if "stackoverflow.com" in host:
        return "qa"
    if "github.com" in host:
        return "code"
    if "medium.com" in host or "dev.to" in host or "juejin.cn" in host or "csdn.net" in host or "cnblogs.com" in host:
        return "article"
    return "web"
