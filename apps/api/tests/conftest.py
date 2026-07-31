"""测试共用夹具.

所有测试统一用 MockAIProvider 与 MockSearchProvider, 避免依赖外部讯飞星火
WebSocket 与真实搜索 API, 保证测试快、稳、离线可跑.
"""

import os

# 必须在 import app.* 之前设置: app.main 在模块加载时调用 get_settings() 并按
# app_env 决定是否挂载限流中间件, 是否自动建表. 设为 test 关闭限流, 避免单测
# 共享 app 实例时跨用例累计触发 429.
os.environ.setdefault("APP_ENV", "test")

import pytest

from app.providers.ai.mock_provider import MockAIProvider
from app.providers.search.mock_provider import MockSearchProvider


@pytest.fixture(autouse=True)
def _force_mock_providers(monkeypatch):
    # AI: 全部走 mock, 避免讯飞星火 WebSocket
    monkeypatch.setattr(
        "app.providers.ai.registry.get_ai_provider",
        lambda: MockAIProvider(),
    )
    # 搜索: 仅用 mock provider, 避免命中真实 Wikipedia/GitHub 导致单测变慢或受网络抖动影响
    monkeypatch.setattr(
        "app.domains.explorer.router.get_search_providers",
        lambda: [MockSearchProvider()],
    )
