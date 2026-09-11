"""CareerOS 每日小记 AI 陪伴服务.

提供: AI 听见 / 情绪镜子 / 心理天气 / AI 陪伴对话.
核心理念: 倾听 > 分析, 理解 > 诊断.
"""

import json
import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile, DailyJournal
from app.domains.ai.prompts.journal_companion import (
    JOURNAL_COMPANION_SYSTEM,
    JOURNAL_HEAR_PROMPT,
    JOURNAL_MIRROR_PROMPT,
    JOURNAL_WEATHER_PROMPT,
    JOURNAL_CHAT_PROMPT,
    JOURNAL_PATTERNS_PROMPT,
    JOURNAL_WORD_INSIGHT_PROMPT,
)
from app.domains.ai.repository import AIContentRepository
from app.providers.ai.base import AIProvider, extract_json
from app.providers.ai.registry import get_ai_provider

MOOD_LABELS = ["糟糕", "一般", "还行", "很好", "超赞"]
MOOD_WEATHER = ["⛈️", "☁️", "⛅", "⛅", "☀️"]
WEATHER_EMPTY = "☁️"


class HearRequest(BaseModel):
    journals: list[dict]


class ChatRequest(BaseModel):
    session_id: str | None = None
    mode: str = "chat"
    message: str
    journal_id: str | None = None


class JournalCompanionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = AIContentRepository(db)

    async def _call_ai(self, prompt: str, input_data: dict, user_id: str, content_type: str) -> dict:
        ai = get_ai_provider()
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps(input_data, ensure_ascii=False)},
        ]
        try:
            raw = await ai.complete(messages, response_format="json_object", temperature=0.6)
        except Exception as exc:
            return {}
        parsed = extract_json(raw)
        if parsed is None:
            return {}
        self.repository.create(
            user_id=user_id,
            content_type=content_type,
            input_json=input_data,
            output_json=parsed,
            provider=ai.name,
            model=getattr(ai, "model", None) or "default",
        )
        return parsed

    def _format_journals(self, journals: list[DailyJournal]) -> str:
        if not journals:
            return "（今天还没有写小记）"
        lines = []
        for j in journals:
            mood_label = MOOD_LABELS[j.mood_index] if 0 <= j.mood_index < len(MOOD_LABELS) else "未知"
            parts = [f"心情: {mood_label}"]
            if j.time_slot:
                parts.append(f"时段: {j.time_slot}")
            if j.content:
                parts.append(f"内容: {j.content}")
            if j.tags:
                parts.append(f"标签: {', '.join(j.tags)}")
            lines.append(" | ".join(parts))
        return "\n".join(lines)

    async def hear(self, user_id: str, journals_data: list[dict]) -> dict:
        journals_text = "\n".join(
            f"心情: {MOOD_LABELS[min(j.get('moodIndex', 1), 4)]}"
            + (f" | 内容: {j['content']}" if j.get("content") else "")
            + (f" | 标签: {', '.join(j.get('tags', []))}" if j.get("tags") else "")
            for j in journals_data
        )
        prompt = JOURNAL_HEAR_PROMPT.format(
            system=JOURNAL_COMPANION_SYSTEM,
            journals_text=journals_text or "（今天还没有写小记）",
        )
        result = await self._call_ai(prompt, {"journals": journals_data}, user_id, "journal_companion_hear")
        if not result:
            return {
                "reflection": "我在听。",
                "moodThemes": [],
                "gentleObservation": "",
                "suggestedMode": "listen",
                "isHighRisk": False,
            }
        return {
            "reflection": result.get("reflection", ""),
            "moodThemes": result.get("mood_themes", []),
            "gentleObservation": result.get("gentle_observation", ""),
            "suggestedMode": result.get("suggested_mode", "chat"),
            "isHighRisk": result.get("is_high_risk", False),
        }

    async def get_mirror(self, user_id: str, target_date: date) -> dict:
        journals = (
            self.db.query(DailyJournal)
            .filter(
                DailyJournal.user_id == user_id,
                DailyJournal.journal_date == target_date,
            )
            .order_by(DailyJournal.time_slot)
            .all()
        )
        if not journals:
            return None

        journals_text = self._format_journals(journals)
        prompt = JOURNAL_MIRROR_PROMPT.format(
            system=JOURNAL_COMPANION_SYSTEM,
            date=target_date.isoformat(),
            journals_text=journals_text,
        )
        result = await self._call_ai(prompt, {"date": target_date.isoformat()}, user_id, "journal_companion_mirror")
        if not result:
            avg_mood = sum(j.mood_index for j in journals) / len(journals)
            summary = "有点累。" if avg_mood < 2 else "状态还行。" if avg_mood < 3 else "不错的一天。"
            return {
                "date": target_date.isoformat(),
                "summary": summary,
                "moodTags": [{"emoji": "😐", "label": "平静"}],
                "observation": "",
                "insight": "",
            }
        return {
            "date": result.get("date", target_date.isoformat()),
            "summary": result.get("summary", ""),
            "moodTags": result.get("mood_tags", []),
            "observation": result.get("observation", ""),
            "insight": result.get("insight", ""),
        }

    async def get_weather(self, user_id: str, days: int = 7) -> dict:
        end_date = date.today()
        start_date = end_date - timedelta(days=days - 1)

        journals = (
            self.db.query(DailyJournal)
            .filter(
                DailyJournal.user_id == user_id,
                DailyJournal.journal_date >= start_date,
                DailyJournal.journal_date <= end_date,
            )
            .order_by(DailyJournal.journal_date)
            .all()
        )

        mood_by_date: dict[str, list[int]] = {}
        for j in journals:
            d = j.journal_date.isoformat()
            mood_by_date.setdefault(d, []).append(j.mood_index)

        forecast = []
        for i in range(days):
            d = start_date + timedelta(days=i)
            d_str = d.isoformat()
            moods = mood_by_date.get(d_str, [])
            if moods:
                avg = round(sum(moods) / len(moods))
                weather = MOOD_WEATHER[min(avg, 4)]
                mood = min(avg, 4)
            else:
                weather = WEATHER_EMPTY
                mood = -1
            forecast.append({"date": d_str, "weather": weather, "mood": mood})

        mood_history = "\n".join(
            f"{f['date']}: {f['weather']}" for f in forecast
        )
        prompt = JOURNAL_WEATHER_PROMPT.format(
            system=JOURNAL_COMPANION_SYSTEM,
            days=days,
            mood_history=mood_history,
        )
        result = await self._call_ai(prompt, {"days": days}, user_id, "journal_companion_weather")
        summary = ""
        if result:
            summary = result.get("summary", "")

        if not summary:
            if moods:
                avg = sum(mood_by_date.get(date.today().isoformat(), [2])) or 2
                summary = "好像慢慢轻松了一点。" if avg >= 2 else "最近好像有点累。"
            else:
                summary = "还没什么记录，开始写写看？"

        return {
            "forecast": forecast,
            "summary": summary,
        }

    async def chat(
        self,
        user_id: str,
        session_id: str | None,
        mode: str,
        message: str,
        journal_id: str | None = None,
    ) -> dict:
        conversation = ""
        if session_id:
            records = (
                self.repository.db.query(self.repository.model)
                .filter(
                    self.repository.model.id == session_id,
                )
                .first()
            )
            if records:
                conv_data = records.output_json or {}
                conversation = conv_data.get("conversation", "")

        mode_descriptions = {
            "listen": "只是听听",
            "chat": "陪我聊聊",
            "calm": "陪我缓一缓",
            "reflect": "帮我想明白",
        }
        mode_label = mode_descriptions.get(mode, "陪我聊聊")

        prompt = JOURNAL_CHAT_PROMPT.format(
            system=JOURNAL_COMPANION_SYSTEM,
            mode=f"{mode} ({mode_label})",
            conversation=conversation or "（无历史）",
            message=message,
        )

        # 聊天场景直接调用 provider 拿原始文本：
        # 1) AI 返回合法 JSON → 取 reply 字段
        # 2) AI 返回纯文本（json 模式偶发不遵守）→ 清洗后直接当回复，绝不浪费一次成功调用
        # 3) 完全失败 → 按模式给一句有温度的兜底（不再用"嗯，我在听"式敷衍文案）
        ai = get_ai_provider()
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": message},
        ]
        raw = None
        try:
            raw = await ai.complete(messages, response_format="json_object", temperature=0.8)
        except Exception:
            raw = None

        reply = None
        is_high_risk = False
        if raw:
            parsed = extract_json(raw)
            if isinstance(parsed, dict) and parsed.get("reply"):
                reply = str(parsed["reply"]).strip()
                is_high_risk = bool(parsed.get("is_high_risk"))
            else:
                cleaned = raw.strip().strip('"').strip()
                if cleaned and not cleaned.lstrip().startswith("{"):
                    reply = cleaned

        if not reply:
            fallback_replies = {
                "listen": "我一直在认真听呢。你刚才说的这些，换成是我也会不好受的。想多说一点吗？我陪着您。",
                "chat": "你说的这个我懂。后来呢？慢慢说，我在这儿。",
                "calm": "先不着急。我们一起慢慢呼吸：吸气 4 秒，屏住 2 秒，呼气 6 秒。现在感觉好一点点了吗？",
                "reflect": "这件事听起来挺复杂的。你觉得最让你在意的，是结果本身，还是过程中的某种感受？",
            }
            reply = fallback_replies.get(mode, "我在呢，慢慢说，我陪着你。")

        new_session_id = session_id or str(uuid.uuid4())
        new_conversation = f"{conversation}\n用户: {message}\nAI: {reply}"
        if not session_id:
            self.repository.create(
                user_id=user_id,
                content_type=f"journal_companion_session_{new_session_id}",
                input_json={"mode": mode, "journal_id": journal_id},
                output_json={"conversation": new_conversation},
                provider="companion",
                model="default",
            )
        else:
            record = (
                self.db.query(self.repository.model)
                .filter(self.repository.model.id == session_id)
                .first()
            )
            if record:
                record.output_json = {"conversation": new_conversation}
                self.db.commit()

        return {
            "sessionId": new_session_id,
            "reply": reply,
            "isHighRisk": is_high_risk,
        }

    async def get_patterns(self, user_id: str) -> list[dict]:
        end_date = date.today()
        start_date = end_date - timedelta(days=29)

        journals = (
            self.db.query(DailyJournal)
            .filter(
                DailyJournal.user_id == user_id,
                DailyJournal.journal_date >= start_date,
                DailyJournal.journal_date <= end_date,
            )
            .order_by(DailyJournal.journal_date)
            .all()
        )
        if len(journals) < 5:
            return []

        journals_text = self._format_journals(journals)
        prompt = JOURNAL_PATTERNS_PROMPT.format(
            system=JOURNAL_COMPANION_SYSTEM,
            journals_text=journals_text,
        )
        result = await self._call_ai(
            prompt,
            {"days": 30, "journal_count": len(journals)},
            user_id,
            "journal_companion_patterns",
        )
        if not result:
            return []
        patterns = result.get("patterns", [])
        return [
            {
                "pattern": p.get("pattern", ""),
                "relatedWords": p.get("related_words", []),
                "conclusion": p.get("conclusion", ""),
            }
            for p in patterns
            if p.get("pattern")
        ]

    async def get_word_insight(self, user_id: str, word: str) -> dict | None:
        end_date = date.today()
        start_date = end_date - timedelta(days=29)

        journals = (
            self.db.query(DailyJournal)
            .filter(
                DailyJournal.user_id == user_id,
                DailyJournal.journal_date >= start_date,
                DailyJournal.journal_date <= end_date,
            )
            .all()
        )

        count = 0
        contexts: list[str] = []
        co_words: dict[str, int] = {}

        for j in journals:
            content = (j.content or "") + " " + " ".join(j.tags or [])
            if word in content:
                count += 1
                idx = content.find(word)
                start = max(0, idx - 15)
                end = min(len(content), idx + len(word) + 15)
                contexts.append(content[start:end])
                remaining = content.replace(word, "")
                for token in remaining.replace("，", " ").replace("。", " ").split():
                    if len(token) >= 2:
                        co_words[token] = co_words.get(token, 0) + 1

        if count == 0:
            return None

        top_co = sorted(co_words.items(), key=lambda x: x[1], reverse=True)[:5]
        co_word_list = [w for w, _ in top_co]
        contexts_text = "\n".join(f"- {c}" for c in contexts[:10])
        co_words_text = ", ".join(co_word_list) if co_word_list else "无"

        prompt = JOURNAL_WORD_INSIGHT_PROMPT.format(
            system=JOURNAL_COMPANION_SYSTEM,
            word=word,
            count=count,
            contexts=contexts_text,
            co_words=co_words_text,
        )
        result = await self._call_ai(
            prompt,
            {"word": word, "count": count},
            user_id,
            "journal_companion_word",
        )
        if not result:
            return {
                "word": word,
                "count": count,
                "coOccurrences": co_word_list,
                "aiObservation": "",
            }
        return {
            "word": word,
            "count": count,
            "coOccurrences": result.get("co_occurrences", co_word_list),
            "aiObservation": result.get("ai_observation", ""),
        }

    def get_sessions(self, user_id: str) -> list[dict]:
        records = (
            self.db.query(self.repository.model)
            .filter(
                self.repository.model.user_id == user_id,
                self.repository.model.content_type.like("journal_companion_session_%"),
            )
            .order_by(self.repository.model.created_at.desc())
            .limit(20)
            .all()
        )
        sessions = []
        for r in records:
            conv = r.output_json or {}
            mode = (r.input_json or {}).get("mode", "chat")
            first_user = ""
            for line in conv.get("conversation", "").split("\n"):
                if line.startswith("用户: "):
                    first_user = line.replace("用户: ", "")[:40]
                    break
            sessions.append({
                "id": r.id,
                "mode": mode,
                "preview": first_user,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            })
        return sessions

    def get_session(self, user_id: str, session_id: str) -> dict | None:
        record = (
            self.db.query(self.repository.model)
            .filter(
                self.repository.model.id == session_id,
                self.repository.model.user_id == user_id,
            )
            .first()
        )
        if not record:
            return None
        conv = record.output_json or {}
        mode = (record.input_json or {}).get("mode", "chat")
        messages: list[dict] = []
        for line in conv.get("conversation", "").split("\n"):
            if line.startswith("用户: "):
                messages.append({
                    "id": f"msg-{len(messages)}",
                    "role": "user",
                    "content": line.replace("用户: ", ""),
                    "mode": mode,
                })
            elif line.startswith("AI: "):
                messages.append({
                    "id": f"msg-{len(messages)}",
                    "role": "assistant",
                    "content": line.replace("AI: ", ""),
                    "mode": mode,
                })
        return {
            "id": session_id,
            "mode": mode,
            "messages": messages,
            "createdAt": record.created_at.isoformat() if record.created_at else None,
        }



