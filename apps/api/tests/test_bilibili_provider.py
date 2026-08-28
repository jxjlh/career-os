from urllib.parse import parse_qs, urlparse

from app.providers.search.bilibili_provider import _bilibili_search_link, _parse_bing_results


def test_parse_bing_results_keeps_only_bilibili_video_links() -> None:
    html = """
    <li class="b_algo"><h2><a href="https://www.bilibili.com/video/BV1abc">Python 入门</a></h2></li>
    <li class="b_algo"><h2><a href="https://example.com/not-bilibili">其他结果</a></h2></li>
    <li class="b_algo"><h2><a href="https://www.bilibili.com/video/BV2def"><strong>SQL</strong> 实战</a></h2></li>
    """

    rows = _parse_bing_results(html, limit=10, language="zh")

    assert [row["url"] for row in rows] == [
        "https://www.bilibili.com/video/BV1abc",
        "https://www.bilibili.com/video/BV2def",
    ]
    assert rows[1]["title"] == "SQL 实战"
    assert rows[0]["provider"] == "bilibili"


def test_bilibili_search_link_keeps_the_learning_query() -> None:
    row = _bilibili_search_link("EDM制作 教程", language="zh")

    assert row["resource_type"] == "search"
    assert parse_qs(urlparse(row["url"]).query)["keyword"] == ["EDM制作 教程"]
