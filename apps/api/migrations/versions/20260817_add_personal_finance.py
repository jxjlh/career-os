"""add personal finance schema

Revision ID: 20260817_finance
Revises: 4b6c8d9e0f1a
Create Date: 2026-08-17 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260817_finance"
down_revision: Union[str, None] = "4b6c8d9e0f1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "finance_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("risk_preference", sa.String(length=16), nullable=False),
        sa.Column("base_currency", sa.String(length=3), nullable=False),
        sa.Column("target_allocation", sa.JSON(), nullable=False),
        sa.Column("reserve_cash_ratio", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column("max_instrument_concentration", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column("max_portfolio_drawdown", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column("max_instrument_drawdown", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column("investment_horizon", sa.String(length=24), nullable=False),
        sa.Column("alert_settings", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_finance_profile_user"),
    )
    op.create_index("ix_finance_profiles_user_id", "finance_profiles", ["user_id"])

    op.create_table(
        "financial_instruments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("market", sa.String(length=16), nullable=False),
        sa.Column("symbol", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("asset_class", sa.String(length=32), nullable=False),
        sa.Column("product_type", sa.String(length=48), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("identifier", sa.String(length=96), nullable=True),
        sa.Column("benchmark", sa.String(length=200), nullable=True),
        sa.Column("provider_mapping", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("market", "symbol", name="uq_finance_instrument_market_symbol"),
    )
    op.create_index("ix_financial_instruments_market", "financial_instruments", ["market"])
    op.create_index("ix_financial_instruments_symbol", "financial_instruments", ["symbol"])
    op.create_index("ix_financial_instruments_asset_class", "financial_instruments", ["asset_class"])
    op.create_index("ix_financial_instruments_identifier", "financial_instruments", ["identifier"])

    op.create_table(
        "finance_accounts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("market", sa.String(length=16), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("account_type", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_finance_account_user_name"),
    )
    op.create_index("ix_finance_accounts_user_id", "finance_accounts", ["user_id"])
    op.create_index("ix_finance_accounts_market", "finance_accounts", ["market"])

    op.create_table(
        "finance_analysis_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("run_on", sa.Date(), nullable=False),
        sa.Column("inputs", sa.JSON(), nullable=False),
        sa.Column("rule_results", sa.JSON(), nullable=False),
        sa.Column("source_timestamps", sa.JSON(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("data_fresh_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_finance_analysis_runs_user_id", "finance_analysis_runs", ["user_id"])
    op.create_index("ix_finance_analysis_runs_status", "finance_analysis_runs", ["status"])
    op.create_index("ix_finance_analysis_runs_run_on", "finance_analysis_runs", ["run_on"])

    op.create_table(
        "finance_imports",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("temporary_object_path", sa.Text(), nullable=True),
        sa.Column("raw_ocr_text", sa.Text(), nullable=True),
        sa.Column("extracted_rows", sa.JSON(), nullable=False),
        sa.Column("source_metadata", sa.JSON(), nullable=False),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_finance_imports_user_id", "finance_imports", ["user_id"])
    op.create_index("ix_finance_imports_status", "finance_imports", ["status"])
    op.create_index("ix_finance_imports_expires_at", "finance_imports", ["expires_at"])

    op.create_table(
        "finance_transactions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("instrument_id", sa.String(length=36), nullable=False),
        sa.Column("transaction_type", sa.String(length=24), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("fee", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=24), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["finance_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["instrument_id"], ["financial_instruments.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_finance_transactions_user_id", "finance_transactions", ["user_id"])
    op.create_index("ix_finance_transactions_account_id", "finance_transactions", ["account_id"])
    op.create_index("ix_finance_transactions_instrument_id", "finance_transactions", ["instrument_id"])
    op.create_index("ix_finance_transactions_transaction_type", "finance_transactions", ["transaction_type"])
    op.create_index("ix_finance_transactions_occurred_on", "finance_transactions", ["occurred_on"])
    op.create_index("ix_finance_transactions_source", "finance_transactions", ["source"])

    op.create_table(
        "finance_positions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("instrument_id", sa.String(length=36), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("average_cost", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("market_price", sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column("market_value", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("unrealized_profit_loss", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("target_allocation", sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column("valued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["finance_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["instrument_id"], ["financial_instruments.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "account_id", "instrument_id", name="uq_finance_position_account_instrument"),
    )
    op.create_index("ix_finance_positions_user_id", "finance_positions", ["user_id"])
    op.create_index("ix_finance_positions_account_id", "finance_positions", ["account_id"])
    op.create_index("ix_finance_positions_instrument_id", "finance_positions", ["instrument_id"])
    op.create_index("ix_finance_positions_valued_at", "finance_positions", ["valued_at"])

    op.create_table(
        "finance_candidates",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("instrument_id", sa.String(length=36), nullable=False),
        sa.Column("suitability_reason", sa.Text(), nullable=True),
        sa.Column("allocation_gap", sa.JSON(), nullable=False),
        sa.Column("target_allocation_min", sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column("target_allocation_max", sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column("research_status", sa.String(length=24), nullable=False),
        sa.Column("alert_eligible", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["instrument_id"], ["financial_instruments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "instrument_id", name="uq_finance_candidate_user_instrument"),
    )
    op.create_index("ix_finance_candidates_user_id", "finance_candidates", ["user_id"])
    op.create_index("ix_finance_candidates_instrument_id", "finance_candidates", ["instrument_id"])
    op.create_index("ix_finance_candidates_research_status", "finance_candidates", ["research_status"])

    op.create_table(
        "finance_snapshots",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=True),
        sa.Column("instrument_id", sa.String(length=36), nullable=True),
        sa.Column("snapshot_on", sa.Date(), nullable=False),
        sa.Column("price", sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column("fx_rate", sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column("market_value", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("portfolio_value", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("allocation", sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column("return_value", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("drawdown", sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column("concentration", sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column("data_fresh_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["finance_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["instrument_id"], ["financial_instruments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_finance_snapshots_user_id", "finance_snapshots", ["user_id"])
    op.create_index("ix_finance_snapshots_account_id", "finance_snapshots", ["account_id"])
    op.create_index("ix_finance_snapshots_instrument_id", "finance_snapshots", ["instrument_id"])
    op.create_index("ix_finance_snapshots_snapshot_on", "finance_snapshots", ["snapshot_on"])

    op.create_table(
        "finance_recommendations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("analysis_run_id", sa.String(length=36), nullable=False),
        sa.Column("candidate_id", sa.String(length=36), nullable=True),
        sa.Column("instrument_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=24), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("suggested_allocation_min", sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column("suggested_allocation_max", sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("counterevidence", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.String(length=16), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("disposition", sa.String(length=24), nullable=False),
        sa.Column("rule_triggers", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["analysis_run_id"], ["finance_analysis_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["candidate_id"], ["finance_candidates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["instrument_id"], ["financial_instruments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_finance_recommendations_user_id", "finance_recommendations", ["user_id"])
    op.create_index("ix_finance_recommendations_analysis_run_id", "finance_recommendations", ["analysis_run_id"])
    op.create_index("ix_finance_recommendations_candidate_id", "finance_recommendations", ["candidate_id"])
    op.create_index("ix_finance_recommendations_instrument_id", "finance_recommendations", ["instrument_id"])
    op.create_index("ix_finance_recommendations_action", "finance_recommendations", ["action"])
    op.create_index("ix_finance_recommendations_expires_at", "finance_recommendations", ["expires_at"])
    op.create_index("ix_finance_recommendations_disposition", "finance_recommendations", ["disposition"])


def downgrade() -> None:
    for index_name in (
        "ix_finance_recommendations_disposition",
        "ix_finance_recommendations_expires_at",
        "ix_finance_recommendations_action",
        "ix_finance_recommendations_instrument_id",
        "ix_finance_recommendations_candidate_id",
        "ix_finance_recommendations_analysis_run_id",
        "ix_finance_recommendations_user_id",
    ):
        op.drop_index(index_name, table_name="finance_recommendations")
    op.drop_table("finance_recommendations")

    for index_name in (
        "ix_finance_snapshots_snapshot_on",
        "ix_finance_snapshots_instrument_id",
        "ix_finance_snapshots_account_id",
        "ix_finance_snapshots_user_id",
    ):
        op.drop_index(index_name, table_name="finance_snapshots")
    op.drop_table("finance_snapshots")

    for index_name in (
        "ix_finance_candidates_research_status",
        "ix_finance_candidates_instrument_id",
        "ix_finance_candidates_user_id",
    ):
        op.drop_index(index_name, table_name="finance_candidates")
    op.drop_table("finance_candidates")

    for index_name in (
        "ix_finance_positions_valued_at",
        "ix_finance_positions_instrument_id",
        "ix_finance_positions_account_id",
        "ix_finance_positions_user_id",
    ):
        op.drop_index(index_name, table_name="finance_positions")
    op.drop_table("finance_positions")

    for index_name in (
        "ix_finance_transactions_source",
        "ix_finance_transactions_occurred_on",
        "ix_finance_transactions_transaction_type",
        "ix_finance_transactions_instrument_id",
        "ix_finance_transactions_account_id",
        "ix_finance_transactions_user_id",
    ):
        op.drop_index(index_name, table_name="finance_transactions")
    op.drop_table("finance_transactions")

    for index_name in (
        "ix_finance_imports_expires_at",
        "ix_finance_imports_status",
        "ix_finance_imports_user_id",
    ):
        op.drop_index(index_name, table_name="finance_imports")
    op.drop_table("finance_imports")

    for index_name in (
        "ix_finance_analysis_runs_run_on",
        "ix_finance_analysis_runs_status",
        "ix_finance_analysis_runs_user_id",
    ):
        op.drop_index(index_name, table_name="finance_analysis_runs")
    op.drop_table("finance_analysis_runs")

    for index_name in ("ix_finance_accounts_market", "ix_finance_accounts_user_id"):
        op.drop_index(index_name, table_name="finance_accounts")
    op.drop_table("finance_accounts")

    for index_name in (
        "ix_financial_instruments_identifier",
        "ix_financial_instruments_asset_class",
        "ix_financial_instruments_symbol",
        "ix_financial_instruments_market",
    ):
        op.drop_index(index_name, table_name="financial_instruments")
    op.drop_table("financial_instruments")

    op.drop_index("ix_finance_profiles_user_id", table_name="finance_profiles")
    op.drop_table("finance_profiles")
