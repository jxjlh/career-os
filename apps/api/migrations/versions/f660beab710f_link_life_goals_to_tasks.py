"""link life goals to tasks

Revision ID: f660beab710f
Revises: f1ae33da647c
Create Date: 2026-07-31 19:06:30.064403

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f660beab710f'
down_revision: Union[str, None] = 'f1ae33da647c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('tasks') as batch_op:
        batch_op.add_column(sa.Column('life_goal_id', sa.String(length=36), nullable=True))
        batch_op.create_index('ix_tasks_life_goal_id', ['life_goal_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_tasks_life_goal_id_life_goals',
            'life_goals',
            ['life_goal_id'],
            ['id'],
            ondelete='CASCADE',
        )


def downgrade() -> None:
    with op.batch_alter_table('tasks') as batch_op:
        batch_op.drop_constraint('fk_tasks_life_goal_id_life_goals', type_='foreignkey')
        batch_op.drop_index('ix_tasks_life_goal_id')
        batch_op.drop_column('life_goal_id')