router = APIRouter(tags=["ai"])


@router.post("/ai/journal-companion/hear")
async def companion_hear(
    payload: HearRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = await JournalCompanionService(db).hear(current_user.id, payload.journals)
    return {"data": result}


@router.get("/ai/journal-companion/mirror")
async def companion_mirror(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    date: str = Query(...),
) -> dict:
    from datetime import date as date_type
    target = date_type.fromisoformat(date)
    result = await JournalCompanionService(db).get_mirror(current_user.id, target)
    if result is None:
        return {"data": None}
    return {"data": result}


@router.get("/ai/journal-companion/weather")
async def companion_weather(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    days: int = Query(7, ge=1, le=30),
) -> dict:
    result = await JournalCompanionService(db).get_weather(current_user.id, days)
    return {"data": result}


@router.post("/ai/journal-companion/chat")
async def companion_chat(
    payload: ChatRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = await JournalCompanionService(db).chat(
        current_user.id,
        payload.session_id,
        payload.mode,
        payload.message,
        payload.journal_id,
    )
    return {"data": result}


@router.get("/ai/journal-companion/patterns")
async def companion_patterns(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = await JournalCompanionService(db).get_patterns(current_user.id)
    return {"data": result}


@router.get("/ai/journal-companion/word")
async def companion_word(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    word: str = Query(..., min_length=1, max_length=20),
) -> dict:
    result = await JournalCompanionService(db).get_word_insight(current_user.id, word)
    if result is None:
        return {"data": None}
    return {"data": result}


@router.get("/ai/journal-companion/sessions")
async def companion_sessions(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = JournalCompanionService(db).get_sessions(current_user.id)
    return {"data": result}


@router.get("/ai/journal-companion/sessions/{session_id}")
async def companion_session(
    session_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = JournalCompanionService(db).get_session(current_user.id, session_id)
    if result is None:
        return {"data": None}
    return {"data": result}
