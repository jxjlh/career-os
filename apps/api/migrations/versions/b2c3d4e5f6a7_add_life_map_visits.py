"""add life_map_visits

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-01 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "life_map_visits",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("life_goal_id", sa.String(length=36), nullable=True),
        sa.Column("life_record_id", sa.String(length=36), nullable=True),
        sa.Column("bucket_item_id", sa.String(length=36), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("country", sa.String(length=80), nullable=True),
        sa.Column("province", sa.String(length=120), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("district", sa.String(length=120), nullable=True),
        sa.Column("address", sa.String(length=300), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("visit_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("photos_count", sa.Integer(), nullable=False),
        sa.Column("videos_count", sa.Integer(), nullable=False),
        sa.Column("weather", sa.String(length=120), nullable=True),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("cover_image", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["bucket_item_id"], ["bucket_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["life_goal_id"], ["life_goals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["life_record_id"], ["life_records.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_life_map_visits_user_id"), "life_map_visits", ["user_id"], unique=False)
    op.create_index(op.f("ix_life_map_visits_life_goal_id"), "life_map_visits", ["life_goal_id"], unique=False)
    op.create_index(op.f("ix_life_map_visits_life_record_id"), "life_map_visits", ["life_record_id"], unique=False)
    op.create_index(op.f("ix_life_map_visits_bucket_item_id"), "life_map_visits", ["bucket_item_id"], unique=False)
    op.create_index(op.f("ix_life_map_visits_country"), "life_map_visits", ["country"], unique=False)
    op.create_index(op.f("ix_life_map_visits_city"), "life_map_visits", ["city"], unique=False)
    op.create_index(op.f("ix_life_map_visits_visit_time"), "life_map_visits", ["visit_time"], unique=False)
    op.create_index(op.f("ix_life_map_visits_category"), "life_map_visits", ["category"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_life_map_visits_category"), table_name="life_map_visits")
    op.drop_index(op.f("ix_life_map_visits_visit_time"), table_name="life_map_visits")
    op.drop_index(op.f("ix_life_map_visits_city"), table_name="life_map_visits")
    op.drop_index(op.f("ix_life_map_visits_country"), table_name="life_map_visits")
    op.drop_index(op.f("ix_life_map_visits_bucket_item_id"), table_name="life_map_visits")
    op.drop_index(op.f("ix_life_map_visits_life_record_id"), table_name="life_map_visits")
    op.drop_index(op.f("ix_life_map_visits_life_goal_id"), table_name="life_map_visits")
    op.drop_index(op.f("ix_life_map_visits_user_id"), table_name="life_map_visits")
    op.drop_table("life_map_visits")
