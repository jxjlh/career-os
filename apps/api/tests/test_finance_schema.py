from datetime import date
from decimal import Decimal
import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.db.models import FinanceAccount, FinanceProfile, FinanceTransaction, FinancialInstrument, Profile


def _create_profile() -> Profile:
    user_id = str(uuid.uuid4())
    return Profile(id=user_id, email=f"finance-{user_id}@career-os.local", display_name="Finance Tester")


def test_finance_profile_is_unique_per_user() -> None:
    db = SessionLocal()
    try:
        user = _create_profile()
        db.add(user)
        db.commit()

        db.add(FinanceProfile(user_id=user.id))
        db.commit()
        db.add(FinanceProfile(user_id=user.id))

        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.rollback()
        db.close()


def test_transaction_links_user_account_and_instrument() -> None:
    db = SessionLocal()
    try:
        user = _create_profile()
        account = FinanceAccount(user_id=user.id, name="基金账户", market="CN", currency="CNY")
        instrument = FinancialInstrument(
            market="CN",
            symbol=f"fund-{user.id}",
            name="示例基金",
            asset_class="fund",
            currency="CNY",
        )
        db.add_all([user, account, instrument])
        db.commit()

        transaction = FinanceTransaction(
            user_id=user.id,
            account_id=account.id,
            instrument_id=instrument.id,
            transaction_type="buy",
            quantity=Decimal("10"),
            unit_price=Decimal("1.2"),
            fee=Decimal("0"),
            currency="CNY",
            occurred_on=date(2026, 8, 17),
            source="manual",
        )
        db.add(transaction)
        db.commit()

        assert transaction.user_id == user.id
        assert transaction.account_id == account.id
        assert transaction.instrument_id == instrument.id
    finally:
        db.rollback()
        db.close()
