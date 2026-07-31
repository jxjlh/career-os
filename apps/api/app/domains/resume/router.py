from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import BackgroundJob, Profile, Project, Resume, ResumeVersion, Skill, UserSkill

router = APIRouter(tags=["resume"])


class ResumeCreate(BaseModel):
    title: str = "我的简历"
    language: str = "zh"


class ResumeGenerateRequest(BaseModel):
    language: str = "zh"
    targetTitle: str | None = None
    template: str = "clean"


class ResumeExportRequest(BaseModel):
    format: str = "pdf"


def resume_dict(resume: Resume) -> dict:
    return {
        "id": resume.id,
        "title": resume.title,
        "language": resume.language,
        "status": resume.status,
        "template": resume.template,
        "sections": resume.sections,
        "version": resume.version,
    }


def get_owned_resume(db: Session, user_id: str, resume_id: str) -> Resume:
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == user_id).first()
    if resume is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Resume not found"})
    return resume


def build_sections(db: Session, profile: Profile, target_title: str | None) -> dict:
    skills = [
        skill.name
        for skill in db.query(Skill)
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .filter(UserSkill.user_id == profile.id)
        .order_by(UserSkill.current_level.desc())
        .all()
    ]
    projects = (
        db.query(Project)
        .filter(Project.user_id == profile.id, Project.status != "archived")
        .order_by(Project.created_at.desc())
        .limit(3)
        .all()
    )
    return {
        "summary": f"目标岗位：{target_title or profile.target_title or '职业成长'}。擅长 {', '.join(skills[:5]) or '持续学习'}，注重用数据驱动业务结果。",
        "skills": skills[:12],
        "projects": [
            {"title": p.title, "description": p.description, "role": p.role, "tags": p.tags} for p in projects
        ],
        "experience": [],
        "education": [],
    }


@router.get("/resumes")
def list_resumes(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    resumes = (
        db.query(Resume)
        .filter(Resume.user_id == current_user.id)
        .order_by(Resume.created_at.desc())
        .all()
    )
    return {"data": [resume_dict(r) for r in resumes]}


@router.post("/resumes", status_code=201)
def create_resume(
    payload: ResumeCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    resume = Resume(user_id=current_user.id, title=payload.title, language=payload.language, status="draft")
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return {"data": resume_dict(resume)}


@router.get("/resumes/{resume_id}")
def get_resume(
    resume_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": resume_dict(get_owned_resume(db, current_user.id, resume_id))}


@router.post("/resumes/{resume_id}/generate", status_code=201)
def generate_resume(
    resume_id: str,
    payload: ResumeGenerateRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    resume = get_owned_resume(db, current_user.id, resume_id)
    resume.language = payload.language
    resume.template = payload.template
    resume.sections = build_sections(db, current_user, payload.targetTitle)
    resume.status = "ready"
    resume.version += 1
    db.add(ResumeVersion(resume_id=resume.id, user_id=current_user.id, version=resume.version, content=resume.sections))
    db.commit()
    db.refresh(resume)
    return {"data": resume_dict(resume)}


@router.post("/resumes/{resume_id}/versions", status_code=201)
def create_version(
    resume_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    resume = get_owned_resume(db, current_user.id, resume_id)
    resume.version += 1
    db.add(ResumeVersion(resume_id=resume.id, user_id=current_user.id, version=resume.version, content=resume.sections))
    db.commit()
    return {"data": {"resumeId": resume.id, "version": resume.version}}


@router.get("/resumes/{resume_id}/versions/{version}")
def get_version(
    resume_id: str,
    version: int,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    get_owned_resume(db, current_user.id, resume_id)
    item = (
        db.query(ResumeVersion)
        .filter(ResumeVersion.resume_id == resume_id, ResumeVersion.version == version)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Version not found"})
    return {"data": {"version": item.version, "content": item.content, "createdAt": item.created_at.isoformat()}}


@router.post("/resumes/{resume_id}/export", status_code=202)
def export_resume(
    resume_id: str,
    payload: ResumeExportRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    get_owned_resume(db, current_user.id, resume_id)
    job = BackgroundJob(
        user_id=current_user.id,
        job_type="export",
        payload={"resume_id": resume_id, "format": payload.format},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    def complete_export(job_id: str) -> None:
        from app.core.database import SessionLocal

        session = SessionLocal()
        try:
            item = session.get(BackgroundJob, job_id)
            if item:
                item.status = "succeeded"
                item.result = {"downloadUrl": f"/downloads/{job_id}", "format": payload.format}
                session.commit()
        finally:
            session.close()

    background_tasks.add_task(complete_export, job.id)
    return {
        "data": {
            "jobId": job.id,
            "status": job.status,
            "pollUrl": f"/api/v1/downloads/{job.id}",
        }
    }


@router.get("/downloads")
def list_downloads(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    jobs = (
        db.query(BackgroundJob)
        .filter(BackgroundJob.user_id == current_user.id, BackgroundJob.job_type == "export")
        .order_by(BackgroundJob.created_at.desc())
        .all()
    )
    return {
        "data": [
            {
                "id": j.id,
                "status": j.status,
                "result": j.result,
                "createdAt": j.created_at.isoformat(),
            }
            for j in jobs
        ]
    }


@router.get("/downloads/{job_id}")
def get_download(
    job_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id, BackgroundJob.user_id == current_user.id).first()
    if job is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Download not found"})
    return {"data": {"id": job.id, "status": job.status, "result": job.result or {}}}
