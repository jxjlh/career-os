FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production

WORKDIR /app

# Build context must be apps/backend/ directory
COPY pyproject.toml uv.lock ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
# Frontend static files (Next.js export output, copied by CI)
COPY static ./static
# Pre-downloaded production wheels (fetched on GitHub runner) for fully offline install
COPY requirements.txt ./
COPY wheels ./wheels

# Install runtime deps offline (VPS -> PyPI is slow/unreliable)
RUN uv venv .venv \
    && uv pip install --python .venv/bin/python --no-index --find-links /wheels -r requirements.txt \
    && rm -rf /wheels requirements.txt
RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ.get('PORT', '8000')}/health\")"

# Run alembic migrations then start uvicorn
CMD ["sh", "-c", ".venv/bin/alembic upgrade head 2>&1; echo '--- Starting uvicorn ---'; .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
