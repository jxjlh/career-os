"""职业规划中心: 现状描述 + AI 学习建议 + 计划同步."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile, UserSkill
from app.providers.ai import registry as ai_registry
from app.providers.ai.base import extract_json

router = APIRouter(tags=["career"])


class SituationCreate(BaseModel):
    currentSituation: str = Field(min_length=1, max_length=2000)
    targetRole: str | None = Field(default=None, max_length=200)
    weeklyHours: float | None = Field(default=None, ge=0, le=168)


@router.post("/career/suggestions")
async def career_suggestions(
    payload: SituationCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """根据当前现状生成学习建议; AI 不可用时返回结构化兜底建议."""
    skill_count = db.query(UserSkill).filter(UserSkill.user_id == current_user.id).count()
    prompt = (
        "你是职业规划顾问。基于用户现状生成 5 条可执行的学习建议，"
        "每条包含标题、理由、行动、资源关键词、建议周期。"
        "严格只返回 JSON: "
        '{"suggestions":[{"title":"...","reason":"...","action":"...","resources":["..."],"weeks":数字}]}\n'
        f"现状: {payload.currentSituation}\n"
        f"目标岗位: {payload.targetRole or '未设定'}\n"
        f"每周可投入小时: {payload.weeklyHours or 10}\n"
        f"已录入技能数: {skill_count}"
    )
    provider = ai_registry.get_ai_provider()
    try:
        reply = await provider.complete([{"role": "user", "content": prompt}], temperature=0.5, max_tokens=800)
        parsed = extract_json(reply)
    except Exception:
        parsed = None

    suggestions = (
        parsed.get("suggestions", [])
        if parsed and isinstance(parsed, dict)
        else _fallback_suggestions(payload.currentSituation, payload.targetRole)
    )
    return {"data": {"suggestions": suggestions[:8], "provider": "ai" if parsed else "fallback"}}


def _fallback_suggestions(situation: str, target_role: str | None) -> list[dict]:
    role = target_role or "目标岗位"
    return [
        {
            "title": f"拆解 {role} 的能力清单",
            "reason": "先知道目标岗位要什么，再决定学什么。",
            "action": "收集 5 个真实 JD，列出出现频率最高的 10 项技能。",
            "resources": ["Boss直聘", "拉勾网", "LinkedIn"],
            "weeks": 1,
        },
        {
            "title": "补齐一项可演示的核心技能",
            "reason": "简历上的技能需要有作品来证明。",
            "action": "围绕现状中最薄弱的技能完成一个最小实战项目。",
            "resources": ["B站教程", "官方文档", "GitHub"],
            "weeks": 4,
        },
        {
            "title": "建立每周复盘节奏",
            "reason": "持续反馈比一次突击更有效。",
            "action": "每周日记录学习时长、产出与下周计划。",
            "resources": ["Career OS 周计划", "Notion"],
            "weeks": 8,
        },
        {
            "title": "做一次真实场景输出",
            "reason": "输入只是过程，输出才能被看见。",
            "action": "写一篇总结或录一段讲解，发布到公开平台。",
            "resources": ["公众号", "掘金", "小红书"],
            "weeks": 3,
        },
        {
            "title": "准备岗位面试弹药库",
            "reason": "把项目经历整理成 STAR 故事，面试时直接调用。",
            "action": "为每个项目写 situation/task/action/result 四段话。",
            "resources": ["Career OS 面试中心", "作品集"],
            "weeks": 2,
        },
    ]
