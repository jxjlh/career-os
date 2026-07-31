"""make tasks goal id nullable

Revision ID: 9e1c2a3b4c5d
Revises: f6d6e4edafc1
Create Date: 2026-07-31
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9e1c2a3b4c5d"
down_revision: Union[str, None] = "f6d6e4edafc1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.alter_column("goal_id", existing_type=sa.String(length=36), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.alter_column("goal_id", existing_type=sa.String(length=36), nullable=False)
