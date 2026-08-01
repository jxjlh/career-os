"""Life AI Coach 核心服务.

聚合全部 LifeOS 数据 (Goal/Bucket/Task/Record/Map/Achievement/Social),
构建教练上下文, 支持多轮对话、今日建议、深度分析、周/月复盘.
"""

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import (
    AIConversation,
    AIMessage,
    CoachMemory,
    CoachTask,
    GoalTask,
    UserBucketItem,
)
from app.domains.ai.service import AIService
from app.domains.coach.prompts import (
    COACH_ADVICE_PROMPT,
    COACH_ANALYZE_PROMPT,
    COACH_MEMORY_EXTRACT_PROMPT,
    COACH_REVIEW_PROMPT,
    COACH_SYSTEM_PROMPT,
)
from app.domains.coach.repository import (
    CoachTaskRepository,
    ConversationRepository,
    MemoryRepository,
    MessageRepository,
)
from app.domains.coach.schemas import (
    AnalyzeResponse,
    ChatResponse,
    CoachAdviceItem,
    CoachAdviceResponse,
    CoachReminder,
    CoachTaskItem,
    CoachTaskUpdate,
    ConversationDetail,
    ConversationItem,
    MemoryCreate,
    MemoryItem,
    MemoryUpdate,
    MessageItem,
    ReviewResponse,
    ToolCallInfo,
)
from app.domains.coach.tools import registry as tool_registry
from app.domains.life.repository import (
    CheckinStreakRepository,
    LifeGoalRepository,
    LifeRecordRepository,
    UserLevelRepository,
)
from app.providers.ai.registry import get_ai_provider


