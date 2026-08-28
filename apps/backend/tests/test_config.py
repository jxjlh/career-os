"""Basic tests for the AI aggregation backend."""
from app.core.config import get_settings


def test_settings_loads():
    """Settings can be loaded from environment."""
    settings = get_settings()
    assert settings.app_env == "dev"
    assert settings.app_name == "ai-aggregation-app"


def test_settings_is_dev():
    """Default environment is dev."""
    settings = get_settings()
    assert settings.is_dev is True
    assert settings.is_prod is False
