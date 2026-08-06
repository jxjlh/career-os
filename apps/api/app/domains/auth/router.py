from datetime import date
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import BackgroundJob, Profile, Skill, UserLimit, UserSkill
from app.services.storage import StorageService

router = APIRouter(tags=["auth"])

class ProfileUpdate(BaseModel):
    display_name: str | None = None
    current_title: str | None = None
    company: str | None = None
    target_title: str | None = None
    target_salary: float | None = None
    currency: str | None = None
    experience_years: float | None = None
    timezone: str | None = None
    language: str | None = None
    weekly_study_minutes: int | None = None
    preferences: dict | None = None


class SkillInput(BaseModel):
    skill_id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    current_level: int = Field(default=1, ge=1, le=10)
    target_level: int = Field(default=5, ge=1, le=10)


class OnboardingRequest(BaseModel):
    current_title: str | None = None
    target_title: str = Field(min_length=1, max_length=120)
    target_salary: float | None = None
    experience_years: float | None = None
    weekly_study_minutes: int = Field(default=420, ge=0, le=6000)
    language: str = "zh-CN"
    skills: list[SkillInput] = Field(default_factory=list)


def _profile_dict(profile: Profile) -> dict:
    return {
        "id": profile.id,
        "email": profile.email,
        "displayName": profile.display_name,
        "avatarUrl": profile.avatar_url,
        "currentTitle": profile.current_title,
        "company": profile.company,
        "targetTitle": profile.target_title,
        "targetSalary": profile.target_salary,
        "currency": profile.currency,
        "experienceYears": profile.experience_years,
        "timezone": profile.timezone,
        "language": profile.language,
        "weeklyStudyMinutes": profile.weekly_study_minutes,
        "onboardingCompleted": profile.onboarding_completed,
        "preferences": profile.preferences or {},
    }


@router.get("/me")
def get_me(current_user: Annotated[Profile, Depends(get_current_user)]) -> dict:
    return {"data": _profile_dict(current_user)}


@router.patch("/me")
def patch_me(
    payload: ProfileUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return {"data": _profile_dict(current_user)}


@router.post("/me/avatar")
def upload_avatar(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    file: Annotated[UploadFile, File()],
) -> dict:
    """上传用户头像。

    接收 multipart/form-data 图片文件，存储后返回可访问的公共 URL，
    并同步更新 profile.avatar_url。支持 jpg/png/gif/webp，限制 5MB。
    """
    storage = StorageService()
    try:
        url = storage.upload_avatar(file.file, file.filename, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail={"code": "FILE_TOO_LARGE", "message": str(exc)}) from exc
    except Exception as exc:
        import logging
        logging.getLogger("upload_avatar").exception("头像上传异常")
        raise HTTPException(status_code=500, detail={"code": "UPLOAD_FAILED", "message": f"头像上传失败，请检查文件格式"}) from exc

    current_user.avatar_url = url
    db.commit()
    db.refresh(current_user)
    return {"data": {"avatarUrl": url, "profile": _profile_dict(current_user)}}


@router.get("/onboarding/status")
def onboarding_status(current_user: Annotated[Profile, Depends(get_current_user)]) -> dict:
    return {"data": {"completed": current_user.onboarding_completed, "step": 4 if current_user.onboarding_completed else 0}}


class SignupRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=6, max_length=128)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    avatar_url: str | None = None


