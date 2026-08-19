from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import BackgroundJob, PlanTask, Profile, Skill, UserSkill, WeeklyPlan
from app.domains.explorer.router import run_search_job
from app.domains.planner.service import _recompute_plan_stats
from app.domains.skills.service import SkillService
from app.providers.ai import registry as ai_registry
from app.providers.ai.base import extract_json

router = APIRouter(tags=["skills"])


class SkillProgressUpdate(BaseModel):
    currentLevel: int = Field(ge=1, le=10)
    targetLevel: int = Field(ge=1, le=10)
    confidence: float = Field(default=0, ge=0, le=100)
    notes: str | None = None
    learningStatus: Literal["mastered", "learning"] | None = None


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(default="自定义", min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    currentLevel: int = Field(default=1, ge=1, le=10)
    targetLevel: int = Field(default=5, ge=1, le=10)
    learningStatus: Literal["mastered", "learning"] = "learning"


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    learningStatus: Literal["mastered", "learning"] | None = None


class SkillRecommendationRequest(BaseModel):
    currentSituation: str | None = Field(default=None, max_length=2000)
    weeklyMinutes: int = Field(default=420, ge=30, le=10080)


class SkillPlanRequest(BaseModel):
    currentSituation: str | None = Field(default=None, max_length=2000)
    weeklyMinutes: int = Field(default=420, ge=30, le=10080)


class SkillResourceSearchRequest(BaseModel):
    query: str = Field(default="", max_length=160)
    limit: int = Field(default=12, ge=1, le=20)


class JdExtractRequest(BaseModel):
    jd: str = Field(min_length=20, max_length=8000)


@router.get("/skills")
def list_skills(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SkillService(db).catalog()}


@router.get("/skills/matrix")
def skill_matrix(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": {"items": SkillService(db).matrix(current_user)}}


@router.post("/skills", status_code=201)
def create_skill(
    payload: SkillCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    existing = db.query(Skill).filter(Skill.name == payload.name.strip()).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail={"code": "DUPLICATE", "message": "该技能已经存在"})
    skill = Skill(
        name=payload.name.strip(),
        category=payload.category.strip(),
        description=payload.description,
        is_ai_generated=False,
    )
    db.add(skill)
    db.flush()
    row = UserSkill(
        user_id=current_user.id,
        skill_id=skill.id,
        current_level=payload.currentLevel,
        target_level=payload.targetLevel,
        learning_status=payload.learningStatus,
    )
    db.add(row)
    db.commit()
    db.refresh(skill)
    db.refresh(row)
    return {"data": SkillService(db).update_progress(current_user, skill.id, row.current_level, row.target_level, row.confidence, row.notes)}


@router.patch("/skills/{skill_id}")
def update_skill(
    skill_id: str,
    payload: SkillUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"})
    if payload.name and payload.name.strip() != skill.name:
        duplicate = db.query(Skill).filter(Skill.name == payload.name.strip(), Skill.id != skill_id).first()
        if duplicate is not None:
            raise HTTPException(status_code=409, detail={"code": "DUPLICATE", "message": "该技能已经存在"})
        skill.name = payload.name.strip()
    if payload.category is not None:
        skill.category = payload.category.strip()
    if payload.description is not None:
        skill.description = payload.description
    user_skill = db.query(UserSkill).filter(UserSkill.user_id == current_user.id, UserSkill.skill_id == skill_id).first()
    if payload.learningStatus is not None:
        if user_skill is None:
            user_skill = UserSkill(user_id=current_user.id, skill_id=skill_id, learning_status=payload.learningStatus)
            db.add(user_skill)
        else:
            user_skill.learning_status = payload.learningStatus
    db.commit()
    from app.domains.skills.service import skill_dict

    return {"data": skill_dict(skill, user_skill)}


@router.delete("/skills/{skill_id}", status_code=204)
def delete_skill(
    skill_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    row = db.query(UserSkill).filter(UserSkill.user_id == current_user.id, UserSkill.skill_id == skill_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "该技能不在你的学习列表中"})
    db.query(PlanTask).filter(PlanTask.user_id == current_user.id, PlanTask.skill_id == skill_id).update(
        {PlanTask.skill_id: None}, synchronize_session=False
    )
    db.delete(row)
    if db.query(UserSkill).filter(UserSkill.skill_id == skill_id, UserSkill.user_id != current_user.id).count() == 0:
        skill = db.query(Skill).filter(Skill.id == skill_id, Skill.is_ai_generated.is_(False)).first()
        if skill is not None:
            db.delete(skill)
    db.commit()


@router.put("/skills/{skill_id}/progress")
def update_skill_progress(
    skill_id: str,
    payload: SkillProgressUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    try:
        result = SkillService(db).update_progress(
            current_user,
            skill_id,
            payload.currentLevel,
            payload.targetLevel,
            payload.confidence,
            payload.notes,
            payload.learningStatus,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"}) from exc
    return {"data": result}


@router.get("/skills/{skill_id}/detail")
def skill_detail(
    skill_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    try:
        return {"data": SkillService(db).detail(current_user, skill_id)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"}) from exc


@router.post("/skills/{skill_id}/knowledge")
async def skill_knowledge(
    skill_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"})
    user_skill = db.query(UserSkill).filter(UserSkill.user_id == current_user.id, UserSkill.skill_id == skill_id).first()
    current_level = user_skill.current_level if user_skill else 0
    target_level = user_skill.target_level if user_skill else 5
    prompt = (
        "你是学习教练。请根据技能、当前等级和目标等级，列出用户需要掌握的具体知识点。"
        '严格返回 JSON：{"knowledgePoints":[{"title":"","description":"","order":1}]}。'
        f"技能: {skill.name}\n描述: {skill.description or '未填写'}\n当前等级: {current_level}\n目标等级: {target_level}"
    )
    parsed = None
    try:
        parsed = extract_json(await ai_registry.get_ai_provider().complete([{"role": "user", "content": prompt}], temperature=0.3, max_tokens=1000))
    except Exception:
        parsed = None
    points = parsed.get("knowledgePoints", []) if isinstance(parsed, dict) else []
    if not points:
        points = [
            {"title": f"理解 {skill.name} 的核心概念", "description": "能够用自己的话解释定义、边界和常见应用。", "order": 1},
            {"title": f"完成一次 {skill.name} 实操", "description": "围绕真实场景完成一个可验证的小练习。", "order": 2},
            {"title": f"复盘 {skill.name} 的常见问题", "description": "能够识别错误并说明排查和改进步骤。", "order": 3},
        ]
    return {"data": {"skillId": skill.id, "skillName": skill.name, "knowledgePoints": points[:12], "provider": "ai" if parsed else "fallback"}}


@router.post("/skills/{skill_id}/resources", status_code=202)
def skill_resources(
    skill_id: str,
    payload: SkillResourceSearchRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"})
    query = f"{skill.name} {payload.query}".strip()
    job = BackgroundJob(
        user_id=current_user.id,
        job_type="skill_bilibili_search",
        payload={"query": query, "providers": ["bilibili"]},
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_search_job, job.id, query, payload.limit, current_user.language, ["bilibili"])
    return {"data": {"jobId": job.id, "status": job.status, "provider": "bilibili"}}


@router.post("/skills/{skill_id}/recommendations")
async def skill_recommendations(
    skill_id: str,
    payload: SkillRecommendationRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"})
    prompt = (
        "你是学习教练。请针对一个技能给出可执行的学习资源、7天计划和考核重点。"
        "资源必须是可以搜索的真实方向，不要编造网址。严格返回 JSON："
        '{"resources":[{"title":"","type":"book/course/article/project","query":"","reason":""}],'
        '"plan":[{"day":1,"title":"","minutes":30,"outcome":""}],'
        '"assessment":["..."]}。'
        f"技能: {skill.name}\n当前水平: {skill.description or '未填写'}\n每周学习分钟: {payload.weeklyMinutes}\n"
        f"学习现状: {payload.currentSituation or '未填写'}"
    )
    provider = ai_registry.get_ai_provider()
    try:
        parsed = extract_json(await provider.complete([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=1400))
    except Exception:
        parsed = None
    provider_name = "ai" if isinstance(parsed, dict) and parsed.get("resources") else "fallback"
    if not isinstance(parsed, dict) or not parsed.get("resources"):
        parsed = {
            "resources": [
                {"title": f"{skill.name} 官方文档与入门教程", "type": "article", "query": f"{skill.name} official documentation beginner", "reason": "先建立准确的概念和工具基础。"},
                {"title": f"{skill.name} 实战项目", "type": "project", "query": f"{skill.name} real world project tutorial", "reason": "用一个可展示的产出验证理解。"},
                {"title": f"{skill.name} 常见面试题与练习", "type": "course", "query": f"{skill.name} practice exercises interview questions", "reason": "通过练习暴露知识盲区。"},
            ],
            "plan": [
                {"day": day, "title": f"学习 {skill.name}：第 {day} 天练习", "minutes": max(30, payload.weeklyMinutes // 7), "outcome": "完成一段笔记或一个练习结果"}
                for day in range(1, 8)
            ],
            "assessment": [f"能否解释 {skill.name} 的核心概念？", "能否独立完成一个真实场景练习？", "能否复盘并说明自己的取舍？"],
        }
    return {"data": {"skillId": skill.id, "skillName": skill.name, **parsed, "provider": provider_name}}


@router.post("/skills/{skill_id}/plan")
async def generate_skill_plan(
    skill_id: str,
    payload: SkillPlanRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """为当前技能生成并持久化本周七天计划，避免依赖全局计划的技能关联推断。"""
    recommendation = await skill_recommendations(
        skill_id,
        SkillRecommendationRequest(
            currentSituation=payload.currentSituation,
            weeklyMinutes=payload.weeklyMinutes,
        ),
        current_user,
        db,
    )
    data = recommendation["data"]
    week_start = date.today() - timedelta(days=date.today().weekday())
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id, WeeklyPlan.week_start == week_start)
        .first()
    )
    if plan is None:
        plan = WeeklyPlan(user_id=current_user.id, week_start=week_start, title=f"{data['skillName']} 本周计划")
        db.add(plan)
        db.flush()

    db.query(PlanTask).filter(PlanTask.plan_id == plan.id, PlanTask.skill_id == skill_id).delete(
        synchronize_session=False
    )
    plan_items = data.get("plan") or []
    tasks: list[PlanTask] = []
    for index in range(1, 8):
        item = next((candidate for candidate in plan_items if int(candidate.get("day") or 0) == index), None)
        title = str(item.get("title") if item else f"学习 {data['skillName']}：第 {index} 天练习").strip()
        minutes = int(item.get("minutes") if item else max(30, payload.weeklyMinutes // 7))
        task = PlanTask(
            plan_id=plan.id,
            user_id=current_user.id,
            title=title[:300],
            day=index,
            estimated_minutes=max(10, min(minutes, 600)),
            status="todo",
            sort_order=index,
            description=(str(item.get("outcome"))[:500] if item and item.get("outcome") else None),
            task_type="learning" if index < 7 else "review",
            difficulty="medium",
            priority="medium",
            ai_generated=data.get("provider") == "ai",
            skill_id=skill_id,
        )
        db.add(task)
        tasks.append(task)
    plan.status = "active"
    plan.title = f"{data['skillName']} 本周计划"
    plan.skill_ids = sorted(set((plan.skill_ids or []) + [skill_id]))
    _recompute_plan_stats(db, plan)
    db.commit()
    for task in tasks:
        db.refresh(task)
    return {
        "data": {
            "skillId": skill_id,
            "skillName": data["skillName"],
            "provider": data.get("provider", "fallback"),
            "tasks": [
                {
                    "id": task.id,
                    "skillId": task.skill_id,
                    "title": task.title,
                    "day": task.day,
                    "estimatedMinutes": task.estimated_minutes,
                    "status": task.status,
                }
                for task in tasks
            ],
        }
    }


@router.get("/skills/{skill_id}/weekly-tasks")
def list_skill_weekly_tasks(
    skill_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """返回关联到该技能的本周 PlanTask, 用于技能详情页展示「本周练习」."""
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Skill not found"})

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    rows = (
        db.query(PlanTask)
        .join(WeeklyPlan, WeeklyPlan.id == PlanTask.plan_id)
        .filter(
            WeeklyPlan.user_id == current_user.id,
            WeeklyPlan.week_start == week_start,
            PlanTask.skill_id == skill_id,
        )
        .order_by(PlanTask.day, PlanTask.sort_order)
        .all()
    )

    # 累计本周该技能的学习时长 (分钟)
    total_minutes = sum(t.estimated_minutes for t in rows)
    done_minutes = sum(t.estimated_minutes for t in rows if t.status == "done")

    # 用户技能差距 (用于显示进度上下文)
    us = (
        db.query(UserSkill)
        .filter(UserSkill.user_id == current_user.id, UserSkill.skill_id == skill_id)
        .first()
    )
    return {
        "data": {
            "skillId": skill_id,
            "skillName": skill.name,
            "weekStart": week_start.isoformat(),
            "currentLevel": us.current_level if us else 0,
            "targetLevel": us.target_level if us else 0,
            "total": len(rows),
            "done": sum(1 for t in rows if t.status == "done"),
            "totalMinutes": total_minutes,
            "doneMinutes": done_minutes,
            "tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "day": t.day,
                    "status": t.status,
                    "taskType": t.task_type,
                    "priority": t.priority,
                    "estimatedMinutes": t.estimated_minutes,
                    "planId": t.plan_id,
                }
                for t in rows
            ],
        }
    }


class BulkSkillAdd(BaseModel):
    skills: list[dict] = Field(min_length=1, max_length=20)


@router.post("/skills/bulk", status_code=201)
def bulk_add_skills(
    payload: BulkSkillAdd,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """批量添加技能到用户矩阵，已存在的技能自动跳过。"""
    added = []
    skipped = []
    for item in payload.skills:
        name = str(item.get("name", "")).strip()[:120]
        if not name:
            continue
        existing = db.query(Skill).filter(Skill.name == name).first()
        if existing is not None:
            user_row = db.query(UserSkill).filter(
                UserSkill.user_id == current_user.id,
                UserSkill.skill_id == existing.id,
            ).first()
            if user_row is not None:
                skipped.append(name)
                continue
            skill = existing
        else:
            skill = Skill(
                name=name,
                category=str(item.get("category", "JD 提取")).strip()[:80],
                is_ai_generated=True,
            )
            db.add(skill)
            db.flush()
        row = UserSkill(
            user_id=current_user.id,
            skill_id=skill.id,
            current_level=1,
            target_level=max(1, min(10, int(item.get("suggestedLevel", 5)))),
            learning_status="not_started",
        )
        db.add(row)
        added.append(name)
    db.commit()
    return {"data": {"added": added, "skipped": skipped}}


@router.post("/skills/from-jd")
async def extract_skills_from_jd(
    payload: JdExtractRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """从 JD 文本中用 AI 提取所需技能列表，供用户选择性加入技能矩阵。"""
    existing_names = {s.name for s in db.query(Skill).all()}
    prompt = (
        "你是技术招聘专家。从以下职位描述（JD）中提取所需的技能清单。"
        "只提取明确或隐含需要的专业技能，忽略通用软技能（如沟通、团队合作）。"
        "严格返回 JSON："
        '{"skills":[{"name":"技能名","category":"分类","suggestedLevel":5,"reason":"为什么需要"]]}'
        "。suggestedLevel 取 1-10，初级岗 3-5，中级岗 5-7，高级岗 7-9。"
        "category 从以下选：编程语言、框架、工具、数据库、云平台、方法论、领域知识。"
        f"\n\nJD 内容：\n{payload.jd}"
    )
    provider = ai_registry.get_ai_provider()
    try:
        parsed = extract_json(
            await provider.complete(
                [{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=1500,
            )
        )
    except Exception:
        parsed = None
    if not isinstance(parsed, dict) or not isinstance(parsed.get("skills"), list):
        return {"data": {"skills": [], "provider": "fallback"}}
    skills = []
    for item in parsed["skills"][:20]:
        if not isinstance(item, dict) or not item.get("name"):
            continue
        name = str(item["name"]).strip()[:120]
        skills.append({
            "name": name,
            "category": str(item.get("category", "JD 提取")).strip()[:80],
            "suggestedLevel": max(1, min(10, int(item.get("suggestedLevel", 5)))),
            "reason": str(item.get("reason", "")).strip()[:200],
            "alreadyAdded": name in existing_names,
        })
    return {"data": {"skills": skills, "provider": "ai"}}
