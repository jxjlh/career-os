from collections import defaultdict
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    FinanceAccount,
    FinanceCandidate,
    FinancePosition,
    FinanceProfile,
    FinanceTransaction,
    FinancialInstrument,
)
from app.domains.finance.repository import FinanceRepository
from app.domains.finance.schemas import (
    FinanceAccountCreate,
    FinanceAccountPatch,
    FinanceCandidateCreate,
    FinanceCandidatePatch,
    FinanceProfilePatch,
    FinanceTransactionCreate,
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

    def apply_transaction(self, user_id: str, payload: FinanceTransactionCreate) -> FinanceTransaction:
        account = self.require_account(user_id, payload.account_id)
        instrument = self.resolve_instrument(payload)
        currency = payload.currency or instrument.currency
        if account.currency != currency or instrument.currency != currency:
            self.db.rollback()
            raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": "transaction currency must match account and instrument"})

        position = self.repository.get_owned_position(user_id, account.id, instrument.id)
        if payload.transaction_type == "sell" and (position is None or position.quantity < payload.quantity):
            self.db.rollback()
            raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": "sell quantity exceeds current position"})

        transaction = FinanceTransaction(
            user_id=user_id,
            account_id=account.id,
            instrument_id=instrument.id,
            transaction_type=payload.transaction_type,
            quantity=payload.quantity,
            unit_price=payload.unit_price,
            fee=payload.fee,
            currency=currency,
            occurred_on=payload.occurred_on,
            source="manual",
            notes=payload.notes,
        )
        self.db.add(transaction)

        if payload.transaction_type in {"buy", "sell"}:
            if position is None:
                position = FinancePosition(
                    user_id=user_id,
                    account_id=account.id,
                    instrument_id=instrument.id,
                    quantity=Decimal("0"),
                    average_cost=Decimal("0"),
                )
                self.db.add(position)
            if payload.transaction_type == "buy":
                prior_cost = position.quantity * position.average_cost
                new_quantity = position.quantity + payload.quantity
                position.average_cost = (prior_cost + payload.quantity * payload.unit_price + payload.fee) / new_quantity
                position.quantity = new_quantity
            else:
                position.quantity -= payload.quantity
                if position.quantity == 0:
                    position.average_cost = Decimal("0")

        self.db.commit()
        self.db.refresh(transaction)
        return transaction

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

    def build_dashboard(self, user_id: str) -> dict:
        profile = self.get_or_create_profile(user_id)
        positions = self.repository.list_positions(user_id)
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