class CoachContextBuilder:
    """聚合用户全部 LifeOS 数据为教练上下文文本."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.goals = LifeGoalRepository(db)
        self.records = LifeRecordRepository(db)
        self.levels = UserLevelRepository(db)
        self.streaks = CheckinStreakRepository(db)
        self.memories = MemoryRepository(db)

    def build(self, user_id: str) -> str:
        """构建完整用户画像文本, 拼入 system prompt."""
        sections: list[str] = []

        # 等级与经验
        level = self.levels.get_by_user(user_id) or self.levels.create(user_id)
        sections.append(f"等级: Lv.{level.level} (XP: {level.experience})")

        # 连续打卡
        streak = self.streaks.get_by_user(user_id)
        if streak:
            sections.append(
                f"连续打卡: 当前 {streak.current_streak} 天, 最长 {streak.longest_streak} 天, "
                f"累计 {streak.total_checkins} 次"
            )

        # 人生目标
        goals = self.goals.list_by_user(user_id)
        if goals:
            lines = [f"人生目标 ({len(goals)} 个):"]
            for g in goals[:8]:
                lines.append(f"  - {g.title} [分类:{g.category} 状态:{g.status}]")
            sections.append("\n".join(lines))
        else:
            sections.append("人生目标: 暂未设定")

        # 任务
        tasks = self._user_tasks(user_id)
        if tasks:
            todo = [t for t in tasks if t.status != "done"]
            done = [t for t in tasks if t.status == "done"]
            sections.append(f"任务: {len(todo)} 待办, {len(done)} 已完成")

        # 人生记录
        recent_records = self.records.list_recent_by_user(user_id, 5)
        if recent_records:
            lines = ["近期记录:"]
            for r in recent_records:
                loc = " ".join(filter(None, [r.city, r.country]))
                lines.append(f"  - {(r.content or '')[:40]} {loc}")
            sections.append("\n".join(lines))

        # 必做清单进度
        joined = self._bucket_progress(user_id)
        if joined:
            sections.append(
                f"必做清单: 已加入 {joined['joined']} 项, 完成 {joined['completed']} 项"
            )

        # 长期记忆
        memories = self.memories.list_by_user(user_id)
        if memories:
            lines = ["长期记忆:"]
            for m in memories[:8]:
                lines.append(f"  - [{m.memory_type}] {m.content[:60]}")
            sections.append("\n".join(lines))

        return "\n\n".join(sections)

    def _user_tasks(self, user_id: str) -> list[GoalTask]:
        return (
            self.db.query(GoalTask)
            .filter(GoalTask.user_id == user_id)
            .order_by(GoalTask.due_date, GoalTask.created_at)
            .limit(20)
            .all()
        )

    def _bucket_progress(self, user_id: str) -> dict | None:
        rows = self.db.query(UserBucketItem).filter(UserBucketItem.user_id == user_id).all()
        if not rows:
            return None
        completed = sum(1 for r in rows if r.status == "completed")
        return {"joined": len(rows), "completed": completed}


class CoachChatService:
    """多轮对话: 基于历史上下文 + LifeOS 数据回应."""

    HISTORY_LIMIT = 12  # 拼装最近 N 条消息作为上下文

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.conversations = ConversationRepository(db)
        self.messages = MessageRepository(db)
        self.memories = MemoryRepository(db)
        self.context = CoachContextBuilder(db)

    async def chat(self, user_id: str, conversation_id: str | None, message: str) -> ChatResponse:
        conv = self._ensure_conversation(user_id, conversation_id)
        self.conversations.touch(conv.id)

        # 存储用户消息
        self.messages.add(conv.id, role="user", content=message)

        # 构建上下文: LifeOS 画像 + 匹配工具数据 + 历史
        user_context = self.context.build(user_id)
        tool_context = await self._build_tool_context(user_id, message)
        history = self.messages.list_by_conversation(conv.id, self.HISTORY_LIMIT)

        system = COACH_SYSTEM_PROMPT.format(user_context=f"{user_context}\n\n{tool_context}")
        ai_messages: list[dict[str, str]] = [{"role": "system", "content": system}]
        for m in history:
            if m.role in ("user", "assistant"):
                ai_messages.append({"role": m.role, "content": m.content})

        provider = get_ai_provider()
        try:
            reply = await provider.complete(ai_messages, temperature=0.6)
        except Exception as exc:
            raise AppError(code="AI_PROVIDER_ERROR", message=str(exc), status=502) from exc

        # 存储助手回复
        assistant_msg = self.messages.add(
            conv.id,
            role="assistant",
            content=reply,
            provider=provider.name,
            model=getattr(provider, "model", None),
        )

        # 自动更新会话标题 (首条消息)
        if conv.title is None:
            conv.title = message[:40]
            self.db.commit()

        # 惰性提取记忆 (偶发, 避免每次对话都调 AI)
        if len(history) % 5 == 0:
            await self._extract_memory(user_id, message, reply)

        return ChatResponse(
            conversation_id=conv.id,
            message=self._to_message_item(assistant_msg),
            title=conv.title,
        )

    def _ensure_conversation(self, user_id: str, conversation_id: str | None) -> AIConversation:
        if conversation_id:
            conv = self.conversations.get_owned(user_id, conversation_id)
            if conv is None:
                raise AppError(code="NOT_FOUND", message="对话不存在", status=404)
            return conv
        return self.conversations.create(user_id, title=None)

    async def _build_tool_context(self, user_id: str, message: str) -> str:
        """按用户输入匹配工具, 异步拉取相关数据摘要."""
        matched = tool_registry.match_by_text(message)
        if not matched:
            return ""
        fragments: list[str] = []
        for tool in matched[:3]:  # 最多注入 3 个工具上下文, 控制长度
            if tool.build_context is None:
                continue
            try:
                fragment = await tool.build_context(self.db, user_id)
                fragments.append(fragment)
            except Exception:
                continue  # 工具失败不阻断主对话
        return "\n\n".join(fragments)

    async def _extract_memory(self, user_id: str, user_msg: str, assistant_msg: str) -> None:
        try:
            prompt = COACH_MEMORY_EXTRACT_PROMPT.format(
                dialog=f"用户: {user_msg}\n教练: {assistant_msg}"
            )
            _, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type="coach_memory_extract",
                input_data={"message": user_msg},
                prompt=prompt,
            )
        except AppError:
            return
        self._persist_memories(user_id, parsed)

    def _persist_memories(self, user_id: str, parsed: dict) -> None:
        type_map = {
            "goal": "goal",
            "interest": "interest",
            "travel": "travel",
            "learning": "learning",
            "career": "career",
            "language": "language",
            "budget": "budget",
        }
        for key, mem_type in type_map.items():
            value = (parsed.get(key) or "").strip()
            if value:
                self.memories.upsert_by_type(user_id, mem_type, value, importance=6)

    @staticmethod
    def _to_message_item(msg: AIMessage) -> MessageItem:
        return MessageItem(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            tool_calls=[ToolCallInfo(tool=t.get("tool", ""), result=t.get("result")) for t in (msg.tool_calls or [])],
            created_at=msg.created_at.isoformat() if msg.created_at else "",
        )


class CoachConversationService:
    """会话列表 / 详情管理."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.conversations = ConversationRepository(db)
        self.messages = MessageRepository(db)

    def list(self, user_id: str) -> list[ConversationItem]:
        items = self.conversations.list_by_user(user_id)
        return [self._to_item(c) for c in items]

    def detail(self, user_id: str, conversation_id: str) -> ConversationDetail:
        conv = self.conversations.get_owned(user_id, conversation_id)
        if conv is None:
            raise AppError(code="NOT_FOUND", message="对话不存在", status=404)
        messages = self.messages.list_by_conversation(conv.id, limit=50)
        return ConversationDetail(
            conversation=self._to_item(conv),
            messages=[CoachChatService._to_message_item(m) for m in messages],
        )

    def delete(self, user_id: str, conversation_id: str) -> None:
        conv = self.conversations.get_owned(user_id, conversation_id)
        if conv is None:
            raise AppError(code="NOT_FOUND", message="对话不存在", status=404)
        self.db.delete(conv)
        self.db.commit()

    @staticmethod
    def _to_item(conv: AIConversation) -> ConversationItem:
        return ConversationItem(
            id=conv.id,
            title=conv.title,
            summary=conv.summary,
            last_message_at=conv.last_message_at.isoformat() if conv.last_message_at else None,
            created_at=conv.created_at.isoformat() if conv.created_at else "",
        )


