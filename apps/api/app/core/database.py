import logging

from sqlalchemy import create_engine, make_url
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
        if _db_url.drivername and not _db_url.drivername.startswith("sqlite"):
            if "+psycopg" not in _db_url.drivername:
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


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
