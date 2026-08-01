from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, make_url, pool

from app.core.config import get_settings
from app.db.base import Base
from app.db import models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 用 SQLAlchemy URL 对象而非字符串，避免密码里的 + / = 等特殊字符
# 在 render_as_string → 字符串二次解析时被误处理（psycopg3 把 + 当空格）。
_settings = get_settings()
_db_url = make_url(_settings.database_url)
if _db_url.drivername and not _db_url.drivername.startswith("sqlite"):
    if "+psycopg" not in _db_url.drivername:
        _db_url = _db_url.set(drivername="postgresql+psycopg")
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
