from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile, SalaryPlan

router = APIRouter(tags=["salary"])


class SalaryGenerateRequest(BaseModel):
    currentSalary: float = Field(ge=0)
    targetSalary: float = Field(ge=0)
    currency: str = "CNY"
    horizonYears: int = Field(default=3, ge=1, le=10)
    assumptions: dict = {}


def plan_dict(plan: SalaryPlan) -> dict:
    return {
        "id": plan.id,
        "currentSalary": plan.current_salary,
        "targetSalary": plan.target_salary,
        "currency": plan.currency,
        "horizonYears": plan.horizon_years,
        "assumptions": plan.assumptions,
        "breakdown": plan.breakdown,
        "status": plan.status,
    }


def build_breakdown(plan: SalaryPlan) -> dict:
    gap = max(0, plan.target_salary - plan.current_salary)
    phases = [
        {
            "phase": "第一阶段：技能与项目",
            "timeline": "0-6 个月",
            "targetSalary": round(plan.current_salary + gap * 0.3),
            "jobLevel": "中级",
            "skills": ["SQL", "Power BI", "Python"],
            "projects": ["数据分析看板", "增长分析报告"],
            "actions": ["完成 3 个实战项目", "建立作品集"],
        },
        {
            "phase": "第二阶段：作品与面试",
            "timeline": "6-18 个月",
            "targetSalary": round(plan.current_salary + gap * 0.65),
            "jobLevel": "高级",
            "skills": ["AI Agent", "产品思维"],
            "projects": ["自动化分析系统"],
            "actions": ["模拟面试 6 场", "准备 STAR 案例"],
        },
        {
            "phase": "第三阶段：跳槽与议薪",
            "timeline": "18-36 个月",
            "targetSalary": plan.target_salary,
            "jobLevel": "经理 / 高级专家",
            "skills": ["团队影响", "业务结果"],
            "projects": ["主导跨部门项目"],
            "actions": ["投递目标岗位", "谈判薪酬包"],
        },
    ]
    return {"phases": phases}


@router.post("/salary-plans/generate", status_code=201)
def generate_salary_plan(
    payload: SalaryGenerateRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    plan = SalaryPlan(
        user_id=current_user.id,
        current_salary=payload.currentSalary,
        target_salary=payload.targetSalary,
        currency=payload.currency,
        horizon_years=payload.horizonYears,
        assumptions=payload.assumptions,
    )
    plan.breakdown = build_breakdown(plan)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {"data": plan_dict(plan)}


@router.get("/salary-plans/{plan_id}")
def get_salary_plan(
    plan_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    plan = db.query(SalaryPlan).filter(SalaryPlan.id == plan_id, SalaryPlan.user_id == current_user.id).first()
    if plan is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Salary plan not found"})
    return {"data": plan_dict(plan)}


@router.patch("/salary-plans/{plan_id}")
def update_salary_plan(
    plan_id: str,
    payload: SalaryGenerateRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    plan = db.query(SalaryPlan).filter(SalaryPlan.id == plan_id, SalaryPlan.user_id == current_user.id).first()
    if plan is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Salary plan not found"})
    plan.current_salary = payload.currentSalary
    plan.target_salary = payload.targetSalary
    plan.currency = payload.currency
    plan.horizon_years = payload.horizonYears
    plan.assumptions = payload.assumptions
    plan.breakdown = build_breakdown(plan)
    plan.status = "updated"
    db.commit()
    db.refresh(plan)
    return {"data": plan_dict(plan)}
