"""存储服务: 封装 Supabase Storage 和本地回退."""

from datetime import datetime
from pathlib import Path
from typing import BinaryIO

import httpx

from app.core.config import get_settings


class StorageService:
    """存储服务, 支持 Supabase Storage 和本地回退."""

    def __init__(self):
        self.settings = get_settings()

    def _abs_media_dir(self) -> Path:
        """获取 media 绝对路径，确保生产环境也能正确定位."""
        root = Path(self.settings.media_dir)
        if root.is_absolute():
            return root
        # 相对路径: 基于应用根目录 (apps/api/)
        app_root = Path(__file__).resolve().parent.parent.parent
        return app_root / root

    def upload_chat_image(
        self,
        file: BinaryIO,
        filename: str,
        user_id: str,
        conversation_id: str,
    ) -> str:
        """上传聊天图片, 返回 URL."""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        ext = Path(filename).suffix or ".jpg"
        path = f"chat/{conversation_id}/{user_id}/{timestamp}{ext}"

        content = file.read()
        content_type = self._guess_content_type(ext)

        if not self._supabase_configured():
            if self._cloud_storage_required():
                raise RuntimeError("云端存储尚未配置，无法保存图片，请联系管理员后重试")
            return self._upload_local(path, content)

        try:
            self._ensure_bucket("chat-images")
            return self._upload_supabase(path, content, content_type, bucket="chat-images")
        except Exception as exc:
            if self._cloud_storage_required():
                raise RuntimeError("云端存储上传失败，请稍后重试") from exc
            return self._upload_local(path, content)

    def upload_avatar(
        self,
        file: BinaryIO,
        filename: str | None,
        user_id: str,
    ) -> str:
        """上传用户头像, 返回公共 URL."""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        safe_filename = filename or "avatar.jpg"
        ext = Path(safe_filename).suffix or ".jpg"
        if ext.lower() not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
            ext = ".jpg"
        path = f"avatars/{user_id}/{timestamp}{ext}"

        content = file.read()
        if len(content) > 5 * 1024 * 1024:
            raise ValueError("头像文件过大，请上传 5MB 以内的图片")
        content_type = self._guess_content_type(ext)

        if not self._supabase_configured():
            if self._cloud_storage_required():
                raise RuntimeError("云端存储尚未配置，无法保存头像，请联系管理员后重试")
            return self._upload_local(path, content)

        try:
            self._ensure_bucket("avatars")
            return self._upload_supabase(path, content, content_type, bucket="avatars")
        except Exception as exc:
            if self._cloud_storage_required():
                raise RuntimeError("头像上传失败，请稍后重试") from exc
            return self._upload_local(path, content)

    def upload_journal_image(
        self,
        file: BinaryIO,
        filename: str,
        user_id: str,
    ) -> str:
        """上传日记图片, 返回 URL."""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        ext = Path(filename).suffix or ".jpg"
        if ext.lower() not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
            ext = ".jpg"
        date_str = datetime.utcnow().strftime("%Y%m%d")
        path = f"journal/{user_id}/{date_str}/{timestamp}{ext}"

        content = file.read()
        if len(content) > 8 * 1024 * 1024:
            raise ValueError("日记图片过大，请上传 8MB 以内的图片")
        content_type = self._guess_content_type(ext)

        if not self._supabase_configured():
            if self._cloud_storage_required():
                raise RuntimeError("云端存储尚未配置，无法保存图片，请联系管理员后重试")
            return self._upload_local(path, content)

        try:
            self._ensure_bucket("journal-images")
            return self._upload_supabase(path, content, content_type, bucket="journal-images")
        except Exception as exc:
            if self._cloud_storage_required():
                raise RuntimeError("云端存储上传失败，请稍后重试") from exc
            return self._upload_local(path, content)

    def _supabase_configured(self) -> bool:
        """检查 Supabase 是否完整配置."""
        return bool(
            self.settings.supabase_url
            and self.settings.supabase_service_role_key
        )

    def _cloud_storage_required(self) -> bool:
        return self.settings.app_env.strip().lower() not in {"dev", "development", "test", "testing"}

    def _upload_supabase(
        self,
        path: str,
        content: bytes,
        content_type: str,
        bucket: str = "chat-images",
    ) -> str:
        """上传到 Supabase Storage，失败时抛出异常由调用方处理."""
        url = f"{self.settings.supabase_url}/storage/v1/object/{bucket}/{path}"
        headers = {
            "Authorization": f"Bearer {self.settings.supabase_service_role_key}",
            "Content-Type": content_type,
        }

        with httpx.Client(timeout=30.0, trust_env=False) as client:
            response = client.post(url, headers=headers, content=content)

        if response.status_code >= 400:
            raise RuntimeError(f"Supabase upload failed: HTTP {response.status_code}")

        return f"{self.settings.supabase_url}/storage/v1/object/public/{bucket}/{path}"

    def _ensure_bucket(self, bucket: str) -> None:
        """确保 Supabase Storage 桶存在；已存在时保持幂等。"""
        url = f"{self.settings.supabase_url}/storage/v1/bucket"
        headers = {
            "Authorization": f"Bearer {self.settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=15.0, trust_env=False) as client:
            response = client.post(
                url,
                headers=headers,
                json={"id": bucket, "name": bucket, "public": True},
            )
        if response.status_code >= 400 and response.status_code not in (400, 409):
            raise RuntimeError(f"Supabase bucket setup failed: HTTP {response.status_code}")

    def _upload_local(self, path: str, content: bytes) -> str:
        """上传到本地 media 目录."""
        root = self._abs_media_dir()
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return f"/media/{path}"

    def _guess_content_type(self, ext: str) -> str:
        types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        return types.get(ext.lower(), "application/octet-stream")

    def get_download_url(self, path: str) -> str | None:
        """获取下载 URL - 返回永久公开 URL 而非临时签名 URL."""
        if path.startswith(("http://", "https://")):
            return path

        if path.startswith("/media/"):
            return path if not self._cloud_storage_required() else None

        if self._supabase_configured():
            # 根据路径前缀确定桶名
            if path.startswith("journal/"):
                bucket = "journal-images"
            elif path.startswith("chat/"):
                bucket = "chat-images"
            elif path.startswith("avatars/"):
                bucket = "avatars"
            else:
                bucket = "chat-images"
            # 返回永久公开 URL (桶创建时已设为 public: True)
            return f"{self.settings.supabase_url}/storage/v1/object/public/{bucket}/{path}"

        local = self._abs_media_dir() / path
        if not self._cloud_storage_required() and local.is_file():
            return f"/media/{path}"

        return None
