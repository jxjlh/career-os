import json
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import AIContent, GoalTask, TravelChecklistItem
from app.domains.ai.prompts.bucket_recommendation import BUCKET_RECOMMENDATION_PROMPT
from app.domains.ai.prompts.friend_recommendation import FRIEND_RECOMMENDATION_PROMPT
from app.domains.ai.prompts.growth_plan import GROWTH_PLAN_PROMPT
from app.domains.ai.prompts.journal import JOURNAL_PROMPT
from app.domains.ai.prompts.map_insight import MAP_INSIGHT_PROMPT
from app.domains.ai.prompts.photo_analysis import PHOTO_ANALYSIS_PROMPT
from app.domains.ai.prompts.team_plan import TEAM_PLAN_PROMPT
from app.domains.ai.prompts.travel_assistant import TRAVEL_ASSISTANT_PROMPT
from app.domains.ai.prompts.travel_plan import TRAVEL_PLAN_PROMPT
from app.domains.ai.prompts.year_summary import YEAR_SUMMARY_PROMPT
from app.domains.ai.repository import AIContentRepository
from app.domains.ai.schemas import (
    BucketRecommendationItem,
    BucketRecommendationRequest,
    BucketRecommendationResponse,
    FriendRecommendationItem,
    FriendRecommendationRequest,
    FriendRecommendationResponse,
    GenerateTasksResponse,
    GrowthPlanRequest,
    GrowthPlanResponse,
    JournalRequest,
    JournalResponse,
    PhotoAnalysisRequest,
    PhotoAnalysisResponse,
    RelatedBucketItem,
    RelatedGoalItem,
    SharedGoalSuggestion,
    SuggestedRecord,
    TeamPlanRequest,
    TeamPlanResponse,
    TeamRiskItem,
    TeamTaskItem,
    TravelAssistantRequest,
    TravelAssistantResponse,
    TravelChecklistItemCreate,
    TravelChecklistItemUpdate,
    TravelPlanRequest,
    TravelPlanResponse,
    YearSummaryRequest,
    YearSummaryResponse,
)
from app.domains.bucket.repository import (
    BucketCategoryRepository,
    BucketItemRepository,
)
from app.domains.life.repository import (
    LifeGoalRepository,
    LifeRecordRepository,
    UserLevelRepository,
)
from app.providers.ai.base import AIProvider, extract_json
from app.providers.ai.registry import get_ai_provider


class AIService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = AIContentRepository(db)

    async def generate_content(
        self,
        user_id: str,
        content_type: str,
        input_data: dict,
        prompt: str,
        provider: AIProvider | None = None,
        model: str | None = None,
    ) -> tuple[AIContent, dict]:
        ai = provider or get_ai_provider()
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps(input_data, ensure_ascii=False)},
        ]
        try:
            raw = await ai.complete(messages, response_format="json_object", temperature=0.4)
        except Exception as exc:
            raise AppError(code="AI_PROVIDER_ERROR", message=str(exc), status=502) from exc

        parsed = extract_json(raw)
        if parsed is None:
            raise AppError(code="AI_OUTPUT_INVALID", message="AI output is not valid JSON", status=422)

        record = self.repository.create(
            user_id=user_id,
            content_type=content_type,
            input_json=input_data,
            output_json=parsed,
            provider=ai.name,
            model=model or getattr(ai, "model", None) or "default",
        )
        return record, parsed


class TravelPlanService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)

    async def generate(self, user_id: str, payload: TravelPlanRequest) -> TravelPlanResponse:
        if payload.goal_id and self.goals.get_owned(user_id, payload.goal_id) is None:
            raise AppError(code="NOT_FOUND", message="Life goal not found", status=404)
        input_data = payload.model_dump()
        prompt = TRAVEL_PLAN_PROMPT.format(
            destination=payload.destination,
            days=payload.days,
            budget=payload.budget or "未指定",
            people=payload.people or "未指定",
            interests="、".join(payload.interests) or "未指定",
        )
        record, parsed = await self.ai.generate_content(
            user_id=user_id,
            content_type="travel_plan",
            input_data=input_data,
            prompt=prompt,
        )
        return TravelPlanResponse(
            id=record.id,
            aiContentId=record.id,
            title=parsed.get("title"),
            summary=parsed.get("summary"),
            bestTime=parsed.get("best_time"),
            route=parsed.get("route") or [],
            preparation=parsed.get("preparation") or [],
            tips=parsed.get("tips") or [],
        )


class TravelAssistantService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)

    async def generate(
        self,
        user_id: str,
        payload: TravelAssistantRequest,
    ) -> TravelAssistantResponse:
        goal_title = ""
        if payload.goal_id:
            goal = self.goals.get_owned(user_id, payload.goal_id)
            if goal is None:
                raise AppError(code="NOT_FOUND", message="Life goal not found", status=404)
            goal_title = goal.title or ""

        history = "\n".join(f"{m.role}: {m.content}" for m in payload.messages[-10:])
        prompt = TRAVEL_ASSISTANT_PROMPT.format(
            goal_title=goal_title or "未指定",
            history=history or "（用户还没有提供信息）",
        )
        input_data = {
            "goal_id": payload.goal_id,
            "messages": [m.model_dump() for m in payload.messages],
        }
        try:
            record, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type="travel_plan",
                input_data=input_data,
                prompt=prompt,
            )
        except AppError:
            parsed = {
                "reply": "我还在帮你整理行程。可以告诉我目的地、天数、预算和兴趣，我就能为你生成完整攻略。",
                "title": None,
                "summary": None,
                "best_time": None,
                "route": [],
                "preparation": [],
                "tips": [],
            }
            record = self.ai.repository.create(
                user_id=user_id,
                content_type="travel_plan",
                input_json=input_data,
                output_json=parsed,
                provider="fallback",
                model="default",
            )

        return TravelAssistantResponse(
            id=record.id,
            aiContentId=record.id,
            reply=parsed.get("reply")
            or "我已经根据你的需求整理了行程。你可以继续补充目的地、天数、预算和兴趣，我会把攻略补充完整。",
            title=parsed.get("title"),
            summary=parsed.get("summary"),
            bestTime=parsed.get("best_time"),
            route=parsed.get("route") or [],
            preparation=parsed.get("preparation") or [],
            tips=parsed.get("tips") or [],
        )


