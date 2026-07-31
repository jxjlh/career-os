"""add bucket tables

Revision ID: a1b2c3d4e5f6
Revises: 9e1c2a3b4c5d
Create Date: 2026-07-31 23:40:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "9e1c2a3b4c5d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bucket_categories",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("icon", sa.String(length=32), nullable=True),
        sa.Column("color", sa.String(length=32), nullable=True),
        sa.Column("cover_image", sa.Text(), nullable=True),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_bucket_categories_name"),
    )
    op.create_index(op.f("ix_bucket_categories_name"), "bucket_categories", ["name"], unique=True)

    op.create_table(
        "bucket_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("subtitle", sa.String(length=200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("story", sa.Text(), nullable=True),
        sa.Column("cover_image", sa.Text(), nullable=True),
        sa.Column("gallery_images", sa.JSON(), nullable=False),
        sa.Column("video_url", sa.Text(), nullable=True),
        sa.Column("difficulty", sa.SmallInteger(), nullable=False),
        sa.Column("estimated_cost", sa.String(length=80), nullable=True),
        sa.Column("estimated_days", sa.Integer(), nullable=True),
        sa.Column("best_season", sa.String(length=120), nullable=True),
        sa.Column("country", sa.String(length=80), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("address", sa.String(length=300), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("tips", sa.Text(), nullable=True),
        sa.Column("ai_prompt", sa.Text(), nullable=True),
        sa.Column("popularity", sa.Integer(), nullable=False),
        sa.Column("completed_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["bucket_categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_bucket_items_category_id"), "bucket_items", ["category_id"], unique=False)
    op.create_index(op.f("ix_bucket_items_status"), "bucket_items", ["status"], unique=False)
    op.create_index(op.f("ix_bucket_items_country"), "bucket_items", ["country"], unique=False)
    op.create_index(op.f("ix_bucket_items_city"), "bucket_items", ["city"], unique=False)

    op.create_table(
        "user_bucket_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("bucket_item_id", sa.String(length=36), nullable=False),
        sa.Column("life_goal_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("wishlist", sa.Boolean(), nullable=False),
        sa.Column("favorite", sa.Boolean(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["bucket_item_id"], ["bucket_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["life_goal_id"], ["life_goals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "bucket_item_id", name="uq_user_bucket_item"),
    )
    op.create_index(op.f("ix_user_bucket_items_user_id"), "user_bucket_items", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_bucket_items_bucket_item_id"), "user_bucket_items", ["bucket_item_id"], unique=False)
    op.create_index(op.f("ix_user_bucket_items_life_goal_id"), "user_bucket_items", ["life_goal_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_bucket_items_life_goal_id"), table_name="user_bucket_items")
    op.drop_index(op.f("ix_user_bucket_items_bucket_item_id"), table_name="user_bucket_items")
    op.drop_index(op.f("ix_user_bucket_items_user_id"), table_name="user_bucket_items")
    op.drop_table("user_bucket_items")
    op.drop_index(op.f("ix_bucket_items_city"), table_name="bucket_items")
    op.drop_index(op.f("ix_bucket_items_country"), table_name="bucket_items")
    op.drop_index(op.f("ix_bucket_items_status"), table_name="bucket_items")
    op.drop_index(op.f("ix_bucket_items_category_id"), table_name="bucket_items")
    op.drop_table("bucket_items")
    op.drop_index(op.f("ix_bucket_categories_name"), table_name="bucket_categories")
    op.drop_table("bucket_categories")
