import base64
import json
import re

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import UserProfile
from app.domains.profile.repository import UserProfileRepository
from app.domains.profile.schemas import (
    MottoSegment,
    MottoStyleIn,
    MottoStyleOut,
    ProfileResponse,
    ProfileUpdate,
)

# 座右铭纯文本上限（与 life_motto 列宽、前端 MOTTO_MAX_LEN 保持一致）
MOTTO_MAX_LEN = 300
# 背景图 data URL 的体积上限（前端已压缩到 ~1MB 内，这里再兜一层）
MOTTO_IMAGE_MAX_BYTES = 4 * 1024 * 1024

_DATA_URL_RE = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", re.S)


def to_response(profile: UserProfile) -> ProfileResponse:
    return ProfileResponse(
        userId=profile.user_id,
        nickname=profile.nickname,
        avatar=profile.avatar,
        bio=profile.bio,
        birthYear=profile.birth_year,
        currentStage=profile.current_stage,
        strengths=profile.strengths or [],
        interests=profile.interests or [],
        careerDirection=profile.career_direction,
        lifeMotto=profile.life_motto,
        createdAt=profile.created_at.isoformat() if profile.created_at else None,
        updatedAt=profile.updated_at.isoformat() if profile.updated_at else None,
    )


class ProfileService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = UserProfileRepository(db)

    def get_or_create(self, user_id: str) -> UserProfile:
        profile = self.repository.get_by_user(user_id)
        if profile is None:
            profile = self.repository.create(user_id)
        return profile

    def get(self, user_id: str) -> ProfileResponse:
        return to_response(self.get_or_create(user_id))

    def update(self, user_id: str, payload: ProfileUpdate) -> ProfileResponse:
        profile = self.get_or_create(user_id)
        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            if value is not None:
                setattr(profile, field, value)

        # 同步 Profile 表的 display_name —— 好友搜索 (social 模块) 依赖此字段,
        # 否则用户设置了昵称后, 其他人按昵称搜索不到.
        if data.get("nickname") is not None:
            from app.db.models import Profile

            base_profile = self.db.get(Profile, user_id)
            if base_profile is not None:
                base_profile.display_name = data["nickname"]

        self.db.commit()
        self.db.refresh(profile)
        return to_response(profile)

    # ── 座右铭富文本（首页 + 人生目标页跨设备同步） ─────────────────────────

    def get_motto_style(self, user_id: str) -> MottoStyleOut:
        return _motto_out(self.get_or_create(user_id))

    def update_motto_style(self, user_id: str, payload: MottoStyleIn) -> MottoStyleOut:
        profile = self.get_or_create(user_id)

        segs = [seg for seg in payload.segs if seg.t]
        plain = "".join(seg.t for seg in segs)
        if not plain.strip():
            raise AppError(code="MOTTO_EMPTY", message="座右铭不能为空", status=422)
        if len(plain) > MOTTO_MAX_LEN:
            raise AppError(
                code="MOTTO_TOO_LONG",
                message=f"座右铭最多 {MOTTO_MAX_LEN} 个字",
                status=422,
            )

        image = _store_motto_image(payload.image, user_id)
        profile.life_motto_style = json.dumps(
            {"segs": [seg.model_dump(exclude_none=True) for seg in segs], "image": image},
            ensure_ascii=False,
        )
        # 纯文本镜像：老客户端 / 还没升级的前端至少能读到文字
        profile.life_motto = plain

        self.db.commit()
        self.db.refresh(profile)
        return _motto_out(profile)


def _motto_out(profile: UserProfile) -> MottoStyleOut:
    """读库里的样式 JSON；脏数据/老数据（只有 life_motto）都兜底成单片段。"""
    raw = profile.life_motto_style
    if raw:
        try:
            data = json.loads(raw)
            segs = [MottoSegment(**seg) for seg in data.get("segs", []) if seg.get("t")]
            if segs:
                image = data.get("image") or None
                return MottoStyleOut(
                    segs=segs,
                    image=image,
                    updatedAt=profile.updated_at.isoformat() if profile.updated_at else None,
                )
        except (ValueError, TypeError):
            # 存坏了就当没样式，走下面的纯文本兜底
            pass

    segs = [MottoSegment(t=profile.life_motto)] if profile.life_motto else []
    return MottoStyleOut(
        segs=segs,
        image=None,
        updatedAt=profile.updated_at.isoformat() if profile.updated_at else None,
    )


def _store_motto_image(value: str | None, user_id: str) -> str | None:
    """背景图入库前先落到对象存储，库里只留可公开访问的 URL。

    - 已是 http(s) / /media 路径 → 原样返回（用户没换图）
    - data URL → 解码后上传，返回公共 URL
    - 其它一律当没有
    """
    if not value:
        return None
    if value.startswith(("http://", "https://", "/media/")):
        return value

    match = _DATA_URL_RE.match(value)
    if not match:
        return None

    content_type, b64 = match.group(1), match.group(2)
    try:
        raw = base64.b64decode(b64, validate=False)
    except (ValueError, TypeError):
        return None
    if not raw or len(raw) > MOTTO_IMAGE_MAX_BYTES:
        raise AppError(
            code="MOTTO_IMAGE_TOO_LARGE",
            message="背景图过大，请换一张较小的图片（建议 2MB 以内）",
            status=422,
        )

    if "png" in content_type:
        ext = ".png"
    elif "webp" in content_type:
        ext = ".webp"
    else:
        ext = ".jpg"

    from app.services.storage import StorageService

    try:
        return StorageService().upload_motto_background(raw, user_id, ext)
    except (RuntimeError, ValueError) as exc:
        raise AppError(code="MOTTO_IMAGE_FAILED", message=str(exc), status=502) from exc
