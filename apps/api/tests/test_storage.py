from io import BytesIO
from types import SimpleNamespace

import pytest

import app.core.storage as storage
import app.domains.life.service as life_service
import app.services.storage as legacy_storage
from app.core.errors import AppError


@pytest.mark.asyncio
async def test_production_upload_requires_cloud_storage_configuration(monkeypatch, tmp_path) -> None:
    settings = SimpleNamespace(
        app_env="production",
        supabase_url="",
        supabase_service_role_key="",
        supabase_storage_bucket="life-records",
        media_dir=str(tmp_path),
    )
    monkeypatch.setattr(storage, "get_settings", lambda: settings)

    with pytest.raises(AppError) as error:
        await storage.upload_object("user/goal/watermark/photo.jpg", b"image", "image/jpeg")

    assert error.value.code == "MEDIA_STORAGE_NOT_CONFIGURED"
    assert error.value.status == 503
    assert list(tmp_path.rglob("*")) == []


@pytest.mark.asyncio
async def test_upload_creates_public_bucket_and_retries_object_upload(monkeypatch, tmp_path) -> None:
    calls: list[tuple[str, dict]] = []

    class StorageClient:
        def __init__(self):
            self.upload_attempts = 0

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return False

        async def post(self, url, **kwargs):
            calls.append((url, kwargs))
            if "/storage/v1/object/" in url:
                self.upload_attempts += 1
                if self.upload_attempts == 1:
                    return SimpleNamespace(status_code=400, json=lambda: {"code": "NoSuchBucket"})
                return SimpleNamespace(status_code=200, json=lambda: {})
            if "/storage/v1/bucket" in url:
                return SimpleNamespace(status_code=201, json=lambda: {})
            return SimpleNamespace(status_code=201)

    settings = SimpleNamespace(
        app_env="production",
        supabase_url="https://example.supabase.co/",
        supabase_service_role_key="service-role-key",
        supabase_storage_bucket="life-records",
        media_dir=str(tmp_path),
    )
    monkeypatch.setattr(storage, "get_settings", lambda: settings)
    monkeypatch.setattr(storage.httpx, "AsyncClient", lambda **kwargs: StorageClient())

    path = "user/goal/watermark/photo.jpg"
    assert await storage.upload_object(path, b"image", "image/jpeg") == path
    # 第一次上传失败（桶不存在），创建桶后重试成功
    assert any("/storage/v1/bucket" in url for url, _ in calls)


@pytest.mark.asyncio
async def test_record_uploads_use_unique_object_names(monkeypatch) -> None:
    async def fake_upload(path: str, content: bytes, content_type: str) -> str:
        return path

    monkeypatch.setattr(life_service, "upload_object", fake_upload)

    first_path = await life_service.upload_record_file("user", "goal", "photo.jpg", b"one", "image/jpeg")
    second_path = await life_service.upload_record_file("user", "goal", "photo.jpg", b"two", "image/jpeg")

    assert first_path != second_path
    assert first_path.startswith("user/goal/watermark/")
    assert first_path.endswith(".jpg")


@pytest.mark.asyncio
async def test_production_upload_does_not_fall_back_to_local_storage_after_cloud_failure(monkeypatch, tmp_path) -> None:
    class FailedStorageClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return False

        async def post(self, *args, **kwargs):
            return SimpleNamespace(status_code=500)

    settings = SimpleNamespace(
        app_env="production",
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-role-key",
        supabase_storage_bucket="life-records",
        media_dir=str(tmp_path),
    )
    monkeypatch.setattr(storage, "get_settings", lambda: settings)
    monkeypatch.setattr(storage.httpx, "AsyncClient", lambda **kwargs: FailedStorageClient())

    with pytest.raises(AppError) as error:
        await storage.upload_object("user/goal/watermark/photo.jpg", b"image", "image/jpeg")

    assert error.value.code == "MEDIA_UPLOAD_FAILED"
    assert error.value.status == 503
    assert list(tmp_path.rglob("*")) == []


def test_journal_image_upload_requires_cloud_storage_in_production(monkeypatch, tmp_path) -> None:
    settings = SimpleNamespace(
        app_env="production",
        supabase_url="",
        supabase_service_role_key="",
        supabase_storage_bucket="life-records",
        media_dir=str(tmp_path),
    )
    monkeypatch.setattr(legacy_storage, "get_settings", lambda: settings)

    service = legacy_storage.StorageService()

    with pytest.raises(RuntimeError, match="云端存储"):
        service.upload_journal_image(BytesIO(b"image"), "photo.jpg", "user-1")

    assert list(tmp_path.rglob("*")) == []


def test_journal_image_upload_does_not_fall_back_after_cloud_failure(monkeypatch, tmp_path) -> None:
    settings = SimpleNamespace(
        app_env="production",
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-role-key",
        supabase_storage_bucket="life-records",
        media_dir=str(tmp_path),
    )
    monkeypatch.setattr(legacy_storage, "get_settings", lambda: settings)

    service = legacy_storage.StorageService()
    monkeypatch.setattr(service, "_ensure_bucket", lambda bucket: None)
    monkeypatch.setattr(service, "_upload_supabase", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("failed")))

    with pytest.raises(RuntimeError, match="云端存储"):
        service.upload_journal_image(BytesIO(b"image"), "photo.jpg", "user-1")

    assert list(tmp_path.rglob("*")) == []