class TravelChecklistService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIContentRepository(db)

    def _get_owned_plan(self, user_id: str, ai_content_id: str) -> AIContent:
        content = self.ai.get_by_id(user_id, ai_content_id)
        if content is None or content.content_type != "travel_plan":
            raise AppError(code="NOT_FOUND", message="Travel plan not found", status=404)
        return content

    def _dict(self, row: TravelChecklistItem) -> dict:
        return {
            "id": row.id,
            "aiContentId": row.ai_content_id,
            "item": row.item,
            "note": row.note,
            "checked": row.checked,
            "sortOrder": row.sort_order,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
        }

    def list(self, user_id: str, ai_content_id: str) -> list[dict]:
        content = self._get_owned_plan(user_id, ai_content_id)
        rows = (
            self.db.query(TravelChecklistItem)
            .filter(
                TravelChecklistItem.user_id == user_id,
                TravelChecklistItem.ai_content_id == ai_content_id,
            )
            .order_by(TravelChecklistItem.sort_order, TravelChecklistItem.created_at)
            .all()
        )
        if not rows:
            rows = []
            for idx, item in enumerate(content.output_json.get("preparation") or []):
                row = TravelChecklistItem(
                    user_id=user_id,
                    ai_content_id=ai_content_id,
                    item=item,
                    sort_order=idx,
                )
                self.db.add(row)
                rows.append(row)
            if rows:
                self.db.commit()
                for row in rows:
                    self.db.refresh(row)
        return [self._dict(row) for row in rows]

    def add(
        self,
        user_id: str,
        ai_content_id: str,
        payload: TravelChecklistItemCreate,
    ) -> dict:
        self._get_owned_plan(user_id, ai_content_id)
        count = (
            self.db.query(TravelChecklistItem)
            .filter(
                TravelChecklistItem.user_id == user_id,
                TravelChecklistItem.ai_content_id == ai_content_id,
            )
            .count()
        )
        row = TravelChecklistItem(
            user_id=user_id,
            ai_content_id=ai_content_id,
            item=payload.item.strip(),
            note=payload.note,
            sort_order=count,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._dict(row)

    def update(
        self,
        user_id: str,
        item_id: str,
        payload: TravelChecklistItemUpdate,
    ) -> dict:
        row = self._get_owned_item(user_id, item_id)
        if payload.item is not None:
            row.item = payload.item.strip()
        if payload.note is not None:
            row.note = payload.note
        if payload.checked is not None:
            row.checked = payload.checked
        self.db.commit()
        self.db.refresh(row)
        return self._dict(row)

    def delete(self, user_id: str, item_id: str) -> None:
        row = self._get_owned_item(user_id, item_id)
        self.db.delete(row)
        self.db.commit()

    def _get_owned_item(self, user_id: str, item_id: str) -> TravelChecklistItem:
        row = (
            self.db.query(TravelChecklistItem)
            .filter(TravelChecklistItem.id == item_id, TravelChecklistItem.user_id == user_id)
            .first()
        )
        if row is None:
            raise AppError(code="NOT_FOUND", message="Checklist item not found", status=404)
        return row


class GrowthPlanService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)

    async def generate(self, user_id: str, payload: GrowthPlanRequest) -> GrowthPlanResponse:
        if payload.goal_id and self.goals.get_owned(user_id, payload.goal_id) is None:
            raise AppError(code="NOT_FOUND", message="Life goal not found", status=404)
        input_data = {
            "goal_id": payload.goal_id,
            "goal_title": payload.goal_title,
            "target_description": payload.target_description,
            "available_time": payload.available_time,
            "difficulty": payload.difficulty,
        }
        prompt = GROWTH_PLAN_PROMPT.format(
            target_description=payload.target_description,
            current_status=payload.current_status or "未说明",
            available_time=payload.available_time or "未说明",
            difficulty=payload.difficulty or "medium",
        )
        record, parsed = await self.ai.generate_content(
            user_id=user_id,
            content_type="growth_plan",
            input_data=input_data,
            prompt=prompt,
        )
        return GrowthPlanResponse(
            id=record.id,
            aiContentId=record.id,
            title=parsed.get("title"),
            summary=parsed.get("summary"),
            phases=parsed.get("phases") or [],
            dailyPlan=parsed.get("daily_plan") or [],
            milestones=parsed.get("milestones") or [],
            tips=parsed.get("tips") or [],
        )


class GrowthTaskGeneratorService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIContentRepository(db)
        self.goals = LifeGoalRepository(db)

    def generate(self, user_id: str, ai_content_id: str) -> GenerateTasksResponse:
        content = self.ai.get_by_id(user_id, ai_content_id)
        if content is None:
            raise AppError(code="NOT_FOUND", message="AI content not found", status=404)
        if content.task_generated:
            raise AppError(code="ALREADY_GENERATED", message="Tasks already generated for this plan", status=409)
        goal_id = (content.input_json or {}).get("goal_id")
        if not goal_id:
            raise AppError(code="MISSING_GOAL", message="Growth plan is not linked to a life goal", status=400)
        goal = self.goals.get_owned(user_id, goal_id)
        if goal is None:
            raise AppError(code="NOT_FOUND", message="Life goal not found", status=404)

        daily_plan = (content.output_json or {}).get("daily_plan") or []
        start = goal.start_date or date.today()
        task_ids: list[str] = []
        for entry in daily_plan:
            day = max(1, int(entry.get("day", 1)))
            for title in entry.get("tasks", []):
                task = GoalTask(
                    user_id=user_id,
                    goal_id=None,
                    life_goal_id=goal.id,
                    title=str(title),
                    task_type="daily",
                    due_date=start + timedelta(days=day - 1),
                    status="todo",
                )
                self.db.add(task)
                self.db.flush()
                task_ids.append(task.id)
        content.task_generated = True
        self.db.commit()
        return GenerateTasksResponse(createdCount=len(task_ids), taskIds=task_ids)


