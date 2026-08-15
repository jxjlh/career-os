from pathlib import Path

import httpx

from app.core.config import get_settings
from app.core.errors import AppError


def _cloud_storage_required(app_env: str) -> bool:
    return app_env.strip().lower() not in {"dev", "development", "test", "testing"}


def _cloud_storage_is_configured(supabase_url: str, service_role_key: str) -> bool:
    return bool(supabase_url and service_role_key)


def _storage_headers(service_role_key: str, content_type: str | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {service_role_key}", "apikey": service_role_key}
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _bucket_is_missing(response: httpx.Response) -> bool:
    if response.status_code == 404:
        return True
    if response.status_code != 400:
        return False
    try:
        return response.json().get("code") == "NoSuchBucket"
    except ValueError:
        return False


async def upload_object(path: str, content: bytes, content_type: str) -> str:
    settings = get_settings()
    if not _cloud_storage_is_configured(settings.supabase_url, settings.supabase_service_role_key):
        if _cloud_storage_required(settings.app_env):
            raise AppError(
                code="MEDIA_STORAGE_NOT_CONFIGURED",
                message="图片存储尚未配置，请联系管理员完成云端存储配置后重试",
                status=503,
            )
        return await _upload_local(path, content, content_type)

    bucket = settings.supabase_storage_bucket
    storage_url = f"{settings.supabase_url.rstrip('/')}/storage/v1"
    object_url = f"{storage_url}/object/{bucket}/{path}"
    headers = _storage_headers(settings.supabase_service_role_key, content_type)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(object_url, headers=headers, content=content)
            if _bucket_is_missing(response):
                bucket_response = await client.post(
                    f"{storage_url}/bucket",
                    headers=_storage_headers(settings.supabase_service_role_key, "application/json"),
                    json={"id": bucket, "name": bucket, "public": False},
                )
                if bucket_response.status_code not in {200, 201, 409}:
                    raise AppError(
                        code="MEDIA_UPLOAD_FAILED",
                        message="图片上传到云端失败，请稍后重试",
                        status=503,
                    )
                response = await client.post(object_url, headers=headers, content=content)
    except httpx.HTTPError as exc:
        raise AppError(
            code="MEDIA_UPLOAD_FAILED",
            message="图片上传到云端失败，请稍后重试",
            status=503,
        ) from exc
    if response.status_code >= 400:
        raise AppError(
            code="MEDIA_UPLOAD_FAILED",
            message="图片上传到云端失败，请稍后重试",
            status=503,
        )
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

    settings = get_settings()
    cloud_configured = _cloud_storage_is_configured(settings.supabase_url, settings.supabase_service_role_key)
    if path.startswith("/media/"):
        return path if not _cloud_storage_required(settings.app_env) else None

    if cloud_configured:
        bucket = settings.supabase_storage_bucket
        sign_url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/sign/{bucket}/{path}"
        headers = _storage_headers(settings.supabase_service_role_key)
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(sign_url, headers=headers, json={"expiresIn": 3600})
        except httpx.HTTPError:
            return None
        if response.status_code < 400:
            signed = response.json().get("signedURL")
            if signed:
                return f"{settings.supabase_url.rstrip('/')}{signed}" if signed.startswith("/") else signed

    if _cloud_storage_required(settings.app_env):
        return None

    local = Path(settings.media_dir) / path
    if local.is_file():
        return f"/media/{path}"
    return None
