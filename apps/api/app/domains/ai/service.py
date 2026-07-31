import json
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import AIContent, GoalTask
from app.domains.ai.prompts.bucket_recommendation import BUCKET_RECOMMENDATION_PROMPT
from app.domains.ai.prompts.growth_plan import GROWTH_PLAN_PROMPT
from app.domains.ai.prompts.map_insight import MAP_INSIGHT_PROMPT
from app.domains.ai.prompts.travel_plan import TRAVEL_PLAN_PROMPT
from app.domains.ai.prompts.year_summary import YEAR_SUMMARY_PROMPT
from app.domains.ai.repository import AIContentRepository
from app.domains.ai.schemas import (
    BucketRecommendationItem,
    BucketRecommendationRequest,
    BucketRecommendationResponse,
    GenerateTasksResponse,
    GrowthPlanRequest,
    GrowthPlanResponse,
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
