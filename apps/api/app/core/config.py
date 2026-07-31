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
    spark_model: str = "Spark-Lite"
    spark_ws_url: str = "wss://spark-api.xf-yun.com/v1.1/chat"
    spark_domain: str = "lite"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-haiku-latest"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_anon_key: str = ""
    supabase_jwks_url: str = ""
    supabase_service_role_key: str = ""
    supabase_url: str = ""

    tavily_api_key: str = ""
    exa_api_key: str = ""
    google_search_api_key: str = ""
    google_search_cx: str = ""
    bing_api_key: str = ""
    github_token: str = ""
    youtube_api_key: str = ""


def normalize_db_url(url: str) -> str:
    # 项目依赖 psycopg3 (psycopg[binary])，但裸 postgresql:// 会被 SQLAlchemy 路由到 psycopg2
    # （未安装，会报 No module named 'psycopg2'）。这里统一改写为 +psycopg 驱动。
    # sqlite 与已带驱动的 URL 原样返回。
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
