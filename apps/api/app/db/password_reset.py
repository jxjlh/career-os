from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


class PasswordResetCode(Base):
    """密码重置验证码.

    自研重置流程：后端生成验证码 → 走自己的 SMTP 秒发 → 用户填码 →
    服务端用 Supabase Admin API 直接改密码，绕开 Supabase 自带邮件（慢、易进垃圾箱）。
    独立成文件而非放 models.py：热修部署只需替换 app 目录，放在哪个模块都会被
    create_all 注册（router 导入即注册），这里保持小而独立。
    """

    __tablename__ = "password_reset_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    email: Mapped[str] = mapped_column(String(320), index=True)
    code: Mapped[str] = mapped_column(String(8))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
