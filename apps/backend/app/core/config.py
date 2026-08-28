"""Application configuration via pydantic-settings."""
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────
    app_env: str = "dev"
    app_name: str = "ai-aggregation-app"
    debug: bool = True

    # ── Database ─────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_agg_db"

    # ── Redis / ARQ ──────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Security ─────────────────────────────────────────────────
    secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    # ── CORS ─────────────────────────────────────────────────────
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # ── iFlytek Spark (讯飞星火) ─────────────────────────────────
    xfyun_api_key: str = ""
    xfyun_api_secret: str = ""
    xfyun_app_id: str = ""
    spark_model: str = "Spark-X2-Flash"
    spark_ws_url: str = "wss://spark-api.xf-yun.com/v3.5/chat"
    spark_domain: str = "generalv3.5"

    # ── OpenAI ───────────────────────────────────────────────────
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"

    # ── Other AI providers (optional) ────────────────────────────
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-haiku-latest"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    # ── Search providers ─────────────────────────────────────────
    tavily_api_key: str = ""
    exa_api_key: str = ""
    bing_api_key: str = ""
    github_token: str = ""
    youtube_api_key: str = ""

    # ── Default provider ─────────────────────────────────────────
    default_llm_provider: str = "xunfei"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @property
    def is_dev(self) -> bool:
        return self.app_env == "dev"

    @property
    def is_prod(self) -> bool:
        return self.app_env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()
