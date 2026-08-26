# Justfile — cross-platform task runner for AI Aggregation App
# Compatible with Windows (via `just`), Linux, and macOS

# On Windows, prefer sh.exe (Git for Windows) for POSIX compatibility
set windows-shell := ["C:/Program Files/Git/bin/sh.exe", "-c"]

# Default: show available commands
default:
    @just --list

# ─── Installation ────────────────────────────────────────────

# Install all dependencies (frontend pnpm + backend uv)
install:
    pnpm install
    uv sync --all-packages

# Install frontend only
install:web:
    pnpm install

# Install backend only
install:backend:
    uv sync --project apps/backend

# ─── Database ────────────────────────────────────────────────

# Run database migrations
migrate:
    uv run --project apps/backend alembic upgrade head

# Create a new migration
migrate-create name:
    uv run --project apps/backend alembic revision --autogenerate -m "{{name}}"

# Rollback last migration
migrate-rollback:
    uv run --project apps/backend alembic downgrade -1

# ─── OpenAPI Type Generation ─────────────────────────────────

# Generate OpenAPI spec + TypeScript types
gen:api:
    uv run --project apps/backend python -m app.main --export-openapi
    pnpm run gen:types

# Export OpenAPI JSON only
gen:openapi:
    uv run --project apps/backend python -m app.main --export-openapi

# Generate TypeScript types from OpenAPI
gen:types:
    openapi-typescript apps/backend/openapi.json -o apps/web/lib/api/api.d.ts

# ─── Development ──────────────────────────────────────────────

# Start all services (web + backend + queue worker)
dev:
    @echo "Starting development environment..."
    @echo "Run 'just dev:web' and 'just dev:backend' in separate terminals for better control."

# Start frontend dev server
dev:web:
    pnpm --filter @ai-aggregation/web run dev

# Start backend dev server
dev:backend:
    uv run --project apps/backend uvicorn app.main:app --reload --port 8000

# Start ARQ background worker
dev:worker:
    uv run --project apps/backend arq app.core.queue.worker.WorkerSettings

# ─── Docker ───────────────────────────────────────────────────

# Start infrastructure (Postgres + Redis + Adminer)
docker-up:
    docker compose up -d

# Stop infrastructure
docker-down:
    docker compose down

# Reset infrastructure (WARNING: destroys data)
docker-reset:
    docker compose down -v
    docker compose up -d

# ─── Testing & Linting ───────────────────────────────────────

# Run all tests
test:
    pnpm --filter @ai-aggregation/web run test
    uv run --project apps/backend pytest

# Lint all workspaces
lint:
    pnpm --filter @ai-aggregation/web run lint
    uv run --project apps/backend ruff check .

# Format code
fmt:
    pnpm --filter @ai-aggregation/web run format
    uv run --project apps/backend ruff format .

# Type check
typecheck:
    pnpm --filter @ai-aggregation/web run typecheck
    uv run --project apps/backend mypy app/

# ─── Build ────────────────────────────────────────────────────

# Build all packages
build:
    pnpm run build

# Build frontend
build:web:
    pnpm --filter @ai-aggregation/web run build

# ─── Cleanup ───────────────────────────────────────────────────

# Clean build artifacts
clean:
    rm -rf apps/web/.next apps/web/dist apps/backend/**/__pycache__ apps/backend/.pytest_cache
    pnpm store prune
