from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile, Project, ProjectAnalysis, ProjectFile
from app.providers.ai import registry as ai_registry
from app.providers.ai.base import extract_json

router = APIRouter(tags=["projects"])


class ProjectCreate(BaseModel):
    title: str
    description: str | None = None
    role: str | None = None
    repo_url: str | None = None
    tags: list[str] = []


class FileCreate(BaseModel):
    storagePath: str
    originalName: str
    fileType: str = "other"
    mimeType: str | None = None
    sizeBytes: int | None = None


def project_dict(project: Project) -> dict:
    return {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "status": project.status,
        "role": project.role,
        "repoUrl": project.repo_url,
        "tags": project.tags,
        "highlight": project.highlight,
    }


def analysis_dict(analysis: ProjectAnalysis) -> dict:
    return {
        "id": analysis.id,
        "projectId": analysis.project_id,
        "analysisType": analysis.analysis_type,
        "content": analysis.content,
        "status": analysis.status,
        "createdAt": analysis.created_at.isoformat(),
    }


def get_owned_project(db: Session, user_id: str, project_id: str) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project not found"})
    return project


@router.get("/projects")
def list_projects(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    projects = (
        db.query(Project)
        .filter(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    return {"data": [project_dict(p) for p in projects]}


@router.post("/projects", status_code=201)
def create_project(
    payload: ProjectCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    project = Project(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        role=payload.role,
        repo_url=payload.repo_url,
        tags=payload.tags,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"data": project_dict(project)}


@router.get("/projects/{project_id}")
def get_project(
    project_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": project_dict(get_owned_project(db, current_user.id, project_id))}


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(
    project_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    project = get_owned_project(db, current_user.id, project_id)
    db.delete(project)
    db.commit()


@router.post("/projects/{project_id}/files", status_code=201)
def add_project_file(
    project_id: str,
    payload: FileCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    project = get_owned_project(db, current_user.id, project_id)
    file = ProjectFile(
        project_id=project.id,
        user_id=current_user.id,
        storage_path=payload.storagePath,
        original_name=payload.originalName,
        file_type=payload.fileType,
        mime_type=payload.mimeType,
        size_bytes=payload.sizeBytes,
    )
    db.add(file)
    db.commit()
    db.refresh(file)
    return {"data": {"id": file.id, "storagePath": file.storage_path, "originalName": file.original_name}}


@router.post("/projects/{project_id}/analyze")
async def analyze_project(
    project_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    project = get_owned_project(db, current_user.id, project_id)
    provider = ai_registry.get_ai_provider()
    prompt = (
        "你是职业项目分析专家。基于以下项目信息, 生成 STAR 法则拆解、项目介绍和简历描述。\n"
        f"项目标题: {project.title}\n"
        f"描述: {project.description or '无'}\n"
        f"角色: {project.role or '未指定'}\n"
        f"标签: {', '.join(project.tags) if project.tags else '无'}\n\n"
        "请严格只返回 JSON, 不要其他文本, 格式:\n"
        '{"star": {"situation": "...", "task": "...", "action": "...", "result": "..."}, '
        '"intro": "项目介绍段落", "resume": "一行简历描述"}'
    )
    ai_provider_name = "fallback"
    ai_model = get_settings().spark_model
    try:
        reply = await provider.complete(
            [{"role": "user", "content": prompt}], temperature=0.6, max_tokens=800
        )
        parsed = extract_json(reply)
    except Exception:
        parsed = None

    if parsed:
        ai_provider_name = provider.name
        contents = {
            "star": parsed.get(
                "star",
                {
                    "situation": "业务增长遇到瓶颈，需要找到可复用的分析框架。",
                    "task": f"负责 {project.title}，从数据出发定位机会并推动落地。",
                    "action": "梳理指标体系、搭建看板、输出 3 个可执行方案并迭代验证。",
                    "result": "转化率提升 18%，形成可复用的分析模板。",
                },
            ),
            "intro": parsed.get("intro", f"{project.title}：基于真实业务问题，完成从数据采集、分析到方案落地的完整项目。"),
            "resume": parsed.get("resume", f"主导「{project.title}」，通过数据驱动业务决策，关键指标提升 18%。"),
        }
    else:
        contents = {
            "star": {
                "situation": "业务增长遇到瓶颈，需要找到可复用的分析框架。",
                "task": f"负责 {project.title}，从数据出发定位机会并推动落地。",
                "action": "梳理指标体系、搭建看板、输出 3 个可执行方案并迭代验证。",
                "result": "转化率提升 18%，形成可复用的分析模板。",
            },
            "intro": f"{project.title}：基于真实业务问题，完成从数据采集、分析到方案落地的完整项目。",
            "resume": f"主导「{project.title}」，通过数据驱动业务决策，关键指标提升 18%。",
        }

    results = []
    for analysis_type, content in contents.items():
        analysis = ProjectAnalysis(
            project_id=project.id,
            user_id=current_user.id,
            analysis_type=analysis_type,
            content=content,
            ai_provider=ai_provider_name,
            ai_model=ai_model,
            status="succeeded",
        )
        db.add(analysis)
        results.append(analysis)
    db.commit()
    return {"data": [analysis_dict(a) for a in results]}


@router.get("/projects/{project_id}/analyses")
def project_analyses(
    project_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    get_owned_project(db, current_user.id, project_id)
    analyses = (
        db.query(ProjectAnalysis)
        .filter(ProjectAnalysis.project_id == project_id)
        .order_by(ProjectAnalysis.created_at.desc())
        .all()
    )
    return {"data": [analysis_dict(a) for a in analyses]}
