"""存储服务: 封装 Supabase Storage 和本地回退."""

import io
from datetime import datetime
from pathlib import Path
from typing import BinaryIO

import httpx

from app.core.config import get_settings


class StorageService:
    """存储服务, 支持 Supabase Storage 和本地回退."""

    def __init__(self):
        self.settings = get_settings()

    def upload_chat_image(
        self,
        file: BinaryIO,
        filename: str,
        user_id: str,
        conversation_id: str,
    ) -> str:
        """上传聊天图片, 返回 URL."""
        # 生成唯一路径
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        ext = Path(filename).suffix or ".jpg"
        path = f"chat/{conversation_id}/{user_id}/{timestamp}{ext}"

        content = file.read()
        content_type = self._guess_content_type(ext)

        if self.settings.supabase_url and self.settings.supabase_service_role_key:
            return self._upload_supabase(path, content, content_type)
        return self._upload_local(path, content)

    def _upload_supabase(self, path: str, content: bytes, content_type: str) -> str:
        """上传到 Supabase Storage."""
        url = f"{self.settings.supabase_url}/storage/v1/object/chat-images/{path}"
        headers = {
            "Authorization": f"Bearer {self.settings.supabase_service_role_key}",
            "Content-Type": content_type,
        }

        # 同步包装（在路由中已经是同步调用）
        import requests
        response = requests.post(url, headers=headers, content=content, timeout=30)

        if response.status_code >= 400:
            # 回退到本地
            return self._upload_local(path, content)

        # 返回公共 URL
        return f"{self.settings.supabase_url}/storage/v1/object/public/chat-images/{path}"

    def _upload_local(self, path: str, content: bytes) -> str:
        """上传到本地 media 目录."""
        root = Path(self.settings.media_dir)
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return f"/media/{path}"

    def _guess_content_type(self, ext: str) -> str:
        """猜测文件类型."""
        types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        return types.get(ext.lower(), "application/octet-stream")

    def get_download_url(self, path: str) -> str | None:
        """获取下载 URL."""
        if path.startswith(("http://", "https://")):
            return path
        if path.startswith("/media/"):
            return path

        # Supabase 签名 URL
        if self.settings.supabase_url and self.settings.supabase_service_role_key:
            url = f"{self.settings.supabase_url}/storage/v1/object/sign/chat-images/{path}"
            headers = {"Authorization": f"Bearer {self.settings.supabase_service_role_key}"}

            import requests
            response = requests.post(url, headers=headers, json={"expiresIn": 3600}, timeout=15)

            if response.status_code < 400:
                signed = response.json().get("signedURL")
                if signed:
                    return f"{self.settings.supabase_url}{signed}" if signed.startswith("/") else signed

        # 本地回退
        local = Path(self.settings.media_dir) / path
        if local.is_file():
            return f"/media/{path}"

        return None