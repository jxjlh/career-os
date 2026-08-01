import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, make_url, pool

from app.core.config import get_settings
from app.db.base import Base
from app.db import models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

# 用 SQLAlchemy URL 对象而非字符串，避免密码 + / = 特殊字符二次解析问题。
# 容错：DATABASE_URL 为空或解析失败时 fallback 到 sqlite（保证 alembic 不 crash）。
_settings = get_settings()
_db_url = None
if _settings.database_url:
    try:
        _db_url = make_url(_settings.database_url)
        if _db_url.drivername and not _db_url.drivername.startswith("sqlite"):
            if "+psycopg" not in _db_url.drivername:
                _db_url = _db_url.set(drivername="postgresql+psycopg")
        logger.info(
            "DATABASE_URL parsed OK: driver=%s host=%s port=%s",
            _db_url.drivername, _db_url.host, _db_url.port,
        )
    except Exception as e:
        logger.error(
            "DATABASE_URL parse FAILED: %s | len=%d | prefix=%r",
            e, len(_settings.database_url), _settings.database_url[:30],
        )
        _db_url = None

if _db_url is None:
    _db_url = make_url("sqlite:///./career_os.db")
    logger.warning("Falling back to sqlite (DATABASE_URL empty or invalid)")

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=_db_url.render_as_string(hide_password=False),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(_db_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
