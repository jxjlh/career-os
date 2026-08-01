"""add life goal travel/skill planning metadata and life motto

Revision ID: f2a4b6c8d0e1
Revises: e9f0a1b2c3d4
Create Date: 2026-08-02

人生目标增强:
- life_goals: budget / recommended_days / best_season / region / friends / ai_plan_meta
- user_profiles: life_motto
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f2a4b6c8d0e1"
down_revision: Union[str, None] = "e9f0a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("life_goals", sa.Column("budget", sa.String(length=120), nullable=True))
    op.add_column("life_goals", sa.Column("recommended_days", sa.Integer(), nullable=True))
    op.add_column("life_goals", sa.Column("best_season", sa.String(length=80), nullable=True))
    op.add_column("life_goals", sa.Column("region", sa.String(length=120), nullable=True))
    op.add_column("life_goals", sa.Column("friends", sa.JSON(), nullable=True))
    op.add_column("life_goals", sa.Column("ai_plan_meta", sa.JSON(), nullable=True))
    op.add_column("user_profiles", sa.Column("life_motto", sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column("user_profiles", "life_motto")
    op.drop_column("life_goals", "ai_plan_meta")
    op.drop_column("life_goals", "friends")
    op.drop_column("life_goals", "region")
    op.drop_column("life_goals", "best_season")
    op.drop_column("life_goals", "recommended_days")
    op.drop_column("life_goals", "budget")
