from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

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
