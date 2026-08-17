from hashlib import blake2b

from sqlalchemy import text
from sqlalchemy.orm import Query, Session

from app.db.models import (
    FinanceAccount,
    FinanceAnalysisRun,
    FinanceCandidate,
    FinancePosition,
    FinanceProfile,
    FinanceRecommendation,
    FinanceSnapshot,
    FinanceTransaction,
    FinancialInstrument,
)


class FinanceRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_profile(self, user_id: str) -> FinanceProfile | None:
        return self.db.query(FinanceProfile).filter(FinanceProfile.user_id == user_id).first()

    def list_accounts(self, user_id: str) -> list[FinanceAccount]:
        return (
            self.db.query(FinanceAccount)
            .filter(FinanceAccount.user_id == user_id)
            .order_by(FinanceAccount.created_at.desc())
            .all()
        )

    def get_owned_account(self, user_id: str, account_id: str) -> FinanceAccount | None:
        return (
            self.db.query(FinanceAccount)
            .filter(FinanceAccount.id == account_id, FinanceAccount.user_id == user_id)
            .first()
        )

    def list_transactions(self, user_id: str) -> list[FinanceTransaction]:
        return (
            self.db.query(FinanceTransaction)
            .filter(FinanceTransaction.user_id == user_id)
            .order_by(FinanceTransaction.occurred_on.desc(), FinanceTransaction.created_at.desc())
            .all()
        )

    def has_transactions_for_account(self, user_id: str, account_id: str) -> bool:
        return (
            self.db.query(FinanceTransaction.id)
            .filter(FinanceTransaction.user_id == user_id, FinanceTransaction.account_id == account_id)
            .first()
            is not None
        )

    def get_owned_transaction(self, user_id: str, transaction_id: str, *, for_update: bool = False) -> FinanceTransaction | None:
        query: Query[FinanceTransaction] = (
            self.db.query(FinanceTransaction)
            .filter(FinanceTransaction.id == transaction_id, FinanceTransaction.user_id == user_id)
        )
        if for_update:
            query = query.with_for_update()
        return query.first()

    def get_transaction_by_client_reference(self, user_id: str, client_reference: str) -> FinanceTransaction | None:
        return (
            self.db.query(FinanceTransaction)
            .filter(
                FinanceTransaction.user_id == user_id,
                FinanceTransaction.client_reference == client_reference,
            )
            .first()
        )

    def list_transactions_for_position(
        self,
        user_id: str,
        account_id: str,
        instrument_id: str,
        *,
        for_update: bool = False,
    ) -> list[FinanceTransaction]:
        query: Query[FinanceTransaction] = (
            self.db.query(FinanceTransaction)
            .filter(
                FinanceTransaction.user_id == user_id,
                FinanceTransaction.account_id == account_id,
                FinanceTransaction.instrument_id == instrument_id,
            )
            .order_by(FinanceTransaction.occurred_on.asc(), FinanceTransaction.created_at.asc(), FinanceTransaction.id.asc())
        )
        if for_update:
            query = query.with_for_update()
        return query.all()

    def get_instrument(self, instrument_id: str) -> FinancialInstrument | None:
        return self.db.query(FinancialInstrument).filter(FinancialInstrument.id == instrument_id).first()

    def list_instruments(self, instrument_ids: set[str]) -> list[FinancialInstrument]:
        if not instrument_ids:
            return []
        return self.db.query(FinancialInstrument).filter(FinancialInstrument.id.in_(instrument_ids)).all()

    def get_instrument_by_market_symbol(self, market: str, symbol: str) -> FinancialInstrument | None:
        return (
            self.db.query(FinancialInstrument)
            .filter(FinancialInstrument.market == market, FinancialInstrument.symbol == symbol)
            .first()
        )

    def search_instruments(self, query: str, limit: int) -> list[FinancialInstrument]:
        pattern = f"%{query.strip()}%"
        return (
            self.db.query(FinancialInstrument)
            .filter(FinancialInstrument.is_active.is_(True))
            .filter(FinancialInstrument.symbol.ilike(pattern) | FinancialInstrument.name.ilike(pattern))
            .order_by(FinancialInstrument.name.asc())
            .limit(limit)
            .all()
        )

    def get_owned_candidate(self, user_id: str, candidate_id: str) -> FinanceCandidate | None:
        return (
            self.db.query(FinanceCandidate)
            .filter(FinanceCandidate.id == candidate_id, FinanceCandidate.user_id == user_id)
            .first()
        )

    def list_candidates(self, user_id: str) -> list[FinanceCandidate]:
        return (
            self.db.query(FinanceCandidate)
            .filter(FinanceCandidate.user_id == user_id)
            .order_by(FinanceCandidate.created_at.desc())
            .all()
        )

    def get_owned_position(
        self,
        user_id: str,
        account_id: str,
        instrument_id: str,
        *,
        for_update: bool = False,
    ) -> FinancePosition | None:
        query: Query[FinancePosition] = (
            self.db.query(FinancePosition)
            .filter(
                FinancePosition.user_id == user_id,
                FinancePosition.account_id == account_id,
                FinancePosition.instrument_id == instrument_id,
            )
        )
        if for_update:
            query = query.with_for_update()
        return query.first()

    def lock_position_key(self, user_id: str, account_id: str, instrument_id: str) -> None:
        """Serialize one materialized position key for the current transaction.

        PostgreSQL advisory locks cover the no-position-yet case. SQLite ignores
        ``FOR UPDATE`` but keeps the same code path usable in unit tests.
        """
        if self.db.bind is not None and self.db.bind.dialect.name == "postgresql":
            lock_source = f"{user_id}:{account_id}:{instrument_id}".encode()
            lock_key = int.from_bytes(blake2b(lock_source, digest_size=8).digest(), byteorder="big", signed=True)
            self.db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": lock_key})
        else:
            self.get_owned_position(user_id, account_id, instrument_id, for_update=True)

    def list_positions(self, user_id: str) -> list[FinancePosition]:
        return (
            self.db.query(FinancePosition)
            .join(FinanceAccount, FinanceAccount.id == FinancePosition.account_id)
            .filter(FinancePosition.user_id == user_id, FinanceAccount.user_id == user_id)
            .order_by(FinancePosition.created_at.desc())
            .all()
        )

    def get_analysis_for_day(self, user_id: str, run_on) -> FinanceAnalysisRun | None:
        return (
            self.db.query(FinanceAnalysisRun)
            .filter(FinanceAnalysisRun.user_id == user_id, FinanceAnalysisRun.run_on == run_on)
            .first()
        )

    def get_latest_analysis(self, user_id: str) -> FinanceAnalysisRun | None:
        return (
            self.db.query(FinanceAnalysisRun)
            .filter(FinanceAnalysisRun.user_id == user_id)
            .order_by(FinanceAnalysisRun.run_on.desc(), FinanceAnalysisRun.created_at.desc())
            .first()
        )

    def get_owned_analysis(self, user_id: str, analysis_id: str) -> FinanceAnalysisRun | None:
        return (
            self.db.query(FinanceAnalysisRun)
            .filter(FinanceAnalysisRun.user_id == user_id, FinanceAnalysisRun.id == analysis_id)
            .first()
        )

    def list_pending_recommendations(self, user_id: str) -> list[FinanceRecommendation]:
        return (
            self.db.query(FinanceRecommendation)
            .filter(FinanceRecommendation.user_id == user_id, FinanceRecommendation.disposition == "pending")
            .order_by(FinanceRecommendation.created_at.desc())
            .all()
        )

    def get_owned_recommendation(self, user_id: str, recommendation_id: str) -> FinanceRecommendation | None:
        return (
            self.db.query(FinanceRecommendation)
            .filter(FinanceRecommendation.user_id == user_id, FinanceRecommendation.id == recommendation_id)
            .first()
        )

    def list_snapshots_for_analysis_day(self, user_id: str, snapshot_on) -> list[FinanceSnapshot]:
        return (
            self.db.query(FinanceSnapshot)
            .filter(FinanceSnapshot.user_id == user_id, FinanceSnapshot.snapshot_on == snapshot_on)
            .all()
        )
