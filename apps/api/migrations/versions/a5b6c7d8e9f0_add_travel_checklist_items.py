"""add travel checklist items

Revision ID: a5b6c7d8e9f0
Revises: f2a4b6c8d0e1
Create Date: 2026-08-02

旅行攻略物品清单:
- travel_checklist_items: 用户可增删改查的物品清单, 支持备注与勾选.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a5b6c7d8e9f0"
down_revision: str | None = "f2a4b6c8d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "travel_checklist_items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("profiles.id", ondelete="CASCADE"), index=True),
        sa.Column("ai_content_id", sa.String(length=36), sa.ForeignKey("ai_content.id", ondelete="CASCADE"), index=True),
        sa.Column("item", sa.String(length=200), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("checked", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("travel_checklist_items")
