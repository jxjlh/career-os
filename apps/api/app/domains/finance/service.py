from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from inspect import isawaitable
from typing import Any

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.storage import delete_object
from app.db.models import (
    FinanceAccount,
    FinanceAnalysisRun,
    FinanceCandidate,
    FinanceImport,
    FinancePosition,
    FinanceProfile,
    FinanceRecommendation,
    FinanceSnapshot,
    FinanceTransaction,
    FinancialInstrument,
)
from app.domains.finance.analysis import (
    AnalysisCandidate,
    AnalysisPosition,
    RuleRecommendation,
    evaluate_portfolio,
    quotes_are_fresh,
)
from app.domains.finance.market_data import (
    MarketDataError,
    MarketDataProvider,
    MarketQuote,
    get_market_data_provider,
)
from app.domains.finance.repository import FinanceRepository
from app.domains.finance.schemas import (
    FinanceAccountCreate,
    FinanceAccountPatch,
    FinanceCandidateCreate,
    FinanceCandidatePatch,
    FinanceImportPatch,
    FinanceImportRow,
    FinanceProfilePatch,
    FinanceTransactionCreate,
    FinanceTransactionPatch,
    FinancialInstrumentInput,
)


def _not_found(message: str) -> HTTPException:
    return HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": message})


def _conflict(message: str) -> HTTPException:
    return HTTPException(status_code=409, detail={"code": "CONFLICT", "message": message})


