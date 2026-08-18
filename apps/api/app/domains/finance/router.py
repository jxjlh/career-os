import asyncio
import secrets
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import AppError
from app.core.security import get_current_user
from app.core.storage import delete_object, upload_object
from app.db.models import FinanceImport, FinanceProfile, Profile
from app.domains.finance import ocr
from app.domains.finance.repository import FinanceRepository
from app.domains.finance.schemas import (
    FinanceAccountCreate,
    FinanceAccountPatch,
    FinanceCandidateCreate,
    FinanceCandidatePatch,
    FinanceImportConfirm,
    FinanceImportPatch,
    FinanceImportRow,
    FinanceProfilePatch,
    FinanceTransactionCreate,
    FinanceTransactionPatch,
)
from app.domains.finance.service import (
    FinanceService,
    serialize_account,
    serialize_analysis_run,
    serialize_candidate,
    serialize_import,
    serialize_instrument,
    serialize_profile,
    serialize_recommendation,
    serialize_transaction,
)

router = APIRouter(tags=["finance"])

CurrentUser = Annotated[Profile, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]

_SUPPORTED_IMPORT_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
_IMPORT_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024
_IMPORT_BATCH_LIMIT = 9
_IMPORT_SUFFIX_BY_CONTENT_TYPE = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


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


@router.post("/finance/imports/screenshot", status_code=201)
async def import_holdings_screenshot(
    current_user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File(...)],
) -> dict:
    image = await _read_import_image(file)
    provider = ocr.get_holding_ocr_provider()
    finance_import = await _create_import_from_image(current_user, db, file, image, provider)
    return {"data": serialize_import(finance_import)}


@router.post("/finance/imports/screenshots", status_code=201)
async def import_holdings_screenshots(
    current_user: CurrentUser,
    db: DbSession,
    files: Annotated[list[UploadFile], File(...)],
) -> dict:
    if len(files) > _IMPORT_BATCH_LIMIT:
        raise AppError(
            code="IMPORT_BATCH_TOO_LARGE",
            message="一次最多上传 9 张持仓截图",
            status=422,
        )
    images = [(file, await _read_import_image(file)) for file in files]
    provider = ocr.get_holding_ocr_provider()
    imports = []
    failures = []
    for file, image in images:
        try:
            finance_import = await _create_import_from_image(current_user, db, file, image, provider)
        except AppError as exc:
            failures.append({"filename": Path(file.filename or "holding-image").name, "code": exc.code})
        else:
            imports.append(serialize_import(finance_import))
    return {"data": {"imports": imports, "failures": failures}}


async def _read_import_image(file: UploadFile) -> bytes:
    if file.content_type not in _SUPPORTED_IMPORT_CONTENT_TYPES:
        raise AppError(
            code="INVALID_IMPORT_IMAGE",
            message="仅支持 PNG、JPEG 或 WebP 格式的持仓截图",
            status=422,
        )
    image = await file.read(_IMPORT_UPLOAD_LIMIT_BYTES + 1)
    if not image:
        raise AppError(code="INVALID_IMPORT_IMAGE", message="持仓截图不能为空", status=422)
    if len(image) > _IMPORT_UPLOAD_LIMIT_BYTES:
        raise AppError(
            code="IMPORT_IMAGE_TOO_LARGE",
            message="持仓截图不能超过 10 MB",
            status=413,
        )
    return image


async def _create_import_from_image(
    current_user: Profile,
    db: Session,
    file: UploadFile,
    image: bytes,
    provider: ocr.HoldingOcrProvider,
) -> FinanceImport:
    assert file.content_type in _IMPORT_SUFFIX_BY_CONTENT_TYPE

    suffix = _IMPORT_SUFFIX_BY_CONTENT_TYPE[file.content_type]
    path = f"finance-imports/{current_user.id}/{uuid4().hex}{suffix}"
    stored_path = await upload_object(path, image, file.content_type)
    service = FinanceService(db)
    try:
        finance_import = service.create_import(
            current_user.id,
            stored_path,
            {
                "filename": Path(file.filename or "holding-image").name,
                "contentType": file.content_type,
                "sizeBytes": len(image),
            },
        )
    except Exception:
        await delete_object(stored_path)
        raise
    try:
        extracted = await asyncio.to_thread(provider.extract, image, file.content_type)
        if not extracted:
            raise AppError(
                code="OCR_NO_HOLDINGS_FOUND",
                message="未识别到可确认的持仓，请使用更清晰截图或手动维护",
                status=422,
            )
        rows = [
            FinanceImportRow(
                name=row.name,
                symbol=row.symbol,
                market=row.market,
                asset_class=row.asset_class,
                currency=row.currency,
                quantity=row.quantity,
                unit_price=row.unit_price,
                confidence=row.confidence,
            )
            for row in extracted
        ]
        raw_ocr_text = "\n".join(row.raw_text or "" for row in extracted)
        finance_import = service.set_import_rows(current_user.id, finance_import.id, rows, raw_ocr_text)
    except AppError as exc:
        await service.fail_import(current_user.id, finance_import.id, exc.code)
        raise
    except Exception as exc:
        await service.fail_import(current_user.id, finance_import.id, "OCR_EXTRACTION_FAILED")
        raise AppError(
            code="OCR_EXTRACTION_FAILED",
            message="持仓截图识别失败，请稍后重试或改用手动维护",
            status=503,
        ) from exc
    return finance_import


@router.get("/finance/imports/{import_id}")
async def get_import(import_id: str, current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": serialize_import(await FinanceService(db).get_import(current_user.id, import_id))}


@router.patch("/finance/imports/{import_id}")
async def update_import(
    import_id: str,
    payload: FinanceImportPatch,
    current_user: CurrentUser,
    db: DbSession,
) -> dict:
    return {"data": serialize_import(await FinanceService(db).update_import(current_user.id, import_id, payload))}


@router.post("/finance/imports/{import_id}/confirm")
async def confirm_import(
    import_id: str,
    payload: FinanceImportConfirm,
    current_user: CurrentUser,
    db: DbSession,
) -> dict:
    return {"data": serialize_import(await FinanceService(db).confirm_import(current_user.id, import_id, payload.rows))}


@router.post("/finance/imports/{import_id}/discard")
async def discard_import(import_id: str, current_user: CurrentUser, db: DbSession) -> dict:
    return {"data": serialize_import(await FinanceService(db).discard_import(current_user.id, import_id))}


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


@router.post("/finance/analysis/run", response_model=None)
async def run_analysis(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
    x_dev_user_id: Annotated[str | None, Header()] = None,
    scheduler_token: Annotated[str | None, Header(alias="X-Finance-Scheduler-Token")] = None,
) -> dict | JSONResponse:
    if authorization:
        current_user = get_current_user(db=db, authorization=authorization, x_dev_user_id=x_dev_user_id)
        service = FinanceService(db)
        run = service.run_analysis(current_user.id)
        run = await service.enrich_analysis_explanation(current_user.id, run.id)
        return {"data": serialize_analysis_run(run)}

    configured_token = get_settings().finance_scheduler_token
    if not configured_token or not scheduler_token or not secrets.compare_digest(configured_token, scheduler_token):
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Scheduler authentication required"},
        )

    service = FinanceService(db)
    user_ids = [user_id for (user_id,) in db.query(FinanceProfile.user_id).all()]
    for user_id in user_ids:
        run = service.run_analysis(user_id)
        await service.enrich_analysis_explanation(user_id, run.id)

    return JSONResponse(
        status_code=202,
        content=jsonable_encoder({"data": {"scope": "all_markets", "processedUsers": len(user_ids)}}),
    )


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
