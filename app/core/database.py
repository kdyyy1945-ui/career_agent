from pathlib import Path

from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession
)
from sqlalchemy.orm import DeclarativeBase


BASE_DIR = Path(__file__).resolve().parents[2]
DB_PATH = BASE_DIR / "career.db"

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH.as_posix()}"


# DB 엔진
engine = create_async_engine(
    DATABASE_URL,
    echo=True
)


# DB 세션 생성기
SessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False
)


# ORM 모델의 부모 클래스
class Base(DeclarativeBase):
    pass


# FastAPI 의존성
async def get_db():
    async with SessionLocal() as session:
        yield session