class FinanceService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = FinanceRepository(db)

    def get_or_create_profile(self, user_id: str) -> FinanceProfile:
        profile = self.repository.get_profile(user_id)
        if profile is None:
            profile = FinanceProfile(user_id=user_id)
            self.db.add(profile)
            self.db.commit()
            self.db.refresh(profile)
        return profile

    def update_profile(self, user_id: str, payload: FinanceProfilePatch) -> FinanceProfile:
        profile = self.get_or_create_profile(user_id)
        updates = payload.model_dump(exclude_unset=True)
        if "target_allocation" in updates:
            updates["target_allocation"] = {key: str(value) for key, value in updates["target_allocation"].items()}
        for field, value in updates.items():
            setattr(profile, field, value)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def create_import(
        self,
        user_id: str,
        temporary_object_path: str,
        source_metadata: dict[str, Any],
    ) -> FinanceImport:
        finance_import = FinanceImport(
            user_id=user_id,
            status="processing",
            temporary_object_path=temporary_object_path,
            source_metadata=source_metadata,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
        self.db.add(finance_import)
        self.db.commit()
        self.db.refresh(finance_import)
        return finance_import

    def set_import_rows(self, user_id: str, import_id: str, rows: list[FinanceImportRow], raw_ocr_text: str) -> FinanceImport:
        finance_import = self.require_import(user_id, import_id)
        if finance_import.status != "processing":
            raise _conflict("Finance import is no longer processing")
        finance_import.extracted_rows = [_serialize_import_row_for_storage(row) for row in rows]
        finance_import.raw_ocr_text = raw_ocr_text[:50000] or None
        finance_import.status = "review"
        finance_import.error_code = None
        self.db.commit()
        self.db.refresh(finance_import)
        return finance_import

    async def fail_import(self, user_id: str, import_id: str, error_code: str) -> FinanceImport:
        finance_import = self.require_import(user_id, import_id)
        await self._delete_temporary_object(finance_import)
        finance_import.status = "failed"
        finance_import.error_code = error_code
        finance_import.processed_at = datetime.now(UTC)
        self.db.commit()
        self.db.refresh(finance_import)
        return finance_import

    async def get_import(self, user_id: str, import_id: str) -> FinanceImport:
        finance_import = self.require_import(user_id, import_id)
        await self.expire_imports()
        self.db.refresh(finance_import)
        return finance_import

    async def update_import(self, user_id: str, import_id: str, payload: FinanceImportPatch) -> FinanceImport:
        finance_import = await self.get_import(user_id, import_id)
        if finance_import.status != "review":
            raise _conflict("Only imports awaiting review can be updated")
        existing_ids = {row.get("rowId") for row in finance_import.extracted_rows if isinstance(row, dict)}
        submitted_ids = {row.row_id for row in payload.rows}
        if not submitted_ids or not submitted_ids.issubset(existing_ids):
            raise HTTPException(
                status_code=422,
                detail={"code": "VALIDATION_ERROR", "message": "Import rows must use recognized row IDs"},
            )
        finance_import.extracted_rows = [_serialize_import_row_for_storage(row) for row in payload.rows]
        self.db.commit()
        self.db.refresh(finance_import)
        return finance_import

    async def confirm_import(self, user_id: str, import_id: str, rows: list[FinanceImportRow]) -> FinanceImport:
        finance_import = await self.get_import(user_id, import_id)
        if finance_import.status == "confirmed":
            return finance_import
        if finance_import.status != "review":
            raise _conflict("Only imports awaiting review can be confirmed")
        self._validate_import_rows(finance_import, rows)
        for row in rows:
            assert row.account_id and row.name and row.symbol and row.market and row.asset_class and row.currency
            assert row.quantity is not None and row.unit_price is not None and row.occurred_on is not None
            self.apply_transaction(
                user_id,
                FinanceTransactionCreate(
                    account_id=row.account_id,
                    instrument=FinancialInstrumentInput(
                        market=row.market,
                        symbol=row.symbol,
                        name=row.name,
                        asset_class=row.asset_class,
                        currency=row.currency,
                    ),
                    transaction_type="buy",
                    quantity=row.quantity,
                    unit_price=row.unit_price,
                    fee=row.fee,
                    client_reference=f"finance-import:{finance_import.id}:{row.row_id}",
                    currency=row.currency,
                    occurred_on=row.occurred_on,
                    notes=row.notes,
                ),
                source="screenshot_import",
            )
        await self._delete_temporary_object(finance_import)
        finance_import.status = "confirmed"
        finance_import.error_code = None
        finance_import.processed_at = datetime.now(UTC)
        self.db.commit()
        self.db.refresh(finance_import)
        return finance_import

    async def discard_import(self, user_id: str, import_id: str) -> FinanceImport:
        finance_import = await self.get_import(user_id, import_id)
        if finance_import.status == "discarded":
            return finance_import
        if finance_import.status != "review":
            raise _conflict("Only imports awaiting review can be discarded")
        await self._delete_temporary_object(finance_import)
        finance_import.status = "discarded"
        finance_import.processed_at = datetime.now(UTC)
        self.db.commit()
        self.db.refresh(finance_import)
        return finance_import

    async def expire_imports(self) -> list[FinanceImport]:
        expired = self.repository.list_expired_open_imports(datetime.now(UTC))
        for finance_import in expired:
            await self._delete_temporary_object(finance_import)
            finance_import.status = "expired"
            finance_import.error_code = "IMPORT_EXPIRED"
            finance_import.processed_at = datetime.now(UTC)
        if expired:
            self.db.commit()
        return expired

    def require_import(self, user_id: str, import_id: str) -> FinanceImport:
        finance_import = self.repository.get_owned_import(user_id, import_id)
        if finance_import is None:
            raise _not_found("Finance import not found")
        return finance_import

    async def _delete_temporary_object(self, finance_import: FinanceImport) -> None:
        if finance_import.temporary_object_path:
            result = delete_object(finance_import.temporary_object_path)
            if isawaitable(result):
                await result
        finance_import.temporary_object_path = None
        finance_import.raw_ocr_text = None

    def _validate_import_rows(self, finance_import: FinanceImport, rows: list[FinanceImportRow]) -> None:
        stored_ids = {row.get("rowId") for row in finance_import.extracted_rows if isinstance(row, dict)}
        submitted_ids = {row.row_id for row in rows}
        if not rows or stored_ids != submitted_ids:
            raise HTTPException(
                status_code=422,
                detail={"code": "VALIDATION_ERROR", "message": "Confirm all recognized import rows exactly once"},
            )
        for row in rows:
            if not all(
                (
                    row.account_id,
                    row.name,
                    row.symbol,
                    row.market,
                    row.asset_class,
                    row.currency,
                    row.quantity is not None,
                    row.unit_price is not None,
                    row.occurred_on,
                )
            ):
                raise HTTPException(
                    status_code=422,
                    detail={"code": "IMPORT_ROW_INCOMPLETE", "message": "Please complete every import row before confirmation"},
                )

    def create_account(self, user_id: str, payload: FinanceAccountCreate) -> FinanceAccount:
        account = FinanceAccount(user_id=user_id, **payload.model_dump())
        self.db.add(account)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise _conflict("An account with this name already exists") from exc
        self.db.refresh(account)
        return account

    def update_account(self, user_id: str, account_id: str, payload: FinanceAccountPatch) -> FinanceAccount:
        account = self.require_account(user_id, account_id)
        updates = payload.model_dump(exclude_unset=True)
        market = updates.get("market", account.market)
        currency = updates.get("currency", account.currency)
        if {"CN": "CNY", "HK": "HKD", "US": "USD"}[market] != currency:
            raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": "currency must match the selected market"})
        if (
            (market != account.market or currency != account.currency)
            and self.repository.has_transactions_for_account(user_id, account.id)
        ):
            raise _conflict("Accounts with recorded transactions cannot change market or currency")
        for field, value in updates.items():
            setattr(account, field, value)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise _conflict("An account with this name already exists") from exc
        self.db.refresh(account)
        return account

    def delete_account(self, user_id: str, account_id: str) -> None:
        account = self.require_account(user_id, account_id)
        if self.repository.has_transactions_for_account(user_id, account.id):
            raise _conflict("Accounts with recorded transactions cannot be deleted")
        self.db.delete(account)
        self.db.commit()

    def require_account(self, user_id: str, account_id: str) -> FinanceAccount:
        account = self.repository.get_owned_account(user_id, account_id)
        if account is None:
            raise _not_found("Finance account not found")
        return account

    def resolve_instrument(self, payload: FinanceTransactionCreate) -> FinancialInstrument:
        if payload.instrument_id:
            instrument = self.repository.get_instrument(payload.instrument_id)
            if instrument is None:
                raise _not_found("Financial instrument not found")
            return instrument
        assert payload.instrument is not None
        return self.get_or_create_instrument(payload.instrument)

    def get_or_create_instrument(self, payload: FinancialInstrumentInput) -> FinancialInstrument:
        instrument = self.repository.get_instrument_by_market_symbol(payload.market, payload.symbol)
        if instrument is not None:
            if instrument.currency != payload.currency or instrument.asset_class != payload.asset_class:
                raise _conflict("Existing instrument does not match currency or asset class")
            return instrument
        instrument = FinancialInstrument(**payload.model_dump())
        self.db.add(instrument)
        self.db.flush()
        return instrument

    def require_instrument(self, instrument_id: str) -> FinancialInstrument:
        instrument = self.repository.get_instrument(instrument_id)
        if instrument is None:
            raise _not_found("Financial instrument not found")
        return instrument

    def validate_transaction_context(
        self,
        user_id: str,
        account_id: str,
        instrument_id: str,
        requested_currency: str | None,
    ) -> tuple[FinanceAccount, FinancialInstrument, str]:
        account = self.require_account(user_id, account_id)
        instrument = self.require_instrument(instrument_id)
        currency = requested_currency or instrument.currency
        if account.currency != currency or instrument.currency != currency:
            raise HTTPException(
                status_code=422,
                detail={"code": "VALIDATION_ERROR", "message": "transaction currency must match account and instrument"},
            )
        return account, instrument, currency

    def apply_transaction(
        self,
        user_id: str,
        payload: FinanceTransactionCreate,
        *,
        _position_retry: bool = True,
        source: str = "manual",
    ) -> FinanceTransaction:
        existing = self.get_equivalent_transaction_by_client_reference(user_id, payload)
        if existing is not None:
            return existing

        account = self.require_account(user_id, payload.account_id)
        instrument = self.resolve_instrument(payload)
        _, _, currency = self.validate_transaction_context(user_id, account.id, instrument.id, payload.currency)
        transaction = FinanceTransaction(
            user_id=user_id,
            account_id=account.id,
            instrument_id=instrument.id,
            transaction_type=payload.transaction_type,
            quantity=payload.quantity,
            unit_price=payload.unit_price,
            fee=payload.fee,
            client_reference=payload.client_reference,
            currency=currency,
            occurred_on=payload.occurred_on,
            source=source,
            notes=payload.notes,
        )
        try:
            self.db.add(transaction)
            self.db.flush()
            self.replay_positions(user_id, {(account.id, instrument.id)})
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            existing = self.get_equivalent_transaction_by_client_reference(user_id, payload)
            if existing is not None:
                return existing
            if _position_retry:
                return self.apply_transaction(user_id, payload, _position_retry=False)
            raise _conflict("Unable to create finance transaction") from exc
        except HTTPException:
            self.db.rollback()
            raise
        self.db.refresh(transaction)
        return transaction

    def update_transaction(
        self,
        user_id: str,
        transaction_id: str,
        payload: FinanceTransactionPatch,
    ) -> FinanceTransaction:
        transaction = self.require_transaction(user_id, transaction_id, for_update=True)
        original_key = (transaction.account_id, transaction.instrument_id)
        updates = payload.model_dump(exclude_unset=True)
        account_id = updates.get("account_id", transaction.account_id)
        instrument_id = updates.get("instrument_id", transaction.instrument_id)
        _, _, currency = self.validate_transaction_context(
            user_id,
            account_id,
            instrument_id,
            updates.get("currency", transaction.currency),
        )
        updates["currency"] = currency
        for field, value in updates.items():
            setattr(transaction, field, value)
        try:
            self.db.flush()
            self.replay_positions(user_id, {original_key, (transaction.account_id, transaction.instrument_id)})
            self.db.commit()
        except HTTPException:
            self.db.rollback()
            raise
        self.db.refresh(transaction)
        return transaction

    def delete_transaction(self, user_id: str, transaction_id: str) -> None:
        transaction = self.require_transaction(user_id, transaction_id, for_update=True)
        position_key = (transaction.account_id, transaction.instrument_id)
        try:
            self.db.delete(transaction)
            self.db.flush()
            self.replay_positions(user_id, {position_key})
            self.db.commit()
        except HTTPException:
            self.db.rollback()
            raise

    def require_transaction(self, user_id: str, transaction_id: str, *, for_update: bool = False) -> FinanceTransaction:
        transaction = self.repository.get_owned_transaction(user_id, transaction_id, for_update=for_update)
        if transaction is None:
            raise _not_found("Finance transaction not found")
        return transaction

    def get_equivalent_transaction_by_client_reference(
        self,
        user_id: str,
        payload: FinanceTransactionCreate,
    ) -> FinanceTransaction | None:
        existing = self.repository.get_transaction_by_client_reference(user_id, payload.client_reference)
        if existing is None:
            return None

        account = self.require_account(user_id, payload.account_id)
        instrument = self.resolve_existing_instrument(payload)
        _, _, currency = self.validate_transaction_context(user_id, account.id, instrument.id, payload.currency)
        if (
            existing.account_id != account.id
            or existing.instrument_id != instrument.id
            or existing.transaction_type != payload.transaction_type
            or existing.quantity != payload.quantity
            or existing.unit_price != payload.unit_price
            or existing.fee != payload.fee
            or existing.currency != currency
            or existing.occurred_on != payload.occurred_on
            or existing.notes != payload.notes
        ):
            raise _conflict("clientReference is already used by a different transaction")
        return existing

    def resolve_existing_instrument(self, payload: FinanceTransactionCreate) -> FinancialInstrument:
        if payload.instrument_id:
            return self.require_instrument(payload.instrument_id)
        assert payload.instrument is not None
        instrument = self.repository.get_instrument_by_market_symbol(payload.instrument.market, payload.instrument.symbol)
        if instrument is None:
            raise _conflict("clientReference is already used by a different transaction")
        if instrument.currency != payload.instrument.currency or instrument.asset_class != payload.instrument.asset_class:
            raise _conflict("clientReference is already used by a different transaction")
        return instrument

    def replay_positions(self, user_id: str, position_keys: set[tuple[str, str]]) -> None:
        for account_id, instrument_id in sorted(position_keys):
            self.replay_position(user_id, account_id, instrument_id)

    def replay_position(self, user_id: str, account_id: str, instrument_id: str) -> None:
        self.repository.lock_position_key(user_id, account_id, instrument_id)
        transactions = self.repository.list_transactions_for_position(user_id, account_id, instrument_id, for_update=True)
        position = self.repository.get_owned_position(user_id, account_id, instrument_id, for_update=True)
        if position is None and not transactions:
            return
        if position is None:
            position = FinancePosition(
                user_id=user_id,
                account_id=account_id,
                instrument_id=instrument_id,
                quantity=Decimal("0"),
                average_cost=Decimal("0"),
            )
            self.db.add(position)

        quantity = Decimal("0")
        average_cost = Decimal("0")
        for transaction in transactions:
            if transaction.transaction_type == "buy":
                total_cost = quantity * average_cost + transaction.quantity * transaction.unit_price + transaction.fee
                quantity += transaction.quantity
                average_cost = total_cost / quantity
            elif transaction.transaction_type == "sell":
                if transaction.quantity > quantity:
                    raise HTTPException(
                        status_code=422,
                        detail={"code": "VALIDATION_ERROR", "message": "transaction history would create a negative position"},
                    )
                quantity -= transaction.quantity
                if quantity == 0:
                    average_cost = Decimal("0")

        position.quantity = quantity
        position.average_cost = average_cost
        if position.market_price is not None:
            position.market_value = position.market_price * quantity
            position.unrealized_profit_loss = position.market_value - quantity * average_cost

    def create_candidate(self, user_id: str, payload: FinanceCandidateCreate) -> FinanceCandidate:
        if self.repository.get_instrument(payload.instrument_id) is None:
            raise _not_found("Financial instrument not found")
        candidate = FinanceCandidate(user_id=user_id, **payload.model_dump())
        self.db.add(candidate)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise _conflict("This instrument is already in the candidate pool") from exc
        self.db.refresh(candidate)
        return candidate

    def require_candidate(self, user_id: str, candidate_id: str) -> FinanceCandidate:
        candidate = self.repository.get_owned_candidate(user_id, candidate_id)
        if candidate is None:
            raise _not_found("Finance candidate not found")
        return candidate

    def update_candidate(self, user_id: str, candidate_id: str, payload: FinanceCandidatePatch) -> FinanceCandidate:
        candidate = self.require_candidate(user_id, candidate_id)
        updates = payload.model_dump(exclude_unset=True)
        lower = updates.get("target_allocation_min", candidate.target_allocation_min)
        upper = updates.get("target_allocation_max", candidate.target_allocation_max)
        if lower is not None and upper is not None and lower > upper:
            raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": "targetAllocationMin must not exceed targetAllocationMax"})
        for field, value in updates.items():
            setattr(candidate, field, value)
        self.db.commit()
        self.db.refresh(candidate)
        return candidate

    def delete_candidate(self, user_id: str, candidate_id: str) -> None:
        candidate = self.require_candidate(user_id, candidate_id)
        self.db.delete(candidate)
        self.db.commit()

    def run_analysis(
        self,
        user_id: str,
        *,
        provider: MarketDataProvider | None = None,
        now: datetime | None = None,
    ) -> FinanceAnalysisRun:
        now = now or datetime.now(UTC)
        run_on = now.date()
        existing = self.repository.get_analysis_for_day(user_id, run_on)
        if existing is not None:
            return existing

        run = FinanceAnalysisRun(user_id=user_id, run_on=run_on, status="running")
        self.db.add(run)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            existing = self.repository.get_analysis_for_day(user_id, run_on)
            if existing is not None:
                return existing
            raise
        self.db.refresh(run)

        market_data_provider = provider if provider is not None else get_market_data_provider()
        if market_data_provider is None:
            return self._finish_analysis_without_market_data(run, "unavailable", "market_data_provider_not_configured")

        profile = self.get_or_create_profile(user_id)
        positions = [position for position in self.repository.list_positions(user_id) if position.quantity > 0]
        candidates = self.repository.list_candidates(user_id)
        instrument_ids = {position.instrument_id for position in positions} | {candidate.instrument_id for candidate in candidates}
        instruments = {instrument.id: instrument for instrument in self.repository.list_instruments(instrument_ids)}
        required_instruments = [instrument for instrument in instruments.values() if instrument.is_active]
        try:
            quotes = market_data_provider.fetch_quotes(required_instruments)
        except MarketDataError:
            return self._finish_analysis_without_market_data(run, "unavailable", "market_data_provider_error")
        except Exception:
            return self._finish_analysis_without_market_data(run, "unavailable", "market_data_provider_error")

        required_quote_ids = [position.instrument_id for position in positions] + [candidate.instrument_id for candidate in candidates if candidate.alert_eligible and candidate.research_status == "ready"]
        fresh = quotes_are_fresh(quotes, required_quote_ids, now)
        currencies_match = all(quotes[instrument_id].currency == profile.base_currency for instrument_id in required_quote_ids if instrument_id in quotes)
        if not fresh or not currencies_match:
            reason = "market_data_stale_or_incomplete" if not fresh else "fx_rate_not_configured"
            return self._finish_analysis_without_market_data(run, "stale", reason)

        analysis_positions = [
            AnalysisPosition(
                id=position.id,
                account_id=position.account_id,
                instrument_id=position.instrument_id,
                asset_class=instruments[position.instrument_id].asset_class,
                currency=instruments[position.instrument_id].currency,
                quantity=position.quantity,
                market_value=position.quantity * quotes[position.instrument_id].price,
            )
            for position in positions
            if position.instrument_id in instruments and position.instrument_id in quotes
        ]
        analysis_candidates = [
            AnalysisCandidate(
                id=candidate.id,
                instrument_id=candidate.instrument_id,
                asset_class=instruments[candidate.instrument_id].asset_class,
                currency=instruments[candidate.instrument_id].currency,
                is_active=instruments[candidate.instrument_id].is_active,
                research_status=candidate.research_status,
                alert_eligible=candidate.alert_eligible,
                target_allocation_min=candidate.target_allocation_min,
                target_allocation_max=candidate.target_allocation_max,
                allocation_gap=candidate.allocation_gap,
            )
            for candidate in candidates
            if candidate.instrument_id in instruments and candidate.instrument_id in quotes
        ]
        rules = evaluate_portfolio(profile, analysis_positions, analysis_candidates, quotes, now)
        run.inputs = {
            "positionCount": len(analysis_positions),
            "candidateCount": len(analysis_candidates),
            "baseCurrency": profile.base_currency,
        }
        run.rule_results = {"dataStatus": {"state": "fresh", "reason": None}, "actions": [_serialize_rule(rule) for rule in rules]}
        run.source_timestamps = {instrument_id: _iso_string(quote.as_of) for instrument_id, quote in quotes.items()}
        run.data_fresh_at = min((quote.as_of for quote in quotes.values()), default=None)
        # AI may only summarize these persisted rule drafts after this transaction;
        # it never supplies or mutates the action set itself.
        run.explanation = None
        run.status = "completed"
        run.completed_at = datetime.now(UTC)
        self._persist_analysis_snapshots(user_id, run_on, positions, quotes)
        self._persist_rule_recommendations(user_id, run, rules)
        self.db.commit()
        self.db.refresh(run)
        return run

    async def enrich_analysis_explanation(self, user_id: str, analysis_id: str) -> FinanceAnalysisRun:
        """Use AI only to summarize already-persisted deterministic rule drafts."""
        run = self.repository.get_owned_analysis(user_id, analysis_id)
        if run is None:
            raise _not_found("Finance analysis run not found")
        if run.status != "completed" or run.explanation:
            return run
        fallback = _deterministic_summary_from_run(run)
        try:
            from app.providers.ai.registry import get_ai_provider

            response = await get_ai_provider().complete(
                [
                    {"role": "system", "content": "仅根据给定的理财规则草案写简短说明；不得新增、删除或改变任何动作。"},
                    {"role": "user", "content": str(run.rule_results)},
                ]
            )
            run.explanation = response.strip()[:1200] or fallback
        except Exception:
            run.explanation = fallback
        self.db.commit()
        self.db.refresh(run)
        return run

    def get_latest_analysis(self, user_id: str) -> FinanceAnalysisRun | None:
        return self.repository.get_latest_analysis(user_id)

    def list_recommendations(self, user_id: str) -> list[FinanceRecommendation]:
        return self.repository.list_pending_recommendations(user_id)

    def dismiss_recommendation(self, user_id: str, recommendation_id: str) -> FinanceRecommendation:
        recommendation = self.repository.get_owned_recommendation(user_id, recommendation_id)
        if recommendation is None:
            raise _not_found("Finance recommendation not found")
        recommendation.disposition = "dismissed"
        self.db.commit()
        self.db.refresh(recommendation)
        return recommendation

    def _finish_analysis_without_market_data(self, run: FinanceAnalysisRun, state: str, reason: str) -> FinanceAnalysisRun:
        run.status = f"data_{state}"
        run.inputs = {}
        run.rule_results = {"dataStatus": {"state": state, "reason": reason}, "actions": []}
        run.source_timestamps = {}
        run.data_fresh_at = None
        run.explanation = "行情数据未就绪，因此未生成任何买入、加仓、减仓或卖出条件卡。"
        run.completed_at = datetime.now(UTC)
        self.db.commit()
        self.db.refresh(run)
        return run

    def _persist_analysis_snapshots(
        self,
        user_id: str,
        snapshot_on,
        positions: list[FinancePosition],
        quotes: dict[str, MarketQuote],
    ) -> None:
        for position in positions:
            quote = quotes.get(position.instrument_id)
            if quote is None:
                continue
            self.db.add(
                FinanceSnapshot(
                    user_id=user_id,
                    account_id=position.account_id,
                    instrument_id=position.instrument_id,
                    snapshot_on=snapshot_on,
                    price=quote.price,
                    quantity=position.quantity,
                    market_value=position.quantity * quote.price,
                    data_fresh_at=quote.as_of,
                    evidence={"source": "market_data", "asOf": _iso_string(quote.as_of)},
                )
            )

    def _persist_rule_recommendations(
        self,
        user_id: str,
        run: FinanceAnalysisRun,
        rules: list[RuleRecommendation],
    ) -> None:
        for rule in rules:
            self.db.add(
                FinanceRecommendation(
                    user_id=user_id,
                    analysis_run_id=run.id,
                    candidate_id=rule.candidate_id,
                    instrument_id=rule.instrument_id,
                    action=rule.action,
                    title=rule.title,
                    suggested_allocation_min=rule.suggested_allocation_min,
                    suggested_allocation_max=rule.suggested_allocation_max,
                    explanation=_deterministic_rule_explanation(rule),
                    evidence=rule.evidence,
                    counterevidence=rule.counterevidence,
                    confidence=rule.confidence,
                    expires_at=datetime.now(UTC) + timedelta(days=7),
                    rule_triggers=rule.evidence,
                )
            )

    def build_dashboard(self, user_id: str) -> dict:
        profile = self.get_or_create_profile(user_id)
        positions = [position for position in self.repository.list_positions(user_id) if position.quantity != 0]
        instruments = {item.id: item for item in self.db.query(FinancialInstrument).filter(FinancialInstrument.id.in_([p.instrument_id for p in positions])).all()} if positions else {}
        accounts = {item.id: item for item in self.repository.list_accounts(user_id)}
        cost_basis_by_currency: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
        market_value_by_currency: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
        priced_count = 0
        serialized_positions: list[dict] = []
        for position in positions:
            instrument = instruments[position.instrument_id]
            account = accounts[position.account_id]
            cost_basis = position.quantity * position.average_cost
            cost_basis_by_currency[instrument.currency] += cost_basis
            if position.market_value is not None:
                market_value_by_currency[instrument.currency] += position.market_value
                priced_count += 1
            serialized_positions.append({
                "id": position.id,
                "accountId": position.account_id,
                "accountName": account.name,
                "instrumentId": position.instrument_id,
                "instrument": serialize_instrument(instrument),
                "quantity": decimal_string(position.quantity),
                "averageCost": decimal_string(position.average_cost),
                "costBasis": decimal_string(cost_basis),
                "marketPrice": decimal_string(position.market_price),
                "marketValue": decimal_string(position.market_value),
                "currency": instrument.currency,
                "targetAllocation": decimal_string(position.target_allocation),
                "valuedAt": iso_string(position.valued_at),
            })
        base_currency = profile.base_currency
        return {
            "profile": serialize_profile(profile),
            "summary": {
                "baseCurrency": base_currency,
                "positionCount": len(positions),
                "pricedPositionCount": priced_count,
                "costBasis": decimal_string(cost_basis_by_currency.get(base_currency)) if len(cost_basis_by_currency) <= 1 else None,
                "marketValue": decimal_string(market_value_by_currency.get(base_currency)) if positions and priced_count == len(positions) and len(market_value_by_currency) <= 1 else None,
                "costBasisByCurrency": {currency: decimal_string(value) for currency, value in cost_basis_by_currency.items()},
                "marketValueByCurrency": {currency: decimal_string(value) for currency, value in market_value_by_currency.items()},
            },
            "positions": serialized_positions,
            "dataStatus": "manual_only",
        }


def decimal_string(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value.normalize(), "f") if value != 0 else "0"


def iso_string(value) -> str | None:
    return value.isoformat() if value else None


def serialize_profile(profile: FinanceProfile) -> dict:
    return {
        "id": profile.id,
        "riskPreference": profile.risk_preference,
        "baseCurrency": profile.base_currency,
        "targetAllocation": profile.target_allocation,
        "reserveCashRatio": decimal_string(profile.reserve_cash_ratio),
        "maxInstrumentConcentration": decimal_string(profile.max_instrument_concentration),
        "maxPortfolioDrawdown": decimal_string(profile.max_portfolio_drawdown),
        "maxInstrumentDrawdown": decimal_string(profile.max_instrument_drawdown),
        "investmentHorizon": profile.investment_horizon,
        "alertSettings": profile.alert_settings,
    }


def serialize_account(account: FinanceAccount) -> dict:
    return {
        "id": account.id,
        "name": account.name,
        "market": account.market,
        "currency": account.currency,
        "accountType": account.account_type,
        "createdAt": iso_string(account.created_at),
        "updatedAt": iso_string(account.updated_at),
    }


def serialize_instrument(instrument: FinancialInstrument) -> dict:
    return {
        "id": instrument.id,
        "market": instrument.market,
        "symbol": instrument.symbol,
        "name": instrument.name,
        "assetClass": instrument.asset_class,
        "productType": instrument.product_type,
        "currency": instrument.currency,
        "identifier": instrument.identifier,
        "benchmark": instrument.benchmark,
    }


def serialize_transaction(transaction: FinanceTransaction) -> dict:
    return {
        "id": transaction.id,
        "accountId": transaction.account_id,
        "instrumentId": transaction.instrument_id,
        "transactionType": transaction.transaction_type,
        "quantity": decimal_string(transaction.quantity),
        "unitPrice": decimal_string(transaction.unit_price),
        "fee": decimal_string(transaction.fee),
        "clientReference": transaction.client_reference,
        "currency": transaction.currency,
        "occurredOn": transaction.occurred_on.isoformat(),
        "source": transaction.source,
        "notes": transaction.notes,
        "createdAt": iso_string(transaction.created_at),
    }


def serialize_candidate(candidate: FinanceCandidate) -> dict:
    return {
        "id": candidate.id,
        "instrumentId": candidate.instrument_id,
        "suitabilityReason": candidate.suitability_reason,
        "allocationGap": candidate.allocation_gap,
        "targetAllocationMin": decimal_string(candidate.target_allocation_min),
        "targetAllocationMax": decimal_string(candidate.target_allocation_max),
        "researchStatus": candidate.research_status,
        "alertEligible": candidate.alert_eligible,
        "createdAt": iso_string(candidate.created_at),
        "updatedAt": iso_string(candidate.updated_at),
    }


def _serialize_import_row_for_storage(row: FinanceImportRow) -> dict[str, Any]:
    return row.model_dump(mode="json", by_alias=True)


def _serialize_import_row(row: dict[str, Any]) -> dict[str, Any]:
    return FinanceImportRow.model_validate(row).model_dump(mode="json", by_alias=True)


def serialize_import(finance_import: FinanceImport) -> dict[str, Any]:
    rows = [
        _serialize_import_row(row)
        for row in finance_import.extracted_rows
        if isinstance(row, dict)
    ]
    needs_review = any(
        Decimal(str(row["confidence"])) < Decimal("0.60")
        or not row["accountId"]
        or not row["occurredOn"]
        for row in rows
    )
    return {
        "id": finance_import.id,
        "sourceFilename": (finance_import.source_metadata or {}).get("filename"),
        "status": finance_import.status,
        "rows": rows,
        "needsReview": needs_review,
        "temporaryObjectPath": finance_import.temporary_object_path,
        "errorCode": finance_import.error_code,
        "expiresAt": _iso_string(finance_import.expires_at),
        "processedAt": _iso_string(finance_import.processed_at),
        "createdAt": _iso_string(finance_import.created_at),
        "updatedAt": _iso_string(finance_import.updated_at),
    }


def _iso_string(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _serialize_rule(rule: RuleRecommendation) -> dict[str, Any]:
    return {
        "action": rule.action,
        "title": rule.title,
        "instrumentId": rule.instrument_id,
        "candidateId": rule.candidate_id,
        "suggestedAllocationMin": decimal_string(rule.suggested_allocation_min),
        "suggestedAllocationMax": decimal_string(rule.suggested_allocation_max),
        "evidence": rule.evidence,
        "counterevidence": rule.counterevidence,
        "confidence": rule.confidence,
    }


def _deterministic_rule_explanation(rule: RuleRecommendation) -> str:
    evidence = "；".join(item["message"] for item in rule.evidence)
    return f"规则条件：{evidence}" if evidence else "规则条件已满足，请结合自身计划复核。"


def _deterministic_summary(rules: list[RuleRecommendation]) -> str:
    if not rules:
        return "当前数据未触发需要展示的规则条件；不会执行任何自动交易。"
    return f"本次依据已确认的风险与配置规则生成 {len(rules)} 条待复核行动卡；系统不会自动下单。"


def _deterministic_summary_from_run(run: FinanceAnalysisRun) -> str:
    actions = run.rule_results.get("actions", []) if isinstance(run.rule_results, dict) else []
    if not actions:
        return "当前数据未触发需要展示的规则条件；不会执行任何自动交易。"
    return f"本次依据已确认的风险与配置规则生成 {len(actions)} 条待复核行动卡；系统不会自动下单。"


def serialize_analysis_run(run: FinanceAnalysisRun) -> dict:
    rule_results = run.rule_results if isinstance(run.rule_results, dict) else {}
    return {
        "id": run.id,
        "status": run.status,
        "runOn": run.run_on.isoformat(),
        "dataStatus": rule_results.get("dataStatus", {"state": "unavailable", "reason": "analysis_not_completed"}),
        "inputs": run.inputs,
        "actions": rule_results.get("actions", []),
        "explanation": run.explanation,
        "dataFreshAt": _iso_string(run.data_fresh_at),
        "completedAt": _iso_string(run.completed_at),
        "createdAt": _iso_string(run.created_at),
    }


def serialize_recommendation(recommendation: FinanceRecommendation) -> dict:
    return {
        "id": recommendation.id,
        "analysisRunId": recommendation.analysis_run_id,
        "candidateId": recommendation.candidate_id,
        "instrumentId": recommendation.instrument_id,
        "action": recommendation.action,
        "title": recommendation.title,
        "suggestedAllocationMin": decimal_string(recommendation.suggested_allocation_min),
        "suggestedAllocationMax": decimal_string(recommendation.suggested_allocation_max),
        "explanation": recommendation.explanation,
        "evidence": recommendation.evidence,
        "counterevidence": recommendation.counterevidence,
        "confidence": recommendation.confidence,
        "expiresAt": _iso_string(recommendation.expires_at),
        "disposition": recommendation.disposition,
        "createdAt": _iso_string(recommendation.created_at),
    }
