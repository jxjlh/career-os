from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.finance.repository import FinanceRepository
from app.domains.finance.schemas import (
    FinanceAccountCreate,
    FinanceAccountPatch,
    FinanceCandidateCreate,
    FinanceCandidatePatch,
    FinanceProfilePatch,
    FinanceTransactionCreate,
    FinanceTransactionPatch,
)
from app.domains.finance.service import (
    FinanceService,
    serialize_account,
    serialize_analysis_run,
    serialize_candidate,
    serialize_instrument,
    serialize_profile,
    serialize_recommendation,
    serialize_transaction,
)

router = APIRouter(tags=["finance"])

CurrentUser = Annotated[Profile, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/finance/profile")
def get_profile(current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": serialize_profile(FinanceService(db).get_or_create_profile(current_user.id))}


@router.patch("/finance/profile")
def update_profile(payload: FinanceProfilePatch, current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": serialize_profile(FinanceService(db).update_profile(current_user.id, payload))}


@router.get("/finance/accounts")
def list_accounts(current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": [serialize_account(item) for item in FinanceRepository(db).list_accounts(current_user.id)]}


@router.post("/finance/accounts", status_code=201)
def create_account(payload: FinanceAccountCreate, current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": serialize_account(FinanceService(db).create_account(current_user.id, payload))}


@router.get("/finance/accounts/{account_id}")
def get_account(account_id: str, current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": serialize_account(FinanceService(db).require_account(current_user.id, account_id))}


@router.patch("/finance/accounts/{account_id}")
def update_account(account_id: str, payload: FinanceAccountPatch, current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": serialize_account(FinanceService(db).update_account(current_user.id, account_id, payload))}


@router.delete("/finance/accounts/{account_id}", status_code=204)
def delete_account(account_id: str, current_user: CurrentUser, db: DbSession) -> None:
    FinanceService(db).delete_account(current_user.id, account_id)


@router.get("/finance/transactions")
def list_transactions(current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": [serialize_transaction(item) for item in FinanceRepository(db).list_transactions(current_user.id)]}


@router.get("/finance/transactions/{transaction_id}")
def get_transaction(transaction_id: str, current_user: CurrentUser, db: DbSession) -> dict:
    transaction = FinanceRepository(db).get_owned_transaction(current_user.id, transaction_id)
    if transaction is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Finance transaction not found"})
    return {"data": serialize_transaction(transaction)}


@router.post("/finance/transactions", status_code=201)
def create_transaction(payload: FinanceTransactionCreate, current_user: CurrentUser, db: DbSession) -> dict:
    transaction = FinanceService(db).apply_transaction(current_user.id, payload)
    return {"data": serialize_transaction(transaction)}


@router.patch("/finance/transactions/{transaction_id}")
def update_transaction(
    transaction_id: str,
    payload: FinanceTransactionPatch,
    current_user: CurrentUser,
    db: DbSession,
) -> dict:
    transaction = FinanceService(db).update_transaction(current_user.id, transaction_id, payload)
    return {"data": serialize_transaction(transaction)}


@router.delete("/finance/transactions/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: str, current_user: CurrentUser, db: DbSession) -> None:
    FinanceService(db).delete_transaction(current_user.id, transaction_id)


@router.get("/finance/candidates")
def list_candidates(current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": [serialize_candidate(item) for item in FinanceRepository(db).list_candidates(current_user.id)]}


@router.post("/finance/candidates", status_code=201)
def create_candidate(payload: FinanceCandidateCreate, current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": serialize_candidate(FinanceService(db).create_candidate(current_user.id, payload))}


@router.get("/finance/candidates/{candidate_id}")
def get_candidate(candidate_id: str, current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": serialize_candidate(FinanceService(db).require_candidate(current_user.id, candidate_id))}


@router.patch("/finance/candidates/{candidate_id}")
def update_candidate(candidate_id: str, payload: FinanceCandidatePatch, current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": serialize_candidate(FinanceService(db).update_candidate(current_user.id, candidate_id, payload))}


@router.delete("/finance/candidates/{candidate_id}", status_code=204)
def delete_candidate(candidate_id: str, current_user: CurrentUser, db: DbSession) -> None:
    FinanceService(db).delete_candidate(current_user.id, candidate_id)


@router.get("/finance/instruments/search")
def search_instruments(
    current_user: CurrentUser,
    db: DbSession,
    q: Annotated[str, Query(min_length=1, max_length=120)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> dict:
    del current_user
    return {"data": [serialize_instrument(item) for item in FinanceRepository(db).search_instruments(q, limit)]}


@router.get("/finance/dashboard")
def get_dashboard(current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": FinanceService(db).build_dashboard(current_user.id)}


@router.post("/finance/analysis/run")
async def run_analysis(current_user: CurrentUser, db: DbSession) -> dict:
    service = FinanceService(db)
    run = service.run_analysis(current_user.id)
    run = await service.enrich_analysis_explanation(current_user.id, run.id)
    return {"data": serialize_analysis_run(run)}


@router.get("/finance/analysis/latest")
def get_latest_analysis(current_user: CurrentUser, db: DbSession) -> dict:
    run = FinanceService(db).get_latest_analysis(current_user.id)
    return {"data": serialize_analysis_run(run) if run is not None else None}


@router.get("/finance/recommendations")
def list_recommendations(current_user: CurrentUser, db: DbSession) -> dict:
    service = FinanceService(db)
    return {"data": [serialize_recommendation(item) for item in service.list_recommendations(current_user.id)]}


@router.post("/finance/recommendations/{recommendation_id}/dismiss")
def dismiss_recommendation(recommendation_id: str, current_user: CurrentUser, db: DbSession) -> dict:
    recommendation = FinanceService(db).dismiss_recommendation(current_user.id, recommendation_id)
    return {"data": serialize_recommendation(recommendation)}
