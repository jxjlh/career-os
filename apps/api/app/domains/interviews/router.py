from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import (
    Interview,
    InterviewAnswer,
    InterviewFeedback,
    InterviewQuestion,
    InterviewSession,
    Profile,
)
from app.providers.ai import registry as ai_registry
from app.providers.ai.base import extract_json

router = APIRouter(tags=["interviews"])


class InterviewCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    interview_type: str = "mock"
    mode: str = "behavioral"
    role: str | None = None
    difficulty: str = "intermediate"
    config: dict = {}


class InterviewUpdate(BaseModel):
    title: str | None = None
    status: str | None = None


class SessionCreate(BaseModel):
    questionCount: int = Field(default=5, ge=1, le=10)


class AnswerCreate(BaseModel):
    questionId: str | None = None
    answerText: str = Field(min_length=1)
    audioPath: str | None = None
    durationSeconds: int | None = None


def question_templates(mode: str, role: str | None) -> list[str]:
    role_text = role or "目标岗位"
    if mode == "technical":
        return [
            f"请解释你在 {role_text} 相关工作中最复杂的系统或分析方法，并说明技术选型。",
            "如何设计一个可扩展的数据分析流程？",
            "遇到性能或质量问题时，你的排查思路是什么？",
            "如何保证项目交付的稳定性与可维护性？",
            "描述一次你通过技术方案驱动业务结果的经历。",
        ]
    if mode == "star":
        return [
            f"请用 STAR 法则描述一次你在 {role_text} 工作中的关键项目。",
            "描述一次你推动跨团队协作并取得成果的经历。",
            "描述一次你面对失败并从中改进的经历。",
            "描述一次你在资源有限的情况下完成目标的经历。",
            "描述一次你用数据影响决策的经历。",
        ]
    return [
        f"请做一段 1 分钟自我介绍，重点说明你为什么适合 {role_text}。",
        "你未来 3 年的职业目标是什么？为什么？",
        "为什么选择跳槽或转型到这个方向？",
        "你的优势与待提升项分别是什么？",
        "你最近学习的一项新技能是什么，如何应用？",
    ]


def interview_dict(db: Session, interview: Interview) -> dict:
    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.interview_id == interview.id)
        .order_by(InterviewSession.created_at.desc())
        .all()
    )
    return {
        "id": interview.id,
        "title": interview.title,
        "interviewType": interview.interview_type,
        "mode": interview.mode,
        "role": interview.role,
        "difficulty": interview.difficulty,
        "status": interview.status,
        "config": interview.config,
        "sessions": [
            {
                "id": s.id,
                "status": s.status,
                "startedAt": s.started_at.isoformat(),
                "endedAt": s.ended_at.isoformat() if s.ended_at else None,
            }
            for s in sessions
        ],
    }


def get_owned_interview(db: Session, user_id: str, interview_id: str) -> Interview:
    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.user_id == user_id).first()
    if interview is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Interview not found"})
    return interview


