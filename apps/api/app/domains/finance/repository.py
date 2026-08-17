from sqlalchemy.orm import Session

from app.db.models import (
    FinanceAccount,
    FinanceCandidate,
    FinancePosition,
    FinanceProfile,
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

    def get_owned_transaction(self, user_id: str, transaction_id: str) -> FinanceTransaction | None:
        return (
            self.db.query(FinanceTransaction)
            .filter(FinanceTransaction.id == transaction_id, FinanceTransaction.user_id == user_id)
            .first()
        )

    def get_instrument(self, instrument_id: str) -> FinancialInstrument | None:
        return self.db.query(FinancialInstrument).filter(FinancialInstrument.id == instrument_id).first()

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

    def get_owned_position(self, user_id: str, account_id: str, instrument_id: str) -> FinancePosition | None:
        return (
            self.db.query(FinancePosition)
            .filter(
                FinancePosition.user_id == user_id,
                FinancePosition.account_id == account_id,
                FinancePosition.instrument_id == instrument_id,
            )
            .first()
        )

    def list_positions(self, user_id: str) -> list[FinancePosition]:
        return (
            self.db.query(FinancePosition)
            .join(FinanceAccount, FinanceAccount.id == FinancePosition.account_id)
            .filter(FinancePosition.user_id == user_id, FinanceAccount.user_id == user_id)
            .order_by(FinancePosition.created_at.desc())
            .all()
        )
