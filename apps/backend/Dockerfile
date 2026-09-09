FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    UV_CACHE_DIR=/uv-cache

WORKDIR /app

# Build context must be apps/backend/ directory
COPY pyproject.toml uv.lock ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
# Frontend static files (Next.js export output, copied by CI)
COPY static ./static
# Pre-warmed uv wheel cache (downloaded on GitHub runner) for offline install
COPY uv-cache /uv-cache

# Install runtime dependencies offline (VPS -> PyPI is slow/unreliable; wheels come from cache)
RUN uv sync --frozen --no-dev --offline
RUN rm -rf /uv-cache
RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ.get('PORT', '8000')}/health\")"

# Run alembic migrations then start uvicorn
CMD ["sh", "-c", "uv run alembic upgrade head 2>&1; echo '--- Starting uvicorn ---'; uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
