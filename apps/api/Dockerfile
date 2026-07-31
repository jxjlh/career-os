FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production

WORKDIR /app

# 注意：此 Dockerfile 构建上下文必须为 apps/api 子目录（Render rootDir=apps/api）
# 本地构建：cd apps/api && docker build .  或  docker build -f apps/api/Dockerfile apps/api
COPY pyproject.toml uv.lock ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./alembic.ini

# 安装含 dev 组（提供 alembic，用于容器启动时自动迁移）
RUN uv sync --frozen
RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

# 启动时自动执行 Alembic 迁移（幂等：无待执行则秒过），再拉起服务。
# DATABASE_URL 环境变量指向 Supabase Postgres（env.py 会改写为 psycopg3 驱动）。
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
