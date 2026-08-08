"""add user skill learning status

Revision ID: 4b6c8d9e0f1a
Revises: 8a7b6c5d4e3f
Create Date: 2026-08-08 21:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4b6c8d9e0f1a"
down_revision: Union[str, None] = "8a7b6c5d4e3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_skills",
        sa.Column("learning_status", sa.String(length=16), nullable=False, server_default="learning"),
    )
    op.execute(
        "UPDATE user_skills SET learning_status = "
        "CASE WHEN target_level >= current_level THEN 'mastered' ELSE 'learning' END"
    )


def downgrade() -> None:
    op.drop_column("user_skills", "learning_status")
