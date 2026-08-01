from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import engine

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/ready")
def ready() -> dict:
    checks = {"storage": "ok", "ai_provider": "ok"}
    postgres_error: str | None = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:
        checks["postgres"] = "error"
        postgres_error = str(exc)

    response = {
        "status": "ready" if all(v == "ok" for v in checks.values()) else "degraded",
        "checks": checks,
    }
    if postgres_error:
        response["postgres_error"] = postgres_error[:500]
    return response
