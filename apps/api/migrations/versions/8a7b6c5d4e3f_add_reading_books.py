"""add reading books"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8a7b6c5d4e3f"
down_revision: Union[str, None] = "f3d4c5b6a798"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reading_books",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("author", sa.String(length=200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_url", sa.Text(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("isbn", sa.String(length=32), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="want"),
        sa.Column("current_page", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_pages", sa.Integer(), nullable=True),
        sa.Column("progress_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("daily_minutes", sa.Integer(), nullable=True),
        sa.Column("plan_note", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_complete", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ai_recommended", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "title", "author", name="uq_reading_books_user_title_author"),
    )
    op.create_index("ix_reading_books_user_id", "reading_books", ["user_id"])
    op.create_index("ix_reading_books_status", "reading_books", ["status"])


def downgrade() -> None:
    op.drop_index("ix_reading_books_status", table_name="reading_books")
    op.drop_index("ix_reading_books_user_id", table_name="reading_books")
    op.drop_table("reading_books")
