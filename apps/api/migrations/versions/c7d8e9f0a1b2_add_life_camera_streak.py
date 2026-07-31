"""add life camera (video fields on life_records) + checkin streaks

Revision ID: c7d8e9f0a1b2
Revises: b2c3d4e5f6a7
Create Date: 2026-08-01 00:00:00.000000

Sprint 7 — Life Camera:
- 扩展 life_records: 视频日志 (video_url/thumbnail_url/duration_seconds)
  + AI 场景识别 (scene_type/ai_tags/ai_description) + temperature + 关联 bucket.
- 新增 checkin_streaks: 连续打卡 (current/longest/last_date/total).
"""

import sqlalchemy as sa
from alembic import op

revision = "c7d8e9f0a1b2"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── life_records: 视频日志 + AI 场景 + 关联 bucket ──
    op.add_column("life_records", sa.Column("video_url", sa.Text(), nullable=True))
    op.add_column("life_records", sa.Column("thumbnail_url", sa.Text(), nullable=True))
    op.add_column("life_records", sa.Column("duration_seconds", sa.Integer(), nullable=True))
    op.add_column("life_records", sa.Column("scene_type", sa.String(length=40), nullable=True))
    op.add_column("life_records", sa.Column("ai_tags", sa.JSON(), nullable=True))
    op.add_column("life_records", sa.Column("ai_description", sa.Text(), nullable=True))
    op.add_column("life_records", sa.Column("temperature", sa.Float(), nullable=True))
    op.add_column(
        "life_records",
        sa.Column(
            "bucket_item_id",
            sa.String(length=36),
            sa.ForeignKey("bucket_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_life_records_bucket_item_id", "life_records", ["bucket_item_id"])

    # ── checkin_streaks: 连续打卡 ──
    op.create_table(
        "checkin_streaks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_checkin_date", sa.Date(), nullable=True),
        sa.Column("total_checkins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_checkin_streaks_user"),
    )
    op.create_index("ix_checkin_streaks_user_id", "checkin_streaks", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_checkin_streaks_user_id", table_name="checkin_streaks")
    op.drop_table("checkin_streaks")
    op.drop_index("ix_life_records_bucket_item_id", table_name="life_records")
    op.drop_column("life_records", "bucket_item_id")
    op.drop_column("life_records", "temperature")
    op.drop_column("life_records", "ai_description")
    op.drop_column("life_records", "ai_tags")
    op.drop_column("life_records", "scene_type")
    op.drop_column("life_records", "duration_seconds")
    op.drop_column("life_records", "thumbnail_url")
    op.drop_column("life_records", "video_url")
