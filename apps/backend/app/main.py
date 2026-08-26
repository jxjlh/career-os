"""FastAPI application entrypoint.

- Registers all v1 API routes
- Exports openapi.json at startup
- Provides a /ready health check endpoint
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints.chat import router as chat_router
from app.core.config import get_settings

settings = get_settings()


def create_app() -> FastAPI:
    """Application factory."""
    app = FastAPI(
        title="AI Aggregation App API",
        version="0.1.0",
        description="Multi-provider AI aggregation with SSE streaming",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # ── CORS ────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routes ──────────────────────────────────────────────────
    api_v1_prefix = "/api/v1"
    app.include_router(chat_router, prefix=api_v1_prefix)

    # ── Health check ───────────────────────────────────────────
    @app.get("/ready")
    async def readiness() -> dict:
        return {"status": "ok", "env": settings.app_env}

    @app.get("/")
    async def root() -> dict:
        return {
            "name": settings.app_name,
            "version": "0.1.0",
            "docs": "/docs",
        }

    # ── OpenAPI export endpoint ─────────────────────────────────
    @app.get("/export-openapi")
    async def export_openapi_json() -> dict:
        """Returns the OpenAPI schema — used by `gen:api` script."""
        return app.openapi()

    return app


app = create_app()


# ── CLI entrypoint ─────────────────────────────────────────────


def export_openapi() -> None:
    """Export openapi.json to disk — called by `just gen:openapi`."""
    openapi_schema = app.openapi()
    output_path = Path(__file__).resolve().parent.parent / "openapi.json"
    output_path.write_text(
        json.dumps(openapi_schema, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"OpenAPI spec exported to {output_path}")


def main() -> None:
    """Entry point: run server or export OpenAPI."""
    if "--export-openapi" in sys.argv:
        export_openapi()
        return

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_dev,
        log_level="debug" if settings.debug else "info",
    )


if __name__ == "__main__":
    main()