class CoachAdviceService:
    """今日建议 + 主动提醒: 聚合全量数据, AI 不可用时回退规则引擎."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.context = CoachContextBuilder(db)
        self.tasks = CoachTaskRepository(db)
        self.streaks = CheckinStreakRepository(db)
        self.goals = LifeGoalRepository(db)
        self.records = LifeRecordRepository(db)

    async def advice(self, user_id: str) -> CoachAdviceResponse:
        today = date.today()
        today_str = today.isoformat()
        reminders = self._build_reminders(user_id)

        # 按日缓存: 同一天不重复调用 AI
        cached = self.ai.repository.get_latest_by_type(user_id, "coach_advice")
        if (
            cached is not None
            and cached.created_at is not None
            and cached.created_at.date() == datetime.utcnow().date()
            and (cached.input_json or {}).get("date") == today_str
        ):
            parsed = cached.output_json or {}
            return self._build_response(parsed, reminders, today_str, "ai")

        state = self._today_state(user_id, reminders)
        prompt = COACH_ADVICE_PROMPT.format(today_state=state)
        try:
            _, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type="coach_advice",
                input_data={"date": today_str},
                prompt=prompt,
            )
        except AppError:
            return self._fallback(user_id, reminders, today_str)

        # 持久化教练任务
        self._persist_advice_tasks(user_id, parsed.get("advice") or [])
        return self._build_response(parsed, reminders, today_str, "ai")

    def _today_state(self, user_id: str, reminders: list[CoachReminder]) -> str:
        base = self.context.build(user_id)
        reminder_text = "\n".join(f"- [{r.severity}] {r.title}: {r.detail}" for r in reminders) or "无提醒"
        return f"{base}\n\n今日提醒:\n{reminder_text}"

    def _build_reminders(self, user_id: str) -> list[CoachReminder]:
        reminders: list[CoachReminder] = []
        today = date.today()

        # 1. 连续三天未打卡
        streak = self.streaks.get_by_user(user_id)
        if streak and streak.last_checkin_date:
            gap = (today - streak.last_checkin_date).days
            if gap >= 3:
                reminders.append(
                    CoachReminder(
                        type="streak",
                        title=f"已 {gap} 天未打卡",
                        detail="连续记录是习惯养成的关键, 今天拍一张吧",
                        severity="warning" if gap < 7 else "urgent",
                    )
                )

        # 2. 目标延期 (target_date 已过但未完成)
        goals = self.goals.list_by_user(user_id)
        for g in goals:
            if g.status not in ("completed", "cancelled") and g.target_date and g.target_date < today:
                gap = (today - g.target_date).days
                reminders.append(
                    CoachReminder(
                        type="overdue",
                        title=f"目标「{g.title}」已延期 {gap} 天",
                        detail="考虑调整截止日期或拆解为更小任务",
                        severity="warning" if gap < 14 else "urgent",
                    )
                )

        # 3. 旅行临近 (未来 14 天内有旅行目标)
        for g in goals:
            if g.category == "travel" and g.target_date and 0 <= (g.target_date - today).days <= 14:
                reminders.append(
                    CoachReminder(
                        type="travel",
                        title=f"旅行「{g.title}」临近",
                        detail=f"还有 {(g.target_date - today).days} 天出发, 记得准备行程",
                        severity="info",
                    )
                )

        # 4. 任务积压
        overdue_tasks = (
            self.db.query(GoalTask)
            .filter(
                GoalTask.user_id == user_id,
                GoalTask.status != "done",
                GoalTask.due_date < today,
            )
            .count()
        )
        if overdue_tasks >= 3:
            reminders.append(
                CoachReminder(
                    type="backlog",
                    title=f"有 {overdue_tasks} 个任务逾期",
                    detail="任务积压会影响节奏, 建议今天集中清理或延期",
                    severity="warning",
                )
            )

        # 5. Achievement 即将解锁 (简化: XP 接近下一级阈值)
        from app.db.models import UserLevel

        level = self.db.query(UserLevel).filter(UserLevel.user_id == user_id).first()
        if level:
            next_floor = level.level**2 * 100
            remaining = next_floor - level.experience
            if 0 < remaining <= 50:
                reminders.append(
                    CoachReminder(
                        type="achievement",
                        title=f"距离 Lv.{level.level + 1} 仅剩 {remaining} XP",
                        detail="再完成一两个目标即可升级",
                        severity="info",
                    )
                )

        return reminders

    def _persist_advice_tasks(self, user_id: str, advice_items: list[dict]) -> None:
        today = date.today()
        for item in advice_items:
            if not isinstance(item, dict) or not item.get("title"):
                continue
            self.tasks.create(
                user_id=user_id,
                title=str(item["title"])[:300],
                description=(item.get("description") or "")[:500] or None,
                priority=item.get("priority", "medium"),
                source="advice",
                life_goal_id=item.get("life_goal_id"),
                due_date=today,
            )

    def _build_response(
        self, parsed: dict, reminders: list[CoachReminder], today_str: str, source: str
    ) -> CoachAdviceResponse:
        advice = []
        for item in (parsed.get("advice") or [])[:8]:
            if isinstance(item, dict) and item.get("title"):
                advice.append(
                    CoachAdviceItem(
                        title=str(item["title"])[:200],
                        description=str(item.get("description", ""))[:300],
                        priority=item.get("priority", "medium"),
                        category=item.get("category", "general"),
                        life_goal_id=item.get("life_goal_id"),
                    )
                )
        return CoachAdviceResponse(
            date=today_str,
            greeting=parsed.get("greeting"),
            advice=advice,
            reminders=reminders,
            motivation=parsed.get("motivation"),
            source=source,
        )

    def _fallback(self, user_id: str, reminders: list[CoachReminder], today_str: str) -> CoachAdviceResponse:
        """AI 不可用时, 基于规则生成基础建议."""
        advice: list[CoachAdviceItem] = []
        active_goal = self.goals.get_active(user_id)
        if active_goal:
            advice.append(
                CoachAdviceItem(
                    title=f"推进「{active_goal.title}」",
                    description="今天为这个目标推进一小步",
                    priority="high",
                    category="goal",
                    life_goal_id=active_goal.id,
                )
            )
        advice.append(
            CoachAdviceItem(
                title="记录今日瞬间",
                description="用 AI 相机拍一张, 保持打卡节奏",
                priority="medium",
                category="record",
            )
        )
        return CoachAdviceResponse(
            date=today_str,
            greeting="今天也要好好成长 ✨",
            advice=advice,
            reminders=reminders,
            motivation="每一步都算数。",
            source="fallback",
        )


class CoachAnalyzeService:
    """深度分析: 基于主题匹配工具数据, 让 AI 给出有依据的分析."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.context = CoachContextBuilder(db)

    async def analyze(self, user_id: str, topic: str, conversation_id: str | None = None) -> AnalyzeResponse:
        # conversation_id 保留供未来将分析结果写入会话; 当前直接返回分析
        _ = conversation_id
        related = await self._build_related(user_id, topic)
        prompt = COACH_ANALYZE_PROMPT.format(topic=topic, related_data=related)
        try:
            _, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type="coach_analyze",
                input_data={"topic": topic},
                prompt=prompt,
            )
            analysis = parsed.get("analysis") or parsed.get("content") or ""
            references = parsed.get("references") or []
        except AppError:
            provider = get_ai_provider()
            messages = [
                {"role": "system", "content": COACH_SYSTEM_PROMPT.format(user_context=self.context.build(user_id))},
                {"role": "user", "content": f"请分析: {topic}\n\n相关数据:\n{related}"},
            ]
            analysis = await provider.complete(messages, temperature=0.5)
            references = []

        return AnalyzeResponse(
            topic=topic,
            analysis=analysis,
            references=references if isinstance(references, list) else [],
            source="ai",
        )

    async def _build_related(self, user_id: str, topic: str) -> str:
        fragments: list[str] = [self.context.build(user_id)]
        matched = tool_registry.match_by_text(topic)
        for tool in matched[:3]:
            if tool.build_context is None:
                continue
            try:
                fragments.append(await tool.build_context(self.db, user_id))
            except Exception:
                continue
        return "\n\n".join(fragments)


