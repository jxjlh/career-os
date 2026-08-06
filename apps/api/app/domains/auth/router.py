from datetime import date
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import BackgroundJob, Profile, Skill, UserLimit, UserSkill

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

    # 1. 先检查邮箱是否已存在
    async with httpx.AsyncClient(timeout=15.0) as client:
        existing_check = await client.get(
            f"{admin_url}?email={payload.email}",
            headers=headers,
        )
        if existing_check.status_code == 200:
            existing_users = existing_check.json()
            if existing_users:
                raise HTTPException(
                    status_code=409,
                    detail={"code": "EMAIL_ALREADY_EXISTS", "message": "该邮箱已注册，请直接登录或使用其他邮箱"},
                )

    # 2. 创建新用户
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
        try:
            err_body = resp.json()
            msg = err_body.get("msg") or err_body.get("message") or "Signup failed"
            code = err_body.get("error_code") or "SIGNUP_FAILED"
        except Exception:
            msg = f"Signup failed: {resp.status_code}"
            code = "SIGNUP_FAILED"
        status = 409 if resp.status_code == 422 else resp.status_code
        raise HTTPException(status_code=status, detail={"code": code, "message": msg})

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
            "dailyLimits": {
                "aiMessages": 30,
                "searches": 20,
                "aiSummaries": 20,
                "quiz": 10,
                "interviews": 3,
                "resumes": 3,
            },
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
