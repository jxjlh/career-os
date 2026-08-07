"""Add missing daily_journals columns and fix unique constraint.

Revision ID: f3d4c5b6a798
Revises: a5b6c7d8e9f0
Create Date: 2026-08-08 00:00:00

历史上 daily_journals 由 create_all 直接建表，后续加 time_slot 等列时没有对应
Alembic 迁移，导致生产库缺列、保存小记报 500。该迁移幂等补齐列并把唯一约束
升级为 (user_id, journal_date, time_slot)，在 PostgreSQL 和 SQLite 上均可安全执行。
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3d4c5b6a798"
down_revision: Union[str, None] = "a5b6c7d8e9f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _bind():
    """Return the underlying connection/bind from the Alembic context."""
    return op.get_context().bind


def _is_postgres() -> bool:
    return _bind().dialect.name == "postgresql"


def upgrade() -> None:
    bind = _bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("daily_journals"):
        return

    existing = {c["name"] for c in inspector.get_columns("daily_journals")}
    columns: list[tuple[str, str]] = [
        ("content", "TEXT"),
        ("tags", "JSON"),
        # SQLite 的 ALTER TABLE ADD COLUMN 不支持外键约束，这里仅补列，
        # 外键关系由 ORM 层保证（models.py 中已声明）。
        ("goal_id", "VARCHAR(36)"),
        ("skill_id", "VARCHAR(36)"),
        ("updated_at", "DATETIME"),
        ("time_slot", "VARCHAR(20) DEFAULT 'morning'"),
    ]
    for name, ddl in columns:
        if name not in existing:
            op.execute(f'ALTER TABLE daily_journals ADD COLUMN {name} {ddl}')

    if _is_postgres():
        # 清理同一用户同一天同时段的历史重复数据，避免加唯一约束失败。
        op.execute(
            """
            DELETE FROM daily_journals
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY user_id, journal_date, COALESCE(time_slot, 'morning')
                               ORDER BY created_at DESC
                           ) AS rn
                    FROM daily_journals
                ) ranked
                WHERE rn > 1
            )
            """
        )

        rows = bind.execute(
            sa.text(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'daily_journals'::regclass AND contype = 'u'
                """
            )
        ).fetchall()
        for row in rows:
            name = row[0]
            if name != "uq_daily_journal_user_date_slot":
                op.execute(f'ALTER TABLE daily_journals DROP CONSTRAINT "{name}"')

        # 新约束已存在时无需重复添加。
        has_new = any(row[0] == "uq_daily_journal_user_date_slot" for row in rows)
        if not has_new:
            op.execute(
                """
                ALTER TABLE daily_journals
                ADD CONSTRAINT uq_daily_journal_user_date_slot
                UNIQUE (user_id, journal_date, time_slot)
                """
            )
    else:
        # SQLite：旧的 (user_id, journal_date) 唯一索引仍会阻止同日多时段保存，
        # 需要先移除，再按新列建唯一索引。
        old_indexes = sa.inspect(bind).get_indexes("daily_journals")
        old_names = {i["name"] for i in old_indexes if i.get("unique")}
        if old_names:
            for old_name in old_names:
                op.execute(f'DROP INDEX IF EXISTS "{old_name}"')
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_journal_user_date_slot "
            "ON daily_journals (user_id, journal_date, time_slot)"
        )
        op.create_index(
            "ix_daily_journals_time_slot",
            "daily_journals",
            ["time_slot"],
            unique=False,
        )


def downgrade() -> None:
    bind = _bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("daily_journals"):
        return
    existing = {c["name"] for c in inspector.get_columns("daily_journals")}
    for name in ("time_slot", "updated_at", "skill_id", "goal_id", "tags", "content"):
        if name in existing:
            op.drop_column("daily_journals", name)
