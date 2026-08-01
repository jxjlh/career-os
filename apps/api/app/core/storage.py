from pathlib import Path

import httpx

from app.core.config import get_settings


async def upload_object(path: str, content: bytes, content_type: str) -> str:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return await _upload_local(path, content, content_type)
    url = f"{settings.supabase_url}/storage/v1/object/life-records/{path}"
    headers = {"Authorization": f"Bearer {settings.supabase_service_role_key}", "Content-Type": content_type}
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, headers=headers, content=content)
    if response.status_code >= 400:
        # Supabase 未就绪时回落到本地存储, 避免拍照/视频流程中断.
        return await _upload_local(path, content, content_type)
    return path


async def _upload_local(path: str, content: bytes, content_type: str) -> str:
    settings = get_settings()
    root = Path(settings.media_dir)
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return f"/media/{path}"


async def resolve_object_url(path: str) -> str | None:
    """把存储对象解析成可访问 URL (http / /media / Supabase 签名 URL)."""
    if path.startswith(("http://", "https://")):
        return path
    if path.startswith("/media/"):
        return path

    settings = get_settings()
    if settings.supabase_url and settings.supabase_service_role_key:
        sign_url = f"{settings.supabase_url}/storage/v1/object/sign/life-records/{path}"
        headers = {"Authorization": f"Bearer {settings.supabase_service_role_key}"}
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(sign_url, headers=headers, json={"expiresIn": 3600})
        if response.status_code < 400:
            signed = response.json().get("signedURL")
            if signed:
                return f"{settings.supabase_url}{signed}" if signed.startswith("/") else signed

    local = Path(settings.media_dir) / path
    if local.is_file():
        return f"/media/{path}"
    return None
