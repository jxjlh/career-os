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
    # 幂等补列：生产库由 create_all + ensure_columns 自愈合，复用镜像 / 重跑迁移时
    # 列可能已存在，先查 existing 再补，避免 "duplicate column name" 导致启动崩溃。
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("life_records")}

    # ── life_records: 视频日志 + AI 场景 + 关联 bucket ──
    video_fields = [
        ("video_url", sa.Text()),
        ("thumbnail_url", sa.Text()),
        ("duration_seconds", sa.Integer()),
        ("scene_type", sa.String(length=40)),
        ("ai_tags", sa.JSON()),
        ("ai_description", sa.Text()),
        ("temperature", sa.Float()),
    ]
    for name, col in video_fields:
        if name not in existing:
            op.add_column("life_records", sa.Column(name, col, nullable=True))

    if "bucket_item_id" not in existing:
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

    # ── checkin_streaks: 连续打卡（表也可能已由 create_all 建好）──
    if not inspector.has_table("checkin_streaks"):
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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    life_cols = {c["name"] for c in inspector.get_columns("life_records")}

    if "bucket_item_id" in life_cols:
        op.drop_index("ix_life_records_bucket_item_id", table_name="life_records")
        op.drop_column("life_records", "bucket_item_id")
    for name in ("temperature", "ai_description", "ai_tags", "scene_type",
                 "duration_seconds", "thumbnail_url", "video_url"):
        if name in life_cols:
            op.drop_column("life_records", name)

    if inspector.has_table("checkin_streaks"):
        op.drop_index("ix_checkin_streaks_user_id", table_name="checkin_streaks")
        op.drop_table("checkin_streaks")
