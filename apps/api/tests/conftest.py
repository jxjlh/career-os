"""测试共用夹具。

所有测试统一用 MockAIProvider，避免依赖外部讯飞星火 WebSocket，
保证测试快、稳、离线可跑。
"""

import pytest

from app.providers.ai.mock_provider import MockAIProvider


@pytest.fixture(autouse=True)
def _force_mock_ai_provider(monkeypatch):
    monkeypatch.setattr(
        "app.providers.ai.registry.get_ai_provider",
        lambda: MockAIProvider(),
    )
