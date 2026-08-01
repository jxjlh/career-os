from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.ai.assistant import LifeAssistantService
from app.domains.ai.schemas import (
    BucketRecommendationRequest,
    BucketRecommendationResponse,
    FriendRecommendationRequest,
    FriendRecommendationResponse,
    GenerateTasksResponse,
    GrowthPlanRequest,
    GrowthPlanResponse,
    JournalRequest,
    JournalResponse,
    LifeAssistantResponse,
    PhotoAnalysisRequest,
    PhotoAnalysisResponse,
    TeamPlanRequest,
    TeamPlanResponse,
    TravelAssistantRequest,
    TravelAssistantResponse,
    TravelChecklistItemCreate,
    TravelChecklistItemResponse,
    TravelChecklistItemUpdate,
    TravelPlanRequest,
    TravelPlanResponse,
    YearReviewRequest,
    YearReviewResponse,
    YearSummaryRequest,
    YearSummaryResponse,
)
from app.domains.ai.service import (
    BucketRecommendationService,
    FriendRecommendationService,
    GrowthPlanService,
    GrowthTaskGeneratorService,
    JournalService,
    MapInsightService,
    PhotoAnalysisService,
    TeamPlanService,
    TravelAssistantService,
    TravelChecklistService,
    TravelPlanService,
    YearSummaryService,
)
from app.domains.ai.year_review import YearReviewService

router = APIRouter(tags=["ai"])


@router.post("/ai/travel-plan", response_model=TravelPlanResponse)
async def generate_travel_plan(
    payload: TravelPlanRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TravelPlanResponse:
    return await TravelPlanService(db).generate(current_user.id, payload)


@router.post("/ai/travel-assistant", response_model=TravelAssistantResponse)
async def travel_assistant(
    payload: TravelAssistantRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TravelAssistantResponse:
    return await TravelAssistantService(db).generate(current_user.id, payload)


@router.get("/ai/travel-plan/{ai_content_id}/checklist", response_model=list[TravelChecklistItemResponse])
def travel_checklist(
    ai_content_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[TravelChecklistItemResponse]:
    return TravelChecklistService(db).list(current_user.id, ai_content_id)


@router.post(
    "/ai/travel-plan/{ai_content_id}/checklist",
    response_model=TravelChecklistItemResponse,
    status_code=201,
)
def add_travel_checklist_item(
    ai_content_id: str,
    payload: TravelChecklistItemCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TravelChecklistItemResponse:
    return TravelChecklistService(db).add(current_user.id, ai_content_id, payload)


@router.patch(
    "/ai/travel-plan/checklist/{item_id}",
    response_model=TravelChecklistItemResponse,
)
def update_travel_checklist_item(
    item_id: str,
    payload: TravelChecklistItemUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TravelChecklistItemResponse:
    return TravelChecklistService(db).update(current_user.id, item_id, payload)


@router.delete("/ai/travel-plan/checklist/{item_id}", status_code=204)
def delete_travel_checklist_item(
    item_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    TravelChecklistService(db).delete(current_user.id, item_id)


@router.post("/ai/growth-plan", response_model=GrowthPlanResponse)
async def generate_growth_plan(
    payload: GrowthPlanRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GrowthPlanResponse:
    return await GrowthPlanService(db).generate(current_user.id, payload)


@router.post("/ai/growth-plan/{ai_content_id}/generate-tasks", response_model=GenerateTasksResponse)
def generate_tasks_from_growth_plan(
    ai_content_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GenerateTasksResponse:
    return GrowthTaskGeneratorService(db).generate(current_user.id, ai_content_id)


@router.get("/ai/assistant/daily", response_model=LifeAssistantResponse)
async def daily_life_assistant(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> LifeAssistantResponse:
    return await LifeAssistantService(db).daily(current_user.id)


@router.post("/ai/year-summary", response_model=YearSummaryResponse)
async def generate_year_summary(
    payload: YearSummaryRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> YearSummaryResponse:
    return await YearSummaryService(db).generate(current_user.id, payload)


@router.get("/ai/year-summary", response_model=YearSummaryResponse)
def get_year_summary(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> YearSummaryResponse:
    result = YearSummaryService(db).get_latest(current_user.id, year)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Year summary not found"})
    return result


@router.post("/ai/year-review", response_model=YearReviewResponse)
async def generate_year_review(
    payload: YearReviewRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> YearReviewResponse:
    return await YearReviewService(db).generate(current_user.id, payload)


@router.post("/ai/bucket-recommendation", response_model=BucketRecommendationResponse)
async def recommend_bucket_items(
    payload: BucketRecommendationRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> BucketRecommendationResponse:
    return await BucketRecommendationService(db).recommend(current_user.id, payload)


@router.post("/ai/map-insight")
async def generate_map_insight(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": await MapInsightService(db).generate(current_user.id)}


# ── Sprint 7 Life Camera: AI 场景识别 + AI 日志生成 ──────────────────
@router.post("/ai/photo-analysis", response_model=PhotoAnalysisResponse)
async def analyze_photo(
    payload: PhotoAnalysisRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> PhotoAnalysisResponse:
    return await PhotoAnalysisService(db).analyze(current_user.id, payload)


@router.post("/ai/journal", response_model=JournalResponse)
async def generate_journal(
    payload: JournalRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> JournalResponse:
    return await JournalService(db).generate(current_user.id, payload)


# ── Sprint 8 Life Social: AI 好友推荐 + 团队规划 ─────────────────────
@router.post("/ai/friend-recommendation", response_model=FriendRecommendationResponse)
async def recommend_friends(
    payload: FriendRecommendationRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FriendRecommendationResponse:
    return await FriendRecommendationService(db).recommend(current_user.id, payload)


@router.post("/ai/team-plan", response_model=TeamPlanResponse)
async def generate_team_plan(
    payload: TeamPlanRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TeamPlanResponse:
    return await TeamPlanService(db).plan(current_user.id, payload)
