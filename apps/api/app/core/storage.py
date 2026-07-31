import httpx

from app.core.config import get_settings
from app.core.errors import AppError


async def upload_object(path: str, content: bytes, content_type: str) -> str:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise AppError(code="STORAGE_NOT_CONFIGURED", message="Storage is not configured", status=501)
    url = f"{settings.supabase_url}/storage/v1/object/life-records/{path}"
    headers = {"Authorization": f"Bearer {settings.supabase_service_role_key}", "Content-Type": content_type}
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, headers=headers, content=content)
    if response.status_code >= 400:
        raise AppError(code="STORAGE_UPLOAD_FAILED", message=response.text[:200], status=502)
    return path