class YearSummaryService:
    """Generates an AI year summary from completed goals, records and XP."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)
        self.records = LifeRecordRepository(db)
        self.levels = UserLevelRepository(db)

    async def generate(self, user_id: str, payload: YearSummaryRequest) -> YearSummaryResponse:
        year = payload.year or date.today().year
        completed = self._completed_goals(user_id, year)
        records = self._records(user_id, year)
        level = self.levels.get_by_user(user_id)
        if level is None:
            level = self.levels.create(user_id)

        goal_lines = "；".join(f"{goal.title}（{goal.category}）" for goal in completed) or "暂无"
        record_lines = []
        for record in records:
            location = " ".join(filter(None, [record.country, record.city]))
            when = record.created_at.date().isoformat() if record.created_at else ""
            record_lines.append(" ".join(filter(None, [when, location, record.content])))

        input_data = {
            "user_id": user_id,
            "year": year,
            "completed_goals": [
                {
                    "title": goal.title,
                    "category": goal.category,
                    "completed_at": goal.updated_at.isoformat() if goal.updated_at else None,
                }
                for goal in completed
            ],
            "records": [
                {
                    "content": record.content,
                    "location": " ".join(filter(None, [record.country, record.city])),
                    "created_at": record.created_at.isoformat() if record.created_at else None,
                }
                for record in records
            ],
            "xp": level.experience,
            "level": level.level,
        }
        prompt = YEAR_SUMMARY_PROMPT.format(
            year=year,
            completed_goals=goal_lines or "暂无",
            life_records="；".join(record_lines) or "暂无",
            xp=level.experience,
            level=level.level,
        )
        record, parsed = await self.ai.generate_content(
            user_id=user_id,
            content_type="year_summary",
            input_data=input_data,
            prompt=prompt,
        )
        return self._to_response(record, parsed, year)

    def get_latest(self, user_id: str, year: int | None = None) -> YearSummaryResponse | None:
        for content in self.ai.repository.list_by_type(user_id, "year_summary", limit=50):
            saved_year = (content.input_json or {}).get("year")
            if year is not None and saved_year != year:
                continue
            return self._to_response(content, content.output_json or {}, saved_year)
        return None

    def _completed_goals(self, user_id: str, year: int) -> list:
        return [
            goal
            for goal in self.goals.list_by_user(user_id)
            if goal.status == "completed" and goal.updated_at is not None and goal.updated_at.year == year
        ]

    def _records(self, user_id: str, year: int) -> list:
        return [
            record
            for record in self.records.list_by_user(user_id)
            if record.created_at is not None and record.created_at.year == year
        ]

    def _to_response(self, content, parsed: dict, year: int) -> YearSummaryResponse:
        return YearSummaryResponse(
            id=content.id,
            aiContentId=content.id,
            year=year,
            title=parsed.get("title"),
            summary=parsed.get("summary"),
            highlights=parsed.get("highlights") or [],
            growth=parsed.get("growth") or {},
            versions=parsed.get("versions") or {},
            createdAt=content.created_at.isoformat() if content.created_at else None,
        )


class BucketRecommendationService:
    """根据用户画像 + 清单目录, 让 AI 推荐 5~10 个最匹配的人生必做项.

    AI 不可用或返回非法 JSON 时, 回退为按 popularity 取热门条目, 保证前端可用.
    """

    CATALOG_LIMIT = 60
    FALLBACK_COUNT = 8

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.categories = BucketCategoryRepository(db)
        self.items = BucketItemRepository(db)

    async def recommend(
        self, user_id: str, payload: BucketRecommendationRequest
    ) -> BucketRecommendationResponse:
        catalog = self.items.list_published(limit=self.CATALOG_LIMIT)
        if not catalog:
            return BucketRecommendationResponse(recommendations=[], source="fallback")

        # 已加入条目不重复推荐
        joined_ids = {ub.bucket_item_id for ub in self._joined_ids(user_id)}
        candidates = [it for it in catalog if it.id not in joined_ids]
        if not candidates:
            return BucketRecommendationResponse(recommendations=[], source="fallback")

        category_map = {c.id: c.name for c in self.categories.list_all()}
        profile = self._build_profile(user_id, payload)
        catalog_text = self._build_catalog(candidates, category_map)

        prompt = BUCKET_RECOMMENDATION_PROMPT.format(profile=profile, catalog=catalog_text)
        input_data = payload.model_dump(exclude_none=True)

        try:
            _, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type="bucket_recommendation",
                input_data=input_data,
                prompt=prompt,
            )
        except AppError:
            return self._fallback(candidates, category_map)

        recs = self._parse_recommendations(parsed, candidates, category_map)
        if not recs:
            return self._fallback(candidates, category_map)
        return BucketRecommendationResponse(recommendations=recs, source="ai")

    def _joined_ids(self, user_id: str) -> list:
        from app.db.models import UserBucketItem

        return self.db.query(UserBucketItem).filter(UserBucketItem.user_id == user_id).all()

    def _build_profile(self, user_id: str, payload: BucketRecommendationRequest) -> str:
        """拼接用户画像文本: 显式入参优先, 缺省字段给出未指定."""
        parts = [
            f"职业: {payload.career or '未指定'}",
            f"兴趣: {', '.join(payload.interests) or '未指定'}",
            f"预算: {payload.budget or '未指定'}",
            f"所在城市: {payload.city or '未指定'}",
            f"可用时间: {payload.time or '未指定'}",
            f"成长方向: {payload.growth_direction or '未指定'}",
            # 历史完成情况: 已加入数, 帮助 AI 避开重复与匹配难度
            f"已加入清单数: {self._joined_count(user_id)}",
        ]
        return "\n".join(parts)

    def _joined_count(self, user_id: str) -> int:
        from app.db.models import UserBucketItem

        return self.db.query(UserBucketItem).filter(UserBucketItem.user_id == user_id).count()

    def _build_catalog(self, items, category_map: dict) -> str:
        lines = []
        for it in items:
            cat = category_map.get(it.category_id, "未分类")
            season = it.best_season or "不限"
            cost = it.estimated_cost or "未知"
            tags = "/".join(it.tags or []) or "无"
            lines.append(
                f"- item_id={it.id} | {it.title} | 分类={cat} | 难度={it.difficulty} | "
                f"预算={cost} | 最佳季节={season} | 国家={it.country or '不限'} | "
                f"城市={it.city or '不限'} | 标签={tags}"
            )
        return "\n".join(lines)

    def _parse_recommendations(self, parsed: dict, candidates, category_map: dict) -> list[BucketRecommendationItem]:
        raw = parsed.get("recommendations") or []
        if not isinstance(raw, list):
            return []
        cand_by_id = {it.id: it for it in candidates}
        result: list[BucketRecommendationItem] = []
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            item_id = entry.get("item_id") or entry.get("itemId")
            item = cand_by_id.get(item_id)
            if item is None:
                continue  # AI 编造的 id 直接丢弃
            result.append(
                BucketRecommendationItem(
                    **{
                        "itemId": item.id,
                        "title": item.title,
                        "coverImage": item.cover_image,
                        "reason": str(entry.get("reason", ""))[:200],
                        "matchScore": int(entry.get("match_score", entry.get("matchScore", 0)) or 0),
                        "priority": str(entry.get("priority", "medium")),
                        "category": category_map.get(item.category_id),
                    }
                )
            )
        return result

    def _fallback(self, candidates, category_map: dict) -> BucketRecommendationResponse:
        """AI 不可用时按 popularity 回退, 仍给出可消费的推荐列表."""
        top = candidates[: self.FALLBACK_COUNT]
        recs = [
            BucketRecommendationItem(
                **{
                    "itemId": it.id,
                    "title": it.title,
                    "coverImage": it.cover_image,
                    "reason": "热门推荐",
                    "matchScore": 60,
                    "priority": "medium",
                    "category": category_map.get(it.category_id),
                }
            )
            for it in top
        ]
        return BucketRecommendationResponse(recommendations=recs, source="fallback")


class MapInsightService:
    """基于人生地图数据生成 AI 洞察: 足迹总结 + 下一站推荐.

    AI 不可用时回退为基于统计的模板文案, 保证前端可用.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)

    async def generate(self, user_id: str) -> dict:
        from app.domains.life.service import LifeMapService

        map_service = LifeMapService(self.db)
        stats = map_service.statistics(user_id)
        markers = map_service.get(user_id)["markers"][:10]
        goals = [
            m for m in map_service.get(user_id)["markers"] if m["sourceType"] == "goal"
        ][:5]

        footprints = "\n".join(
            f"- {m['visitTime'] or m['createdAt'] or ''} | {m['title']} | "
            f"{m['country'] or ''} {m['city'] or ''}".strip()
            for m in markers
        ) or "暂无足迹"
        goal_lines = "\n".join(f"- {g['title']} ({g['status']})" for g in goals) or "暂无目标"

        prompt = MAP_INSIGHT_PROMPT.format(
            stats=json.dumps(stats, ensure_ascii=False),
            footprints=footprints,
            goals=goal_lines,
        )

        try:
            _, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type="map_insight",
                input_data={"stats": stats},
                prompt=prompt,
            )
        except AppError:
            return self._fallback(stats, markers)

        return {
            "summary": parsed.get("summary", ""),
            "highlights": parsed.get("highlights") or [],
            "nextStop": parsed.get("next_stop") or {},
            "suggestions": parsed.get("suggestions") or [],
            "source": "ai",
        }

    def _fallback(self, stats: dict, markers: list[dict]) -> dict:
        cities = stats.get("totalCities", 0)
        countries = stats.get("totalCountries", 0)
        distance = stats.get("totalDistance", 0)
        next_stop = {}
        # 推荐: 第一个未完成 goal 或热门 bucket
        pending = next((m for m in markers if m["status"] == "pending"), None)
        if pending:
            next_stop = {
                "title": pending["title"],
                "reason": "这是你尚未到达的目的地, 值得下一步前往。",
                "category": pending.get("category") or "travel",
            }
        return {
            "summary": f"今年你的脚步遍布 {cities} 个城市、{countries} 个国家, 旅行里程约 {distance} 公里。",
            "highlights": ["继续记录每一步成长"],
            "nextStop": next_stop,
            "suggestions": ["多拍照记录人生瞬间", "为下一个目标制定计划"],
            "source": "fallback",
        }


