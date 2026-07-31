from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Job, JobAnalysis, Profile, Skill, UserSkill

router = APIRouter(tags=["jobs"])


class JobCreate(BaseModel):
    title: str
    company: str | None = None
    location: str | None = None
    url: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    jd_raw: str | None = None


class JobUpdate(BaseModel):
    status: str | None = None
    match_score: float | None = None


def job_dict(job: Job) -> dict:
    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "url": job.url,
        "salaryMin": job.salary_min,
        "salaryMax": job.salary_max,
        "status": job.status,
        "matchScore": job.match_score,
    }


def analysis_dict(analysis: JobAnalysis) -> dict:
    return {
        "id": analysis.id,
        "jobId": analysis.job_id,
        "extractedSkills": analysis.extracted_skills,
        "requiredExperience": analysis.required_experience,
        "skillGaps": analysis.skill_gaps,
        "matchScore": analysis.match_score,
        "recommendations": analysis.recommendations,
        "createdAt": analysis.created_at.isoformat(),
    }


def get_owned_job(db: Session, user_id: str, job_id: str) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Job not found"})
    return job


def analyze_job(db: Session, job: Job, user_id: str) -> JobAnalysis:
    required_skills = ["SQL", "Power BI", "Python"]
    extracted = [
        {"name": name, "level": 5 + index}
        for index, name in enumerate(required_skills)
    ]
    user_skills = {
        us.skill_id: us
        for us in db.query(UserSkill).filter(UserSkill.user_id == user_id).all()
    }
    skill_map = {skill.name: skill for skill in db.query(Skill).all()}
    gaps = []
    for item in extracted:
        skill = skill_map.get(item["name"])
        user_skill = user_skills.get(skill.id) if skill else None
        current = user_skill.current_level if user_skill else 0
        gaps.append(
            {
                "name": item["name"],
                "currentLevel": current,
                "requiredLevel": item["level"],
                "gap": max(0, item["level"] - current),
                "status": "missing" if current == 0 else ("improving" if current < item["level"] else "mastered"),
            }
        )
    match_score = round(100 * sum(g["gap"] == 0 for g in gaps) / max(len(gaps), 1), 2)
    analysis = JobAnalysis(
        job_id=job.id,
        user_id=user_id,
        extracted_skills=extracted,
        required_experience=job.jd_raw or "3-5 年相关经验",
        skill_gaps=gaps,
        match_score=match_score,
        recommendations=[
            {"type": "resource", "title": f"学习 {g['name']} 基础与实战", "status": g["status"]}
            for g in gaps
            if g["status"] != "mastered"
        ],
        ai_provider="mock",
        ai_model="Spark-X2-Flash",
    )
    job.match_score = match_score
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


@router.get("/jobs")
def list_jobs(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    jobs = db.query(Job).filter(Job.user_id == current_user.id).order_by(Job.created_at.desc()).all()
    return {"data": [job_dict(j) for j in jobs]}


@router.post("/jobs", status_code=201)
def create_job(
    payload: JobCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    job = Job(
        user_id=current_user.id,
        title=payload.title,
        company=payload.company,
        location=payload.location,
        url=payload.url,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        jd_raw=payload.jd_raw,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"data": job_dict(job)}


@router.get("/jobs/{job_id}")
def get_job(
    job_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": job_dict(get_owned_job(db, current_user.id, job_id))}


@router.patch("/jobs/{job_id}")
def update_job(
    job_id: str,
    payload: JobUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    job = get_owned_job(db, current_user.id, job_id)
    if payload.status is not None:
        job.status = payload.status
    if payload.match_score is not None:
        job.match_score = payload.match_score
    db.commit()
    db.refresh(job)
    return {"data": job_dict(job)}


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(
    job_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    job = get_owned_job(db, current_user.id, job_id)
    db.delete(job)
    db.commit()


@router.post("/jobs/{job_id}/analyze", status_code=201)
def analyze_job_endpoint(
    job_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    job = get_owned_job(db, current_user.id, job_id)
    return {"data": analysis_dict(analyze_job(db, job, current_user.id))}


@router.get("/jobs/{job_id}/analyses")
def job_analyses(
    job_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    get_owned_job(db, current_user.id, job_id)
    analyses = (
        db.query(JobAnalysis)
        .filter(JobAnalysis.job_id == job_id, JobAnalysis.user_id == current_user.id)
        .order_by(JobAnalysis.created_at.desc())
        .all()
    )
    return {"data": [analysis_dict(a) for a in analyses]}


@router.get("/jobs/{job_id}/gap")
def job_gap(
    job_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    job = get_owned_job(db, current_user.id, job_id)
    analysis = (
        db.query(JobAnalysis)
        .filter(JobAnalysis.job_id == job.id, JobAnalysis.user_id == current_user.id)
        .order_by(JobAnalysis.created_at.desc())
        .first()
    )
    if analysis is None:
        analysis = analyze_job(db, job, current_user.id)
    return {
        "data": {
            "jobId": job.id,
            "matchScore": analysis.match_score,
            "gaps": analysis.skill_gaps,
            "recommendations": analysis.recommendations,
        }
    }
