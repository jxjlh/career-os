from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "dev"
    database_url: str = "sqlite:///./career_os.db"
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"
    media_dir: str = "media"
    frontend_url: str = "https://ai-life-os-web.onrender.com"

    xfyun_api_key: str = ""
    xfyun_api_secret: str = ""
    xfyun_app_id: str = ""
    spark_model: str = "Spark-Lite"
    spark_ws_url: str = "wss://spark-api.xf-yun.com/v1.1/chat"
    spark_domain: str = "lite"
    # 讯飞 TTS (与星火大模型共用相同的 API_KEY/SECRET/APP_ID)
    xfyun_tts_ws_url: str = "wss://tts-api.xfyun.cn/v2/tts"
    xfyun_tts_default_voice: str = "xiaoyan"

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
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
    supabase_storage_bucket: str = "life-records"

    tavily_api_key: str = ""
    exa_api_key: str = ""
    google_search_api_key: str = ""
    google_search_cx: str = ""
    google_books_api_key: str = ""
    bing_api_key: str = ""
    github_token: str = ""
    youtube_api_key: str = ""

    finance_market_data_base_url: str = ""
    finance_market_data_api_key: str = ""
    finance_ocr_api_url: str = ""
    finance_ocr_api_key: str = ""
    finance_ocr_model: str = "gpt-4o-mini"
    finance_scheduler_token: str = ""
    # 理财决策 AI（独立于 OCR 用的阿里云配置）
    finance_ai_api_key: str = ""
    finance_ai_base_url: str = "https://api.deepseek.com/v1"
    finance_ai_model: str = "deepseek-chat"


def normalize_db_url(url: str) -> str:
    """统一数据库 URL：改用 psycopg3 驱动 + 正确处理密码中的特殊字符。

    Supabase 等服务的密码常含 ``+`` ``/`` ``=`` 等字符，Python 标准库
    urlparse 会把 ``+`` 当成空格、把 ``==`` 截断。改用 SQLAlchemy 的
    make_url 解析（专为数据库 URL 设计），再 render_as_string 时自动
    对密码做正确的 percent-encode。
    """
    # sqlite 与已带 +psycopg 驱动的 URL 原样返回
    if url.startswith("sqlite://") or url.startswith("postgresql+psycopg://"):
        return url
    if not url.startswith("postgresql://"):
        return url

    parsed = make_url(url).set(drivername="postgresql+psycopg")
    return parsed.render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()
