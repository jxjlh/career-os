from sqlalchemy import create_engine, make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# 用 SQLAlchemy URL 对象创建 engine，而非字符串。
# 原因：make_url 解析后密码保留原始值，直接传给驱动（psycopg3），
# 避免 render_as_string → 字符串二次解析时密码里的 + / = 被误处理
# （psycopg3 可能把 + 当空格，导致 password authentication failed）。
_db_url = make_url(settings.database_url)
if _db_url.drivername and not _db_url.drivername.startswith("sqlite"):
    if "+psycopg" not in _db_url.drivername:
        _db_url = _db_url.set(drivername="postgresql+psycopg")

connect_args = {"check_same_thread": False} if (_db_url.drivername or "").startswith("sqlite") else {}
engine = create_engine(_db_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
