"""add finance transaction idempotency key

Revision ID: 20260817_finance_ledger
Revises: 20260817_finance
Create Date: 2026-08-17 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260817_finance_ledger"
down_revision: str | None = "20260817_finance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("finance_transactions", sa.Column("client_reference", sa.String(length=128), nullable=True))
    op.execute("UPDATE finance_transactions SET client_reference = 'legacy-' || id WHERE client_reference IS NULL")
    with op.batch_alter_table("finance_transactions") as batch_op:
        batch_op.alter_column("client_reference", existing_type=sa.String(length=128), nullable=False)
        batch_op.create_unique_constraint(
            "uq_finance_transaction_user_client_reference",
            ["user_id", "client_reference"],
        )


def downgrade() -> None:
    with op.batch_alter_table("finance_transactions") as batch_op:
        batch_op.drop_constraint("uq_finance_transaction_user_client_reference", type_="unique")
        batch_op.drop_column("client_reference")
