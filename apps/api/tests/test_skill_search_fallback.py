import pytest

from app.providers.search.bilibili_provider import BilibiliProvider


@pytest.mark.asyncio
async def test_bilibili_search_falls_back_when_api_returns_non_json(monkeypatch) -> None:
    class FakeResponse:
        headers = {"content-type": "text/html"}
        text = "<html>风控页</html>"

        def raise_for_status(self) -> None:
            return None

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, *_args, **_kwargs):
            return FakeResponse()

    fallback_calls = []

    async def fake_fallback(query: str, limit: int, language: str):
        fallback_calls.append((query, limit, language))
        return [{"title": "B站课程", "url": "https://www.bilibili.com/video/BV1"}]

    monkeypatch.setattr("app.providers.search.bilibili_provider.httpx.AsyncClient", lambda **_kwargs: FakeClient())
    provider = BilibiliProvider()
    monkeypatch.setattr(provider, "_fallback_search", fake_fallback)

    result = await provider.search("Python 入门", limit=5, language="zh")

    assert result[0]["url"].startswith("https://www.bilibili.com/")
    assert fallback_calls == [("Python 入门", 5, "zh")]