class PhotoAnalysisService:
    """基于拍照上下文(GPS/时间/天气/海拔)的场景识别.

    现有 AIProvider 仅支持文本, 因此照片本体不上传, 前端可传 photo_description 辅助理解.
    AI 不可用或返回非法 JSON 时, 回退为基于上下文规则的场景推断, 保证前端可用.
    """

    BUCKET_CANDIDATE_LIMIT = 10

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)
        self.items = BucketItemRepository(db)
        self.categories = BucketCategoryRepository(db)

    async def analyze(self, user_id: str, payload: PhotoAnalysisRequest) -> PhotoAnalysisResponse:
        goal = None
        if payload.goal_id:
            goal = self.goals.get_owned(user_id, payload.goal_id)
            if goal is None:
                raise AppError(code="NOT_FOUND", message="Life goal not found", status=404)

        bucket_candidates = self.items.list_published(limit=self.BUCKET_CANDIDATE_LIMIT)
        goals_for_match = [g for g in self.goals.list_by_user(user_id) if g.status != "cancelled"][:8]

        context = self._build_context(payload, goal)
        buckets_text = self._build_buckets(bucket_candidates)
        goals_text = self._build_goals(goals_for_match)

        prompt = PHOTO_ANALYSIS_PROMPT.format(
            context=context, buckets=buckets_text, goals=goals_text
        )
        input_data = payload.model_dump(exclude_none=True)

        try:
            _, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type="photo_analysis",
                input_data=input_data,
                prompt=prompt,
            )
        except AppError:
            return self._fallback(payload, goal, bucket_candidates)

        response = self._parse(parsed, bucket_candidates, goals_for_match)
        if response is None:
            return self._fallback(payload, goal, bucket_candidates)
        return response

    def _build_context(self, payload: PhotoAnalysisRequest, goal) -> str:
        """拼接拍摄上下文文本, 供 AI 推断场景."""
        parts = [
            f"拍摄时间: {payload.captured_at or '刚刚'}",
            f"地点: {' · '.join(filter(None, [payload.country, payload.city])) or '未知'}",
            f"GPS: {self._fmt_gps(payload.latitude, payload.longitude)}",
            f"天气: {payload.weather or '未知'}",
            f"温度: {f'{payload.temperature}°C' if payload.temperature is not None else '未知'}",
            f"海拔: {f'{payload.altitude}m' if payload.altitude is not None else '未知'}",
        ]
        if payload.photo_description:
            parts.append(f"画面描述: {payload.photo_description}")
        if goal is not None:
            parts.append(f"关联人生目标: {goal.title} ({goal.category})")
        return "\n".join(parts)

    @staticmethod
    def _fmt_gps(lat: float | None, lng: float | None) -> str:
        if lat is None or lng is None:
            return "未知"
        return f"{lat:.4f}, {lng:.4f}"

    def _build_buckets(self, items) -> str:
        if not items:
            return "（暂无可选清单）"
        category_map = {c.id: c.name for c in self.categories.list_all()}
        lines = []
        for it in items:
            cat = category_map.get(it.category_id, "未分类")
            lines.append(f"- bucket_id={it.id} | {it.title} | 分类={cat} | 国家={it.country or '不限'} | 城市={it.city or '不限'}")
        return "\n".join(lines)

    @staticmethod
    def _build_goals(goals) -> str:
        if not goals:
            return "（暂无人生目标）"
        lines = []
        for g in goals:
            lines.append(f"- goal_id={g.id} | {g.title} | 分类={g.category} | 状态={g.status}")
        return "\n".join(lines)

    def _parse(self, parsed: dict, bucket_candidates, goals_for_match) -> PhotoAnalysisResponse | None:
        scene_type = parsed.get("scene_type")
        if not scene_type:
            return None
        bucket_by_id = {it.id: it for it in bucket_candidates}
        goal_by_id = {g.id: g for g in goals_for_match}

        related_buckets = []
        for entry in parsed.get("related_buckets") or []:
            if not isinstance(entry, dict):
                continue
            item_id = entry.get("bucket_id") or entry.get("bucketId")
            item = bucket_by_id.get(item_id)
            if item is None:
                continue
            related_buckets.append(
                RelatedBucketItem(
                    **{
                        "bucketId": item.id,
                        "title": item.title,
                        "reason": str(entry.get("reason", ""))[:120],
                    }
                )
            )

        related_goals = []
        for entry in parsed.get("related_goals") or []:
            if not isinstance(entry, dict):
                continue
            goal_id = entry.get("goal_id") or entry.get("goalId")
            g = goal_by_id.get(goal_id)
            if g is None:
                continue
            related_goals.append(
                RelatedGoalItem(
                    **{
                        "goalId": g.id,
                        "title": g.title,
                        "reason": str(entry.get("reason", ""))[:120],
                    }
                )
            )

        suggested = None
        raw_suggested = parsed.get("suggested_record")
        if isinstance(raw_suggested, dict) and raw_suggested.get("content"):
            suggested = SuggestedRecord(
                type=str(raw_suggested.get("type", "travel"))[:20],
                content=str(raw_suggested.get("content", ""))[:500],
            )

        return PhotoAnalysisResponse(
            sceneType=str(scene_type)[:40],
            tags=[str(t) for t in (parsed.get("tags") or [])][:8],
            description=(parsed.get("description") or "")[:200] or None,
            relatedBuckets=related_buckets[:3],
            relatedGoals=related_goals[:3],
            suggestedRecord=suggested,
            source="ai",
        )

    def _fallback(self, payload: PhotoAnalysisRequest, goal, bucket_candidates) -> PhotoAnalysisResponse:
        """AI 不可用时按上下文规则推断场景, 仍给出可消费的建议."""
        scene_type = self._infer_scene(payload, goal)
        tags = self._infer_tags(payload, scene_type)
        description = self._infer_description(payload, scene_type)

        related_buckets: list[RelatedBucketItem] = []
        if payload.latitude is not None and payload.longitude is not None:
            related_buckets = [
                RelatedBucketItem(**{
                    "bucketId": it.id,
                    "title": it.title,
                    "reason": "附近的人生必做项",
                })
                for it in bucket_candidates[:2]
            ]

        related_goals = []
        if goal is not None:
            related_goals = [
                RelatedGoalItem(**{"goalId": goal.id, "title": goal.title, "reason": "本次拍摄关联的目标"})
            ]

        return PhotoAnalysisResponse(
            sceneType=scene_type,
            tags=tags,
            description=description,
            relatedBuckets=related_buckets,
            relatedGoals=related_goals,
            suggestedRecord=None,
            source="fallback",
        )

    @staticmethod
    def _infer_scene(payload: PhotoAnalysisRequest, goal) -> str:
        weather = (payload.weather or "").lower()
        if goal is not None:
            if goal.category == "travel":
                return "travel"
            if goal.category == "career":
                return "work"
            if goal.category == "health":
                return "sport"
            if goal.category == "relationship":
                return "family"
            if goal.category == "skill":
                return "learning"
        if any(w in weather for w in ("雪", "山", "海拔")):
            return "nature"
        if payload.city:
            return "city"
        return "daily"

    @staticmethod
    def _infer_tags(payload: PhotoAnalysisRequest, scene_type: str) -> list[str]:
        base = {
            "travel": ["旅途", "风景", "记录"],
            "city": ["城市", "街景", "日常"],
            "nature": ["自然", "山野", "宁静"],
            "food": ["美食", "味蕾", "生活"],
            "sport": ["运动", "活力", "坚持"],
            "family": ["家人", "陪伴", "温暖"],
            "work": ["工作", "专注", "成长"],
            "learning": ["学习", "进步", "积累"],
            "celebration": ["庆祝", "时刻", "纪念"],
            "daily": ["日常", "此刻", "记录"],
            "pet": ["萌宠", "陪伴", "治愈"],
            "other": ["此刻", "记录"],
        }
        tags = list(base.get(scene_type, base["daily"]))
        if payload.weather:
            tags.append(payload.weather)
        return tags[:6]

    @staticmethod
    def _infer_description(payload: PhotoAnalysisRequest, scene_type: str) -> str:
        location = " · ".join(filter(None, [payload.country, payload.city])) or "此地"
        weather = payload.weather or "此刻"
        templates = {
            "travel": f"在{location}, {weather}, 留下了旅途中的一个瞬间。",
            "city": f"穿行于{location}, 记录城市的这一刻。",
            "nature": f"在{location}, 拥抱自然, {weather}。",
            "food": f"在{location}, 用一顿美食犒赏自己。",
            "sport": f"在{location}, 用运动给自己充能。",
            "family": f"和家人在{location}, {weather}。",
            "work": f"在{location}, 专注此刻的工作。",
            "learning": f"在{location}, 又一次专注的学习时光。",
            "celebration": f"在{location}, 值得纪念的一刻。",
            "daily": f"{location}的{weather}, 平凡而珍贵的一刻。",
            "pet": f"在{location}, 与萌宠相伴的一刻。",
            "other": f"{location}的此刻。",
        }
        return templates.get(scene_type, templates["daily"])