class CoachReviewService:
    """周报 / 月报: 聚合周期数据, AI 生成复盘."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)
        self.records = LifeRecordRepository(db)
        self.streaks = CheckinStreakRepository(db)
        self.context = CoachContextBuilder(db)

    async def review(self, user_id: str, period: str) -> ReviewResponse:
        period_zh = "本周" if period == "week" else "本月"
        days = 7 if period == "week" else 30
        now = datetime.utcnow()
        since = now - timedelta(days=days)

        period_data = self._aggregate(user_id, since)
        prompt = COACH_REVIEW_PROMPT.format(period_zh=period_zh, period_data=period_data)
        try:
            _, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type=f"coach_{period}_review",
                input_data={"period": period, "since": since.isoformat()},
                prompt=prompt,
            )
            return self._build(parsed, period, period_zh, "ai")
        except AppError:
            return self._fallback(period, period_zh, period_data)

    def _aggregate(self, user_id: str, since: datetime) -> str:
        goals = self.goals.list_by_user(user_id)
        completed_in_period = [
            g for g in goals
            if g.status == "completed" and g.updated_at and g.updated_at >= since
        ]
        records = [r for r in self.records.list_by_user(user_id) if r.created_at and r.created_at >= since]
        streak = self.streaks.get_by_user(user_id)
        return (
            f"完成目标: {len(completed_in_period)} 个\n"
            f"新增记录: {len(records)} 条\n"
            f"当前连续打卡: {streak.current_streak if streak else 0} 天\n"
            f"目标总数: {len(goals)} 个"
        )

    def _build(self, parsed: dict, period: str, period_zh: str, source: str) -> ReviewResponse:
        return ReviewResponse(
            period=period,
            title=parsed.get("title") or f"{period_zh}复盘",
            summary=parsed.get("summary"),
            highlights=parsed.get("highlights") or [],
            metrics=parsed.get("metrics") or {},
            suggestions=parsed.get("suggestions") or [],
            reflection=parsed.get("reflection"),
            source=source,
        )

    def _fallback(self, period: str, period_zh: str, period_data: str) -> ReviewResponse:
        return ReviewResponse(
            period=period,
            title=f"{period_zh}复盘",
            summary="基于数据的简要复盘",
            highlights=[period_data],
            metrics={},
            suggestions=["继续保持记录与打卡节奏"],
            reflection="AI 暂时不可用, 以上是基于规则的简要总结。",
            source="fallback",
        )


class CoachMemoryService:
    """长期记忆 CRUD."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.memories = MemoryRepository(db)

    def list(self, user_id: str) -> list[MemoryItem]:
        return [self._to_item(m) for m in self.memories.list_by_user(user_id)]

    def create(self, user_id: str, payload: MemoryCreate) -> MemoryItem:
        mem = self.memories.create(
            user_id=user_id,
            memory_type=payload.memory_type,
            content=payload.content,
            importance=payload.importance,
            source=payload.source,
        )
        return self._to_item(mem)

    def update(self, user_id: str, memory_id: str, payload: MemoryUpdate) -> MemoryItem:
        mem = self.memories.get_owned(user_id, memory_id)
        if mem is None:
            raise AppError(code="NOT_FOUND", message="记忆不存在", status=404)
        if payload.content is not None:
            mem.content = payload.content
        if payload.importance is not None:
            mem.importance = payload.importance
        self.db.commit()
        self.db.refresh(mem)
        return self._to_item(mem)

    def delete(self, user_id: str, memory_id: str) -> None:
        mem = self.memories.get_owned(user_id, memory_id)
        if mem is None:
            raise AppError(code="NOT_FOUND", message="记忆不存在", status=404)
        self.db.delete(mem)
        self.db.commit()

    @staticmethod
    def _to_item(mem: CoachMemory) -> MemoryItem:
        return MemoryItem(
            id=mem.id,
            memory_type=mem.memory_type,
            content=mem.content,
            importance=mem.importance,
            source=mem.source,
            created_at=mem.created_at.isoformat() if mem.created_at else "",
            updated_at=mem.updated_at.isoformat() if mem.updated_at else None,
        )


