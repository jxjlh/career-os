"""add finance analysis idempotency constraints

Revision ID: 20260817_finance_analysis
Revises: 20260817_finance_ledger
Create Date: 2026-08-17 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260817_finance_analysis"
down_revision: str | None = "20260817_finance_ledger"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("finance_analysis_runs") as batch:
        batch.create_unique_constraint("uq_finance_analysis_run_user_day", ["user_id", "run_on"])
    with op.batch_alter_table("finance_snapshots") as batch:
        batch.create_unique_constraint(
            "uq_finance_snapshot_daily_position",
            ["user_id", "snapshot_on", "account_id", "instrument_id"],
        )
    with op.batch_alter_table("finance_recommendations") as batch:
        batch.create_unique_constraint(
            "uq_finance_recommendation_rule_draft",
            ["analysis_run_id", "instrument_id", "action"],
        )


def downgrade() -> None:
    with op.batch_alter_table("finance_recommendations") as batch:
        batch.drop_constraint("uq_finance_recommendation_rule_draft", type_="unique")
    with op.batch_alter_table("finance_snapshots") as batch:
        batch.drop_constraint("uq_finance_snapshot_daily_position", type_="unique")
    with op.batch_alter_table("finance_analysis_runs") as batch:
        batch.drop_constraint("uq_finance_analysis_run_user_day", type_="unique")