class JournalService:
    """根据照片/视频描述 + 上下文生成人生日志.

    AI 不可用或返回非法 JSON 时, 回退为基于素材的模板日志, 保证前端可用.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)

    async def generate(self, user_id: str, payload: JournalRequest) -> JournalResponse:
        goal = None
        if payload.goal_id:
            goal = self.goals.get_owned(user_id, payload.goal_id)
            if goal is None:
                raise AppError(code="NOT_FOUND", message="Life goal not found", status=404)
        if not payload.goal_title and goal is not None:
            payload = payload.model_copy(update={"goal_title": goal.title})

        context = self._build_context(payload, goal)
        prompt = JOURNAL_PROMPT.format(context=context)
        input_data = payload.model_dump(exclude_none=True)

        try:
            _, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type="journal",
                input_data=input_data,
                prompt=prompt,
            )
        except AppError:
            return self._fallback(payload, goal)

        if not parsed.get("body"):
            return self._fallback(payload, goal)
        return JournalResponse(
            title=(parsed.get("title") or "")[:60] or None,
            body=(parsed.get("body") or "")[:1200] or None,
            reflection=(parsed.get("reflection") or "")[:200] or None,
            keywords=[str(k) for k in (parsed.get("keywords") or [])][:8],
            source="ai",
        )

    @staticmethod
    def _build_context(payload: JournalRequest, goal) -> str:
        media_label = "视频日志" if payload.media_type == "video" else "照片"
        parts = [
            f"媒体类型: {media_label}",
            f"媒体描述: {payload.media_description or '（用户未提供描述）'}",
            f"地点: {' · '.join(filter(None, [payload.country, payload.city])) or '未知'}",
            f"天气: {payload.weather or '未知'}",
            f"温度: {f'{payload.temperature}°C' if payload.temperature is not None else '未知'}",
            f"海拔: {f'{payload.altitude}m' if payload.altitude is not None else '未知'}",
            f"拍摄时间: {payload.captured_at or '刚刚'}",
        ]
        if goal is not None:
            parts.append(f"关联人生目标: {goal.title} ({goal.category})")
        return "\n".join(parts)

    def _fallback(self, payload: JournalRequest, goal) -> JournalResponse:
        """AI 不可用时按素材拼接模板日志."""
        location = " · ".join(filter(None, [payload.country, payload.city])) or "此地"
        weather = payload.weather or "此刻"
        media_label = "视频" if payload.media_type == "video" else "照片"
        desc = payload.media_description or "一个值得记录的瞬间"
        goal_phrase = f"契合「{goal.title}」的" if goal else ""

        title = f"{location}的此刻"
        body = (
            f"在{location}, {weather}。我记录下了这{media_label}: {desc}。"
            f"这是{goal_phrase}人生旅途中的一个片段, 平凡却真实。"
            f"愿日后翻看时, 仍能记起此刻的温度与心情。"
        )
        reflection = f"每一个被记录的瞬间, 都是{goal_phrase or ''}人生的一部分。"
        keywords = [media_label, location.split(" · ")[-1] if " · " in location else location]
        if goal:
            keywords.append(goal.title[:8])
        if payload.weather:
            keywords.append(payload.weather)

        return JournalResponse(
            title=title[:60],
            body=body[:1200],
            reflection=reflection[:200],
            keywords=list(dict.fromkeys(keywords))[:5],
            source="fallback",
        )


# ── Sprint 8 Life Social: AI 好友推荐 + 团队规划 ─────────────────────
class FriendRecommendationService:
    """根据用户兴趣/目标/Bucket/城市/成长方向, 推荐志趣相投的好友与共同目标.

    候选来源于用户的好友的好友 (二度关系) + 同城用户; AI 不可用时按简单规则排序.
    """

    CANDIDATE_LIMIT = 12

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)
        self.goals = LifeGoalRepository(db)
        self.records = LifeRecordRepository(db)

    async def recommend(
        self, user_id: str, payload: FriendRecommendationRequest
    ) -> FriendRecommendationResponse:
        candidates = self._load_candidates(user_id, payload)
        profile_text = self._build_profile(payload)
        candidates_text = self._build_candidates(candidates)

        prompt = FRIEND_RECOMMENDATION_PROMPT.format(
            profile=profile_text, candidates=candidates_text
        )
        input_data = payload.model_dump(exclude_none=True)

        try:
            _, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type="friend_recommendation",
                input_data=input_data,
                prompt=prompt,
            )
        except AppError:
            return self._fallback(candidates, payload)

        recs = self._parse_recommendations(parsed, candidates)
        suggestions = self._parse_suggestions(parsed)
        if not recs and not suggestions:
            return self._fallback(candidates, payload)
        return FriendRecommendationResponse(
            recommendations=recs[:6],
            shared_goal_suggestions=suggestions[:4],
            source="ai",
        )

    def _load_candidates(self, user_id: str, payload: FriendRecommendationRequest):
        """候选 = 好友的好友 (排除已是好友与自己) + 同城/同目标用户."""
        from app.db.models import Friend, Profile, UserProfile

        friend_ids = [
            f.friend_id for f in self.db.query(Friend).filter(Friend.user_id == user_id).all()
        ]
        # 二度关系: 好友的好友
        second_degree_ids: set[str] = set()
        for fid in friend_ids:
            for f in (
                self.db.query(Friend).filter(Friend.user_id == fid, Friend.friend_id != user_id).all()
            ):
                if f.friend_id not in friend_ids:
                    second_degree_ids.add(f.friend_id)
        candidate_ids = list(second_degree_ids)

        # 补充同城 / 同兴趣用户
        city = payload.city
        extra = []
        if city:
            extra = (
                self.db.query(Profile)
                .filter(Profile.id != user_id, Profile.id.notin_(friend_ids))
                .limit(self.CANDIDATE_LIMIT)
                .all()
            )
        else:
            extra = (
                self.db.query(Profile)
                .filter(Profile.id != user_id, Profile.id.notin_(friend_ids))
                .limit(self.CANDIDATE_LIMIT)
                .all()
            )
        extra_ids = [p.id for p in extra if p.id not in candidate_ids]
        candidate_ids.extend(extra_ids)

        # 去重并截断
        seen = set()
        ordered = []
        for cid in candidate_ids:
            if cid not in seen and cid != user_id:
                seen.add(cid)
                ordered.append(cid)
        ordered = ordered[: self.CANDIDATE_LIMIT]
        if not ordered:
            return []
        profiles = self.db.query(Profile).filter(Profile.id.in_(ordered)).all()
        # 关联 UserProfile (兴趣/方向)
        profiles_map = {p.id: p for p in profiles}
        user_profiles = {
            up.user_id: up
            for up in self.db.query(UserProfile).filter(UserProfile.user_id.in_(ordered)).all()
        }
        result = []
        for cid in ordered:
            p = profiles_map.get(cid)
            if p is None:
                continue
            up = user_profiles.get(cid)
            result.append((p, up))
        return result

    def _build_profile(self, payload: FriendRecommendationRequest) -> str:
        parts = [
            f"兴趣: {', '.join(payload.interests) or '未指定'}",
            f"成长方向: {payload.growth_direction or '未指定'}",
            f"所在城市: {payload.city or '未指定'}",
            f"当前人生目标: {payload.goal_title or '未指定'}",
            f"已加入清单: {', '.join(payload.bucket_titles) or '未指定'}",
        ]
        return "\n".join(parts)

    def _build_candidates(self, candidates) -> str:
        if not candidates:
            return "（暂无候选好友, 推荐系统刚启动, 可先添加几位好友扩大社交圈）"
        lines = []
        for p, up in candidates:
            interests = ", ".join((up.interests if up else []) or []) or "未填写"
            direction = (up.career_direction if up else None) or "未填写"
            city = p.current_title or "未知"
            lines.append(
                f"- friend_id={p.id} | 昵称={p.display_name or p.email.split('@')[0]} | "
                f"职业={city} | 兴趣={interests} | 成长方向={direction}"
            )
        return "\n".join(lines)

    def _parse_recommendations(self, parsed: dict, candidates) -> list[FriendRecommendationItem]:
        raw = parsed.get("recommendations") or []
        if not isinstance(raw, list):
            return []
        cand_ids = {p.id for p, _ in candidates}
        result = []
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            fid = entry.get("friend_id") or entry.get("friendId")
            if not fid or fid not in cand_ids:
                continue
            try:
                conf = float(entry.get("confidence", 0.5))
            except (TypeError, ValueError):
                conf = 0.5
            result.append(
                FriendRecommendationItem(
                    **{
                        "friendId": fid,
                        "reason": str(entry.get("reason", ""))[:200],
                        "confidence": max(0.0, min(1.0, conf)),
                    }
                )
            )
        return result

    @staticmethod
    def _parse_suggestions(parsed: dict) -> list[SharedGoalSuggestion]:
        raw = parsed.get("shared_goal_suggestions") or []
        if not isinstance(raw, list):
            return []
        result = []
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            title = entry.get("title")
            if not title:
                continue
            result.append(
                SharedGoalSuggestion(
                    title=str(title)[:80],
                    category=str(entry.get("category", "other"))[:24],
                    description=str(entry.get("description", ""))[:200],
                )
            )
        return result

    def _fallback(
        self, candidates, payload: FriendRecommendationRequest
    ) -> FriendRecommendationResponse:
        """AI 不可用时按兴趣/城市重叠度排序, 仍给出可消费的推荐与共同目标建议."""
        recs = []
        for p, up in candidates[:5]:
            score = 0.5
            reasons = []
            if up and (up.interests or []) and payload.interests:
                overlap = set(up.interests) & set(payload.interests)
                if overlap:
                    score += 0.2 * len(overlap)
                    reasons.append(f"都喜爱 {'、'.join(overlap)}")
            if payload.city and p.current_title and payload.city in (p.current_title or ""):
                score += 0.1
                reasons.append(f"都在{payload.city}")
            if not reasons:
                reasons.append("可能志趣相投, 值得结识")
            recs.append(
                FriendRecommendationItem(
                    **{
                        "friendId": p.id,
                        "reason": "; ".join(reasons),
                        "confidence": min(0.95, score),
                    }
                )
            )
        suggestions = self._fallback_suggestions(payload)
        return FriendRecommendationResponse(
            recommendations=recs,
            shared_goal_suggestions=suggestions,
            source="fallback",
        )

    @staticmethod
    def _fallback_suggestions(payload: FriendRecommendationRequest) -> list[SharedGoalSuggestion]:
        suggestions = []
        if payload.goal_title:
            suggestions.append(
                SharedGoalSuggestion(
                    title=f"一起完成「{payload.goal_title[:12]}」",
                    category="other",
                    description=f"和志同道合的伙伴一起推进「{payload.goal_title}」, 互相督促, 共同成长。",
                )
            )
        if payload.city:
            suggestions.append(
                SharedGoalSuggestion(
                    title=f"一起探索{payload.city}",
                    category="travel",
                    description=f"在{payload.city}找到同伴, 一起打卡城市的精彩角落。",
                )
            )
        if payload.interests:
            top = payload.interests[0]
            suggestions.append(
                SharedGoalSuggestion(
                    title=f"一起精进{top}",
                    category="skill",
                    description=f"组队学习{top}, 定期分享进度, 共同进步。",
                )
            )
        return suggestions


class TeamPlanService:
    """为共同目标生成任务分工 / 时间安排 / 风险提示.

    AI 不可用时回退为均分任务的模板方案, 保证前端可用.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.ai = AIService(db)

    async def plan(self, user_id: str, payload: TeamPlanRequest) -> TeamPlanResponse:
        from app.db.models import GoalMember, LifeGoal, SharedGoal

        sg = self.db.get(SharedGoal, payload.shared_goal_id)
        if sg is None:
            raise AppError(code="NOT_FOUND", message="共同目标不存在", status=404)
        # 仅成员可查看团队规划
        is_member = (
            self.db.query(GoalMember)
            .filter(GoalMember.shared_goal_id == sg.id, GoalMember.user_id == user_id)
            .first()
            is not None
        )
        if not is_member:
            raise AppError(code="FORBIDDEN", message="你未加入此共同目标", status=403)

        goal = self.db.get(LifeGoal, sg.life_goal_id)
        members = self._load_members(sg.id)
        if not members:
            return TeamPlanResponse(source="fallback", collaboration_tip="先邀请伙伴加入共同目标。")

        goal_info = self._build_goal_info(goal)
        members_text = self._build_members(members)
        prompt = TEAM_PLAN_PROMPT.format(goal_info=goal_info, members=members_text)
        input_data = {"shared_goal_id": payload.shared_goal_id, "goal_title": goal.title if goal else ""}

        try:
            _, parsed = await self.ai.generate_content(
                user_id=user_id,
                content_type="team_plan",
                input_data=input_data,
                prompt=prompt,
            )
        except AppError:
            return self._fallback(goal, members)

        response = self._parse(parsed, members)
        if response is None:
            return self._fallback(goal, members)
        return response

    def _load_members(self, shared_id: str):
        from app.db.models import GoalMember, Profile

        rows = (
            self.db.query(GoalMember, Profile)
            .join(Profile, Profile.id == GoalMember.user_id)
            .filter(GoalMember.shared_goal_id == shared_id)
            .order_by(GoalMember.joined_at.asc())
            .all()
        )
        return [(m, p) for m, p in rows]

    def _build_goal_info(self, goal) -> str:
        if goal is None:
            return "目标信息: 共同目标 (标题未知)"
        parts = [
            f"目标标题: {goal.title}",
            f"分类: {goal.category}",
            f"状态: {goal.status}",
            f"进度: {getattr(goal, 'progress', 0) or 0}%",
        ]
        return "\n".join(parts)

    @staticmethod
    def _build_members(members) -> str:
        lines = []
        for m, p in members:
            name = p.display_name or p.email.split("@")[0]
            lines.append(f"- member_id={p.id} | 昵称={name} | 角色={m.role}")
        return "\n".join(lines)

    def _parse(self, parsed: dict, members) -> TeamPlanResponse | None:
        member_ids = {p.id for _, p in members}
        tasks_raw = parsed.get("tasks") or []
        if not isinstance(tasks_raw, list) or not tasks_raw:
            return None
        tasks = []
        for entry in tasks_raw:
            if not isinstance(entry, dict):
                continue
            assignee = entry.get("assignee") or entry.get("assigneeId") or ""
            if assignee and assignee not in member_ids:
                assignee = ""  # 过滤编造的 assignee
            try:
                days = int(entry.get("estimated_days", 1))
            except (TypeError, ValueError):
                days = 1
            tasks.append(
                TeamTaskItem(
                    title=str(entry.get("title", ""))[:120],
                    assignee=assignee,
                    estimated_days=max(1, days),
                    start_at=str(entry.get("start_at", ""))[:24] or None,
                )
            )
        timeline = []
        for entry in parsed.get("timeline") or []:
            if isinstance(entry, dict) and entry.get("milestone"):
                timeline.append(
                    {
                        "milestone": str(entry["milestone"])[:80],
                        "target_date": str(entry.get("target_date", ""))[:24] or None,
                    }
                )
        risks = []
        for entry in parsed.get("risks") or []:
            if isinstance(entry, dict) and entry.get("risk"):
                risks.append(
                    TeamRiskItem(
                        risk=str(entry["risk"])[:200],
                        mitigation=str(entry.get("mitigation", ""))[:200],
                    )
                )
        tip = parsed.get("collaboration_tip") or parsed.get("collaborationTip")
        return TeamPlanResponse(
            tasks=tasks,
            timeline=timeline,
            risks=risks,
            collaboration_tip=str(tip)[:200] if tip else None,
            source="ai",
        )

    def _fallback(self, goal, members) -> TeamPlanResponse:
        """均分任务模板: 把"筹备/执行/复盘"三阶段均分给成员."""
        if not members:
            return TeamPlanResponse(source="fallback")
        goal_title = goal.title if goal else "共同目标"
        phases = [
            (f"「{goal_title}」筹备: 制定计划与分工", 3),
            (f"「{goal_title}」执行: 推进核心任务", 7),
            (f"「{goal_title}」复盘: 总结与分享", 2),
        ]
        tasks = []
        for idx, (title, days) in enumerate(phases):
            assignee_member = members[idx % len(members)]
            tasks.append(
                TeamTaskItem(
                    title=title,
                    assignee=assignee_member[1].id,
                    estimated_days=days,
                    start_at=None,
                )
            )
        return TeamPlanResponse(
            tasks=tasks,
            timeline=[
                {"milestone": "筹备完成", "target_date": None},
                {"milestone": "执行完成", "target_date": None},
            ],
            risks=[
                TeamRiskItem(
                    risk="成员时间安排可能冲突",
                    mitigation="提前固定每周共同时间, 设定缓冲期。",
                ),
                TeamRiskItem(
                    risk="进度不一致导致拖延",
                    mitigation="每周同步进度, 互相督促, 必要时调整分工。",
                ),
            ],
            collaboration_tip="每周固定一次同步会, 进度透明, 互相激励。",
            source="fallback",
        )
