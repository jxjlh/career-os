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


class AssessmentAnswer(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(default="", max_length=3000)


class AssessmentRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    level: str = Field(default="入门", max_length=40)
    answers: list[AssessmentAnswer] = Field(default_factory=list, max_length=8)


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


@router.post("/career/assessment")
async def career_assessment(
    payload: AssessmentRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
) -> dict:
    """生成学习考察题并对完成的回答评分，AI 不可用时使用可解释的兜底评分。"""
    if not payload.answers:
        prompt = (
            "你是学习教练。请为下面的技能生成 5 道开放式考察题，覆盖概念、应用和排错。"
            '严格返回 JSON: {"questions":[{"question":"...","rubric":"..."}]}。'
            f"技能: {payload.topic}\n水平: {payload.level}"
        )
        provider = ai_registry.get_ai_provider()
        try:
            parsed = extract_json(await provider.complete([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=900))
        except Exception:
            parsed = None
        questions = parsed.get("questions", []) if isinstance(parsed, dict) else []
        if not questions:
            questions = [
                {"question": f"请用自己的话解释 {payload.topic} 的核心概念。", "rubric": "概念准确、表达清楚"},
                {"question": f"在真实项目中，你会如何使用 {payload.topic}？", "rubric": "能联系场景并给出步骤"},
                {"question": f"学习 {payload.topic} 时最容易出现什么问题？如何排查？", "rubric": "能识别风险并提出排错方法"},
                {"question": f"请设计一个 30 分钟的 {payload.topic} 练习。", "rubric": "目标明确、练习可执行"},
                {"question": f"你准备如何证明自己掌握了 {payload.topic}？", "rubric": "有可验证的产出或指标"},
            ]
        return {"data": {"topic": payload.topic, "questions": questions[:5], "score": None}}

    provider = ai_registry.get_ai_provider()
    prompt = (
        "你是学习教练，请按每题 0-100 分评价回答，返回 JSON。"
        '格式: {"score":数字,"feedback":"...","items":[{"question":"...","score":数字,"feedback":"..."}]}。'
        f"技能: {payload.topic}\n水平: {payload.level}\n回答: {payload.answers}"
    )
    try:
        parsed = extract_json(await provider.complete([{"role": "user", "content": prompt}], temperature=0.2, max_tokens=900))
    except Exception:
        parsed = None
    if isinstance(parsed, dict) and isinstance(parsed.get("score"), (int, float)):
        return {"data": {"topic": payload.topic, "score": round(max(0, min(100, parsed["score"])), 1), "feedback": parsed.get("feedback", ""), "items": parsed.get("items", [])}}
    items = []
    for answer in payload.answers:
        length_score = min(100, max(20, len(answer.answer.strip()) * 2)) if answer.answer.strip() else 0
        items.append({"question": answer.question, "score": length_score, "feedback": "补充一个具体例子或操作步骤" if length_score < 70 else "回答包含了可验证的学习内容"})
    score = round(sum(item["score"] for item in items) / max(len(items), 1), 1)
    return {"data": {"topic": payload.topic, "score": score, "feedback": "评分基于回答完整度；继续补充项目案例可获得更准确的 AI 评分。", "items": items}}
