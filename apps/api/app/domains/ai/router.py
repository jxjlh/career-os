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
    GenerateTasksResponse,
    GrowthPlanRequest,
    GrowthPlanResponse,
    LifeAssistantResponse,
    TravelPlanRequest,
    TravelPlanResponse,
    YearReviewRequest,
    YearReviewResponse,
    YearSummaryRequest,
    YearSummaryResponse,
)
from app.domains.ai.service import (
    BucketRecommendationService,
    GrowthPlanService,
    GrowthTaskGeneratorService,
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
