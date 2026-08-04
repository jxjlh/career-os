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
# 前端静态文件（Next.js 构建产物，由 apps/web/out 复制而来）
COPY static ./static

# 安装含 dev 组（提供 alembic，用于容器启动时自动迁移）
RUN uv sync --frozen
RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ.get('PORT', '8000')}/health\")"

# 启动时自动执行 Alembic 迁移（幂等：无待执行则秒过），再拉起服务。
# 用 ; 代替 && — 即使 alembic 失败也继续启动 uvicorn，这样 health check
# 能通过，服务变为 live，方便通过 API 端点诊断数据库问题。
CMD ["sh", "-c", "uv run alembic upgrade head 2>&1; echo '--- Starting uvicorn ---'; uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
