"""add reading book file columns

Revision ID: 20260918_add_reading_file_columns
Revises: 20260917_add_finance_rec_details
Create Date: 2026-09-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260918_add_reading_file_columns"
down_revision: Union[str, None] = "20260917_add_finance_rec_details"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reading_books", sa.Column("file_path", sa.Text(), nullable=True))
    op.add_column("reading_books", sa.Column("file_format", sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column("reading_books", "file_format")
    op.drop_column("reading_books", "file_path")