@router.post("/signup")
async def signup(payload: SignupRequest, db: Annotated[Session, Depends(get_db)]) -> dict:
    """注册新用户：通过 Supabase Admin API 直接创建已确认邮箱的用户.

    绕过 Supabase 默认的邮箱验证流程 —— 注册后立即可用密码登录,
    无需等待邮件确认。需要后端配置 SUPABASE_SERVICE_ROLE_KEY。
    支持可选的 display_name (昵称) 和 avatar_url (头像)。
    """
    settings = get_settings()
    if not (settings.supabase_url and settings.supabase_service_role_key):
        raise HTTPException(
            status_code=503,
            detail={"code": "AUTH_NOT_CONFIGURED", "message": "Supabase service role not configured"},
        )

    admin_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }

    # 直接调用 Supabase Admin API 创建用户。
    # 不再做邮箱预检查 —— Supabase 的 /admin/users?email= 接口在该 service-role 下
    # 会返回全量用户列表而非按邮箱过滤，曾导致未注册邮箱被误判为已注册。
    # 改为依赖创建用户时 Supabase 原生返回的 422 状态码做冲突检测。
    body = {
        "email": payload.email,
        "password": payload.password,
        "email_confirm": True,
    }
    if payload.display_name:
        body["user_metadata"] = {"display_name": payload.display_name}
    if payload.avatar_url:
        if "user_metadata" not in body:
            body["user_metadata"] = {}
        body["user_metadata"]["avatar_url"] = payload.avatar_url

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(admin_url, headers=headers, json=body)
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail={"code": "AUTH_PROVIDER_ERROR", "message": f"Supabase request failed: {exc}"},
            ) from exc

    if resp.status_code >= 400:
        # 422 通常表示邮箱已注册（Supabase 原生冲突检测）
        if resp.status_code == 422:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "EMAIL_ALREADY_EXISTS",
                    "message": "该邮箱已注册，请直接登录或使用其他邮箱",
                },
            )
        try:
            err_body = resp.json()
            msg = err_body.get("msg") or err_body.get("message") or "注册失败，请稍后重试"
            code = err_body.get("error_code") or "SIGNUP_FAILED"
        except Exception:
            msg = f"注册失败: {resp.status_code}"
            code = "SIGNUP_FAILED"
        raise HTTPException(status_code=resp.status_code, detail={"code": code, "message": msg})

    user = resp.json()
    user_id = user.get("id")
    user_email = user.get("email")

    # 同时在本地 profiles 表创建用户档案
    profile = Profile(
        id=user_id,
        email=user_email,
        display_name=payload.display_name or user_email.split("@")[0],
        avatar_url=payload.avatar_url,
    )
    db.add(profile)
    db.commit()

    return {
        "data": {
            "userId": user_id,
            "email": user_email,
            "emailConfirmed": True,
            "displayName": profile.display_name,
            "avatarUrl": profile.avatar_url,
        }
    }


@router.get("/me/limits")
def my_limits(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    limit = (
        db.query(UserLimit)
        .filter(UserLimit.user_id == current_user.id, UserLimit.quota_date == date.today())
        .first()
    )
    if limit is None:
        limit = UserLimit(user_id=current_user.id, quota_date=date.today())
        db.add(limit)
        db.commit()
        db.refresh(limit)
    return {
        "data": {
            "date": limit.quota_date.isoformat(),
            "aiMessagesUsed": limit.ai_messages_used,
            "searchesUsed": limit.searches_used,
            "aiSummariesUsed": limit.ai_summaries_used,
            "quizUsed": limit.quiz_used,
            "interviewsUsed": limit.interviews_used,
            "resumesGenerated": limit.resumes_generated,
            "storageBytesUsed": limit.storage_bytes_used,
            # 所有 AI 功能无使用限制
            "dailyLimits": None,
        }
    }


@router.post("/onboarding")
def submit_onboarding(
    payload: OnboardingRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    current_user.current_title = payload.current_title
    current_user.target_title = payload.target_title
    current_user.target_salary = payload.target_salary
    current_user.experience_years = payload.experience_years
    current_user.weekly_study_minutes = payload.weekly_study_minutes
    current_user.language = payload.language
    current_user.onboarding_completed = True

    for item in payload.skills:
        skill = None
        if item.skill_id:
            skill = db.get(Skill, item.skill_id)
        if skill is None:
            skill = db.query(Skill).filter(Skill.name == item.name).first()
        if skill is None:
            skill = Skill(name=item.name, category="Other", description="由用户引导创建", is_ai_generated=False)
            db.add(skill)
            db.flush()
        existing = db.query(UserSkill).filter(UserSkill.user_id == current_user.id, UserSkill.skill_id == skill.id).first()
        if existing:
            existing.current_level = item.current_level
            existing.target_level = item.target_level
        else:
            db.add(
                UserSkill(
                    user_id=current_user.id,
                    skill_id=skill.id,
                    current_level=item.current_level,
                    target_level=item.target_level,
                )
            )

    job = BackgroundJob(user_id=current_user.id, job_type="onboarding_generate", payload={"target_title": payload.target_title})
    db.add(job)
    db.commit()
    db.refresh(job)
    return {
        "data": {
            "profile": _profile_dict(current_user),
            "jobId": job.id,
            "status": job.status,
            "pollUrl": f"/api/v1/explore/jobs/{job.id}",
        }
    }
