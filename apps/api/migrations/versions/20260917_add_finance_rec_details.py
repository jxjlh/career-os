"""add finance_recommendation decision detail columns

Revision ID: 20260917_add_finance_rec_details
Revises: 20260817_finance_analysis
Create Date: 2026-09-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260917_add_finance_rec_details"
down_revision: Union[str, None] = "20260817_finance_analysis"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("finance_recommendations") as batch_op:
        batch_op.add_column(sa.Column("suggested_amount_min", sa.Numeric(16, 4), nullable=True))
        batch_op.add_column(sa.Column("suggested_amount_max", sa.Numeric(16, 4), nullable=True))
        batch_op.add_column(sa.Column("position_change_pct", sa.Numeric(8, 6), nullable=True))
        batch_op.add_column(sa.Column("trigger_reason", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("risk_note", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("source_data", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("finance_recommendations") as batch_op:
        batch_op.drop_column("source_data")
        batch_op.drop_column("risk_note")
        batch_op.drop_column("trigger_reason")
        batch_op.drop_column("position_change_pct")
        batch_op.drop_column("suggested_amount_max")
        batch_op.drop_column("suggested_amount_min")
