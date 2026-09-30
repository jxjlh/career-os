from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.profile.schemas import (
    MottoStyleIn,
    MottoStyleOut,
    ProfileResponse,
    ProfileUpdate,
)
from app.domains.profile.service import ProfileService

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=ProfileResponse)
def get_profile(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ProfileResponse:
    return ProfileService(db).get(current_user.id)


@router.put("/profile", response_model=ProfileResponse)
def update_profile(
    payload: ProfileUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ProfileResponse:
    return ProfileService(db).update(current_user.id, payload)


# ── 座右铭富文本：单独两个口子，避免把背景图塞进通用 /profile 的响应里 ──


@router.get("/profile/motto", response_model=MottoStyleOut)
def get_motto_style(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MottoStyleOut:
    return ProfileService(db).get_motto_style(current_user.id)


@router.put("/profile/motto", response_model=MottoStyleOut)
def update_motto_style(
    payload: MottoStyleIn,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MottoStyleOut:
    return ProfileService(db).update_motto_style(current_user.id, payload)
