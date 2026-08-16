from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session

from app.config import get_settings

settings = get_settings()

# MySQL remains the production default; SQLite is supported for the standalone local demo.
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
_engine_options = {
    "echo": settings.ENVIRONMENT == "development",
    "pool_pre_ping": True,
}
if _is_sqlite:
    _engine_options["connect_args"] = {"check_same_thread": False}
else:
    _engine_options.update({"pool_size": 10, "max_overflow": 20, "pool_recycle": 3600})

engine = create_engine(settings.DATABASE_URL, **_engine_options)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a SQLAlchemy session and guarantees cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