def get_owned_session(db: Session, user_id: str, session_id: str) -> InterviewSession:
    session = (
        db.query(InterviewSession).filter(InterviewSession.id == session_id, InterviewSession.user_id == user_id).first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Session not found"})
    return session


@router.get("/interviews")
def list_interviews(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    interviews = (
        db.query(Interview)
        .filter(Interview.user_id == current_user.id)
        .order_by(Interview.created_at.desc())
        .all()
    )
    return {"data": [interview_dict(db, i) for i in interviews]}


@router.post("/interviews", status_code=201)
def create_interview(
    payload: InterviewCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    interview = Interview(
        user_id=current_user.id,
        title=payload.title,
        interview_type=payload.interview_type,
        mode=payload.mode,
        role=payload.role,
        difficulty=payload.difficulty,
        config=payload.config,
        status="ready",
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return {"data": interview_dict(db, interview)}


@router.get("/interviews/{interview_id}")
def get_interview(
    interview_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": interview_dict(db, get_owned_interview(db, current_user.id, interview_id))}


@router.patch("/interviews/{interview_id}")
def update_interview(
    interview_id: str,
    payload: InterviewUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    interview = get_owned_interview(db, current_user.id, interview_id)
    if payload.title is not None:
        interview.title = payload.title
    if payload.status is not None:
        interview.status = payload.status
    db.commit()
    db.refresh(interview)
    return {"data": interview_dict(db, interview)}


@router.delete("/interviews/{interview_id}", status_code=204)
def delete_interview(
    interview_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    interview = get_owned_interview(db, current_user.id, interview_id)
    db.delete(interview)
    db.commit()


@router.post("/interviews/{interview_id}/sessions", status_code=201)
def start_session(
    interview_id: str,
    payload: SessionCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    interview = get_owned_interview(db, current_user.id, interview_id)
    session = InterviewSession(interview_id=interview.id, user_id=current_user.id, status="in_progress")
    db.add(session)
    db.flush()
    for index, question in enumerate(question_templates(interview.mode, interview.role)[: payload.questionCount]):
        db.add(
            InterviewQuestion(
                session_id=session.id,
                user_id=current_user.id,
                question=question,
                type=interview.mode,
                difficulty=interview.difficulty,
                sort_order=index,
            )
        )
    interview.status = "in_progress"
    db.commit()
    db.refresh(session)
    questions = (
        db.query(InterviewQuestion)
        .filter(InterviewQuestion.session_id == session.id)
        .order_by(InterviewQuestion.sort_order)
        .all()
    )
    return {
        "data": {
            "sessionId": session.id,
            "status": session.status,
            "questions": [
                {"id": q.id, "question": q.question, "type": q.type, "sortOrder": q.sort_order} for q in questions
            ],
        }
    }


@router.post("/sessions/{session_id}/answer")
def submit_answer(
    session_id: str,
    payload: AnswerCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = get_owned_session(db, current_user.id, session_id)
    answer = InterviewAnswer(
        session_id=session.id,
        question_id=payload.questionId,
        user_id=current_user.id,
        answer_text=payload.answerText,
        audio_path=payload.audioPath,
        duration_seconds=payload.durationSeconds,
    )
    db.add(answer)
    transcript = session.transcript or {}
    answers = transcript.get("answers", [])
    answers.append(
        {
            "questionId": payload.questionId,
            "answerText": payload.answerText,
            "audioPath": payload.audioPath,
            "durationSeconds": payload.durationSeconds,
            "answeredAt": datetime.utcnow().isoformat(),
        }
    )
    session.transcript = {**transcript, "answers": answers}
    db.commit()
    db.refresh(answer)
    return {"data": {"answerId": answer.id, "saved": True}}


@router.post("/sessions/{session_id}/answers/voice")
def submit_voice_answer(
    session_id: str,
    payload: AnswerCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = get_owned_session(db, current_user.id, session_id)
    if payload.audioPath:
        audio_paths = session.audio_paths or []
        audio_paths.append(payload.audioPath)
        session.audio_paths = audio_paths
    db.commit()
    return submit_answer(session_id, payload, current_user, db)


@router.get("/sessions/{session_id}/transcript")
def get_transcript(
    session_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = get_owned_session(db, current_user.id, session_id)
    answers = (
        db.query(InterviewAnswer)
        .filter(InterviewAnswer.session_id == session.id)
        .order_by(InterviewAnswer.created_at)
        .all()
    )
    return {
        "data": {
            "sessionId": session.id,
            "audioPaths": session.audio_paths,
            "answers": [
                {
                    "id": a.id,
                    "questionId": a.question_id,
                    "answerText": a.answer_text,
                    "audioPath": a.audio_path,
                    "durationSeconds": a.duration_seconds,
                }
                for a in answers
            ],
        }
    }


@router.post("/sessions/{session_id}/finish")
async def finish_session(
    session_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = get_owned_session(db, current_user.id, session_id)
    session.status = "completed"
    session.ended_at = datetime.utcnow()

    answers = (
        db.query(InterviewAnswer)
        .filter(InterviewAnswer.session_id == session.id)
        .order_by(InterviewAnswer.created_at)
        .all()
    )
    qa_lines: list[str] = []
    for a in answers:
        question = (
            db.query(InterviewQuestion).filter(InterviewQuestion.id == a.question_id).first()
            if a.question_id
            else None
        )
        qa_lines.append(f"问: {question.question if question else '(无)'}\n答: {a.answer_text}")
    qa_text = "\n\n".join(qa_lines)

    overall_score = 78
    dimensions = {
        "structure": {"score": 82, "comment": "使用了总分总结构"},
        "star": {"score": 74, "comment": "结果量化可以更充分"},
        "expression": {"score": 84, "comment": "表达流畅"},
        "technical_depth": {"score": 72, "comment": "补充原理与权衡"},
        "time_control": {"score": 80, "comment": "时间控制良好"},
    }
    strengths = "逻辑清晰，案例完整"
    improvements = "增加数据结果、量化指标与复盘"
    sample_answer = "参考答案：使用 STAR 结构，先说明背景与任务，再描述行动，最后用 2-3 个数字展示结果。"
    ai_provider_name = "fallback"

    if qa_text.strip():
        provider = ai_registry.get_ai_provider()
        prompt = (
            "你是资深面试官。基于以下面试问答, 从结构、STAR 完整度、表达、技术深度、时间控制五个维度评分(0-100), "
            "并给出优势、改进建议和参考答案。\n"
            f"问答记录:\n{qa_text}\n\n"
            "请严格只返回 JSON, 不要其他文本, 格式:\n"
            '{"overall_score": 78, "dimensions": {"structure": {"score": 80, "comment": "..."}, '
            '"star": {"score": 75, "comment": "..."}, "expression": {"score": 82, "comment": "..."}, '
            '"technical_depth": {"score": 70, "comment": "..."}, "time_control": {"score": 78, "comment": "..."}}, '
            '"strengths": "...", "improvements": "...", "sample_answer": "..."}'
        )
        try:
            reply = await provider.complete(
                [{"role": "user", "content": prompt}], temperature=0.4, max_tokens=1000
            )
            parsed = extract_json(reply)
        except Exception:
            parsed = None

        if parsed:
            ai_provider_name = provider.name
            if isinstance(parsed.get("overall_score"), (int, float)):
                overall_score = int(parsed["overall_score"])
            if isinstance(parsed.get("dimensions"), dict):
                merged = {}
                for dim_key, dim_default in dimensions.items():
                    ai_dim = parsed["dimensions"].get(dim_key, {})
                    if isinstance(ai_dim, dict):
                        merged[dim_key] = {
                            "score": int(ai_dim.get("score", dim_default["score"])),
                            "comment": str(ai_dim.get("comment", dim_default["comment"])),
                        }
                    else:
                        merged[dim_key] = dim_default
                dimensions = merged
            if parsed.get("strengths"):
                strengths = str(parsed["strengths"])
            if parsed.get("improvements"):
                improvements = str(parsed["improvements"])
            if parsed.get("sample_answer"):
                sample_answer = str(parsed["sample_answer"])

    feedback = InterviewFeedback(
        session_id=session.id,
        user_id=current_user.id,
        overall_score=overall_score,
        dimensions=dimensions,
        strengths=strengths,
        improvements=improvements,
        sample_answer=sample_answer,
        ai_provider=ai_provider_name,
        ai_model=get_settings().spark_model,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return {"data": {"sessionId": session.id, "status": session.status, "feedbackId": feedback.id}}


@router.get("/sessions/{session_id}/feedback")
def get_feedback(
    session_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    feedback = (
        db.query(InterviewFeedback)
        .filter(InterviewFeedback.session_id == session_id, InterviewFeedback.user_id == current_user.id)
        .order_by(InterviewFeedback.created_at.desc())
        .first()
    )
    if feedback is None:
        return {"data": None}
    return {
        "data": {
            "id": feedback.id,
            "overallScore": feedback.overall_score,
            "dimensions": feedback.dimensions,
            "strengths": feedback.strengths,
            "improvements": feedback.improvements,
            "sampleAnswer": feedback.sample_answer,
            "aiProvider": feedback.ai_provider,
            "aiModel": feedback.ai_model,
        }
    }
