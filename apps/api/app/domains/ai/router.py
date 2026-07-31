from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.ai.schemas import TravelPlanRequest, TravelPlanResponse
from app.domains.ai.service import TravelPlanService

router = APIRouter(tags=["ai"])


@router.post("/ai/travel-plan", response_model=TravelPlanResponse)
async def generate_travel_plan(
    payload: TravelPlanRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TravelPlanResponse:
    return await TravelPlanService(db).generate(current_user.id, payload)
