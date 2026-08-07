import logging

from sqlalchemy import create_engine, inspect, make_url, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

logger = logging.getLogger("app.core.database")
settings = get_settings()

# 用 SQLAlchemy URL 对象创建 engine，避免密码 + / = 特殊字符在字符串二次解析时被误处理。
# 容错：DATABASE_URL 为空或 make_url 解析失败时 fallback 到 sqlite，保证服务能启动
# （/ready 会报 postgres:error，但服务不 crash，便于诊断）。
_db_url = None
if settings.database_url:
    try:
        _db_url = make_url(settings.database_url)
        if _db_url.drivername and not _db_url.drivername.startswith("sqlite") and "+psycopg" not in _db_url.drivername:
            _db_url = _db_url.set(drivername="postgresql+psycopg")
        logger.info(
            "DATABASE_URL parsed OK: driver=%s host=%s port=%s db=%s",
            _db_url.drivername, _db_url.host, _db_url.port, _db_url.database,
        )
    except Exception as e:
        logger.error(
            "DATABASE_URL parse FAILED: %s | len=%d | prefix=%r",
            e, len(settings.database_url), settings.database_url[:30],
        )
        _db_url = None

if _db_url is None:
    _db_url = make_url("sqlite:///./career_os.db")
    logger.warning("Falling back to sqlite (DATABASE_URL empty or invalid)")

connect_args = {"check_same_thread": False} if (_db_url.drivername or "").startswith("sqlite") else {}
engine = create_engine(_db_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def ensure_columns() -> None:
    """开发环境幂等补列: 老库没有新列时直接添加, 不依赖 Alembic 版本链."""
    additions = {
        "life_goals": {
            "budget": "VARCHAR(120)",
            "recommended_days": "INTEGER",
            "best_season": "VARCHAR(80)",
            "region": "VARCHAR(120)",
            "friends": "JSON",
            "ai_plan_meta": "JSON",
        },
        "user_profiles": {
            "life_motto": "VARCHAR(300)",
        },
        # ── Sprint 10: AI 周计划增强 ──
        "weekly_plans": {
            "weekly_focus": "TEXT",
            "rationale": "TEXT",
            "tips": "JSON",
            "summary": "TEXT",
            "reflection": "TEXT",
            "completion_rate": "FLOAT DEFAULT 0",
            "total_minutes": "INTEGER DEFAULT 0",
            "completed_minutes": "INTEGER DEFAULT 0",
            "goal_ids": "JSON",
            "skill_ids": "JSON",
            "context_snapshot": "JSON",
            "ai_content_id": "VARCHAR(36)",
            "updated_at": "DATETIME",
        },
        "plan_tasks": {
            "description": "TEXT",
            "task_type": "VARCHAR(24) DEFAULT 'learning'",
            "difficulty": "VARCHAR(16) DEFAULT 'medium'",
            "priority": "VARCHAR(16) DEFAULT 'medium'",
            "completed_at": "DATETIME",
            "ai_generated": "BOOLEAN DEFAULT 0",
            "resource_url": "TEXT",
            "estimated_outcome": "VARCHAR(200)",
            "goal_id": "VARCHAR(36)",
            "life_goal_id": "VARCHAR(36)",
            "skill_id": "VARCHAR(36)",
            "milestone_id": "VARCHAR(36)",
        },
        # ── Sprint 11: Daily Journal ──
        "daily_journals": {
            "content": "TEXT",
            "tags": "JSON",
            "goal_id": "VARCHAR(36)",
            "skill_id": "VARCHAR(36)",
            "updated_at": "DATETIME",
            "time_slot": "VARCHAR(20) DEFAULT 'morning'",
        },
        # ── Sprint 12: Chat & Groups ──
        "chat_conversations": {
            "name": "VARCHAR(120)",
            "avatar_url": "TEXT",
            "owner_id": "VARCHAR(36)",
            "last_message_at": "DATETIME",
            "last_message_preview": "VARCHAR(500)",
            "updated_at": "DATETIME",
        },
        "conversation_members": {
            "role": "VARCHAR(16) DEFAULT 'member'",
            "last_read_at": "DATETIME",
            "muted": "BOOLEAN DEFAULT 0",
            "joined_at": "DATETIME",
        },
        "chat_messages": {
            "message_type": "VARCHAR(16) DEFAULT 'text'",
            "image_url": "TEXT",
            "image_width": "INTEGER",
            "image_height": "INTEGER",
            "system_action": "VARCHAR(40)",
            "system_meta": "JSON",
            "reply_to_id": "VARCHAR(36)",
            "deleted_at": "DATETIME",
        },
        "message_reads": {
            "read_at": "DATETIME",
        },
    }
    tables = set(inspect(engine).get_table_names())
    with engine.begin() as conn:
        for table, columns in additions.items():
            if table not in tables:
                continue
            existing = {col["name"] for col in inspect(conn).get_columns(table)}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_journal_constraints() -> None:
    """迁移 daily_journals 唯一约束: (user_id, journal_date) → (user_id, journal_date, time_slot).
    仅在 PostgreSQL 上执行 (pg_constraint 等语法不兼容 SQLite).
    SQLite 下由 __table_args__ 中的 UniqueConstraint 自动处理."""
    driver = engine.url.drivername or ""
    if driver.startswith("sqlite"):
        logger.info("SQLite detected, skipping journal constraint migration (handled by model)")
        return

    tables = set(inspect(engine).get_table_names())
    if "daily_journals" not in tables:
        return
    try:
        with engine.begin() as conn:
            # 检查新约束是否已存在
            result = conn.execute(text(
                "SELECT conname FROM pg_constraint "
                "WHERE conrelid = 'daily_journals'::regclass AND conname = 'uq_daily_journal_user_date_slot'"
            ))
            if result.fetchone():
                logger.info("New journal constraint already exists, skipping migration")
                return

            # 暴力删除所有 unique 约束, 然后重建正确的
            constraints = conn.execute(text(
                """
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'daily_journals'::regclass AND contype = 'u'
                """
            ))
            for row in constraints.fetchall():
                conn.execute(text(f"ALTER TABLE daily_journals DROP CONSTRAINT IF EXISTS {row[0]}"))
                logger.info("Dropped constraint: %s", row[0])

            # 添加新约束 (含 time_slot)
            conn.execute(text(
                "ALTER TABLE daily_journals ADD CONSTRAINT uq_daily_journal_user_date_slot "
                "UNIQUE (user_id, journal_date, time_slot)"
            ))
            logger.info("Added new constraint uq_daily_journal_user_date_slot (user_id, journal_date, time_slot)")
    except Exception as e:
        logger.warning("Journal constraint migration failed (non-critical): %s", e)
