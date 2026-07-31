from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "dev"
    database_url: str = "sqlite:///./career_os.db"
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"

    xfyun_api_key: str = ""
    xfyun_api_secret: str = ""
    xfyun_app_id: str = ""
    spark_model: str = "Spark-X2-Flash"
    spark_ws_url: str = "wss://spark-api.xf-yun.com/v3.5/chat"
    spark_domain: str = "generalv3.5"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-haiku-latest"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    supabase_jwt_secret: str = ""
    supabase_anon_key: str = ""
    supabase_jwks_url: str = ""
    supabase_service_role_key: str = ""

    tavily_api_key: str = ""
    exa_api_key: str = ""
    google_search_api_key: str = ""
    google_search_cx: str = ""
    bing_api_key: str = ""
    github_token: str = ""
    youtube_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
