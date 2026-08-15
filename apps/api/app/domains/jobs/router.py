from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Job, JobAnalysis, Profile, Skill, UserSkill
from app.providers.ai import registry as ai_registry
from app.providers.ai.base import extract_json

router = APIRouter(tags=["jobs"])


ROLE_LIBRARY = {
    "数据分析师": {"interests": {"数据", "商业", "研究"}, "skills": [("SQL", 7), ("Python", 6), ("Power BI", 6)], "jd": "负责业务数据分析、指标体系建设、可视化和增长建议；要求熟练 SQL，具备 Python 或 BI 工具能力。"},
    "产品经理": {"interests": {"产品", "用户", "商业"}, "skills": [("需求分析", 7), ("产品设计", 7), ("数据分析", 5)], "jd": "负责用户研究、需求拆解、产品方案和跨团队推进；要求具备产品设计、沟通和数据分析能力。"},
    "增长运营": {"interests": {"增长", "用户", "内容"}, "skills": [("用户运营", 7), ("数据分析", 6), ("A/B 测试", 5)], "jd": "负责拉新、留存、转化实验与增长复盘；要求熟悉用户运营、数据分析和实验设计。"},
    "后端工程师": {"interests": {"技术", "系统", "编程"}, "skills": [("Python", 7), ("SQL", 6), ("系统设计", 6)], "jd": "负责服务端接口、数据模型、性能与稳定性；要求掌握 Python、数据库和系统设计基础。"},
}


class TargetRoleSurvey(BaseModel):
    interests: list[str] = Field(default_factory=list, max_length=8)


class TargetRoleUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class TargetRoleSkillsRequest(BaseModel):
    skills: list[str] = Field(min_length=1, max_length=20)


def role_dict(title: str) -> dict:
    role = ROLE_LIBRARY[title]
    return {"title": title, "requirements": [{"name": name, "level": level} for name, level in role["skills"]], "jd": role["jd"]}


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


async def analyze_job(db: Session, job: Job, user_id: str) -> JobAnalysis:
    required_skills = ["SQL", "Power BI", "Python"]
    extracted = [{"name": name, "level": 5 + index} for index, name in enumerate(required_skills)]
    required_experience = job.jd_raw or "3-5 年相关经验"
    recommendations: list[dict] = []
    ai_provider_name = "fallback"

    provider = ai_registry.get_ai_provider()
    prompt = (
        "你是招聘 JD 分析专家。从以下 JD 中提取 required skills、经验要求和学习建议。\n"
        f"JD: {job.jd_raw or '(空)'}\n\n"
        "请严格只返回 JSON, 不要其他文本, 格式:\n"
        '{"extracted_skills": [{"name": "SQL", "level": 5}], '
        '"required_experience": "3-5 年", '
        '"recommendations": [{"type": "resource", "title": "学习建议", "status": "missing"}]}'
    )
    try:
        reply = await provider.complete(
            [{"role": "user", "content": prompt}], temperature=0.4, max_tokens=600
        )
        parsed = extract_json(reply)
    except Exception:
        parsed = None

    if parsed:
        ai_provider_name = provider.name
        ai_extracted = parsed.get("extracted_skills")
        if isinstance(ai_extracted, list) and ai_extracted:
            extracted = [
                {"name": str(s.get("name", "")), "level": int(s.get("level", 5))}
                for s in ai_extracted
                if s.get("name")
            ]
        if parsed.get("required_experience"):
            required_experience = str(parsed["required_experience"])
        if isinstance(parsed.get("recommendations"), list):
            recommendations = parsed["recommendations"]

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
    if not recommendations:
        recommendations = [
            {"type": "resource", "title": f"学习 {g['name']} 基础与实战", "status": g["status"]}
            for g in gaps
            if g["status"] != "mastered"
        ]
    analysis = JobAnalysis(
        job_id=job.id,
        user_id=user_id,
        extracted_skills=extracted,
        required_experience=required_experience,
        skill_gaps=gaps,
        match_score=match_score,
        recommendations=recommendations,
        ai_provider=ai_provider_name,
        ai_model=get_settings().spark_model,
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


@router.post("/jobs/target-role/recommend")
def recommend_target_role(payload: TargetRoleSurvey) -> dict:
    selected = {item.strip() for item in payload.interests if item.strip()}
    ranked = sorted(
        ROLE_LIBRARY,
        key=lambda title: (len(selected.intersection(ROLE_LIBRARY[title]["interests"])), title),
        reverse=True,
    )
    return {"data": {"roles": [role_dict(title) for title in ranked[:3]]}}


@router.get("/jobs/target-role")
def get_target_role(current_user: Annotated[Profile, Depends(get_current_user)]) -> dict:
    title = current_user.target_title
    return {"data": {"title": title, "role": role_dict(title) if title in ROLE_LIBRARY else None}}


@router.put("/jobs/target-role")
def save_target_role(
    payload: TargetRoleUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    if payload.title not in ROLE_LIBRARY:
        raise HTTPException(status_code=422, detail={"code": "UNKNOWN_ROLE", "message": "请选择推荐岗位"})
    current_user.target_title = payload.title
    db.commit()
    return {"data": {"title": payload.title, "role": role_dict(payload.title)}}


@router.get("/jobs/target-role/jd")
def target_role_jd(title: str) -> dict:
    if title not in ROLE_LIBRARY:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "岗位 JD 不存在"})
    return {"data": role_dict(title)}


@router.post("/jobs/target-role/skills")
def add_target_role_skills(
    payload: TargetRoleSkillsRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    added: list[str] = []
    for name in dict.fromkeys(skill.strip() for skill in payload.skills if skill.strip()):
        skill = db.query(Skill).filter(Skill.name == name).first()
        if skill is None:
            skill = Skill(name=name, category="目标岗位", description="由目标岗位 JD 要求生成", is_ai_generated=True)
            db.add(skill)
            db.flush()
        user_skill = db.query(UserSkill).filter(UserSkill.user_id == current_user.id, UserSkill.skill_id == skill.id).first()
        if user_skill is None:
            db.add(UserSkill(user_id=current_user.id, skill_id=skill.id, current_level=1, target_level=6, learning_status="learning"))
            added.append(name)
    db.commit()
    return {"data": {"added": added}}


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
async def analyze_job_endpoint(
    job_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    job = get_owned_job(db, current_user.id, job_id)
    return {"data": analysis_dict(await analyze_job(db, job, current_user.id))}


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
async def job_gap(
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
        analysis = await analyze_job(db, job, current_user.id)
    return {
        "data": {
            "jobId": job.id,
            "matchScore": analysis.match_score,
            "gaps": analysis.skill_gaps,
            "recommendations": analysis.recommendations,
        }
    }