class CoachTaskService:
    """教练任务 CRUD (今日任务: 完成/延期/删除)."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.tasks = CoachTaskRepository(db)

    def list(self, user_id: str, status: str | None = None) -> list[CoachTaskItem]:
        return [self._to_item(t) for t in self.tasks.list_by_user(user_id, status)]

    def update(self, user_id: str, task_id: str, payload: CoachTaskUpdate) -> CoachTaskItem:
        task = self.tasks.get_owned(user_id, task_id)
        if task is None:
            raise AppError(code="NOT_FOUND", message="任务不存在", status=404)
        if payload.status is not None:
            if payload.status == "postponed":
                from datetime import timedelta as _td
                task.due_date = (task.due_date or date.today()) + _td(days=1)
            task.status = payload.status
        if payload.priority is not None:
            task.priority = payload.priority
        self.db.commit()
        self.db.refresh(task)
        return self._to_item(task)

    def delete(self, user_id: str, task_id: str) -> None:
        task = self.tasks.get_owned(user_id, task_id)
        if task is None:
            raise AppError(code="NOT_FOUND", message="任务不存在", status=404)
        self.db.delete(task)
        self.db.commit()

    @staticmethod
    def _to_item(task: CoachTask) -> CoachTaskItem:
        return CoachTaskItem(
            id=task.id,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            source=task.source,
            life_goal_id=task.life_goal_id,
            due_date=task.due_date.isoformat() if task.due_date else None,
            created_at=task.created_at.isoformat() if task.created_at else "",
        )
