import os
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.core.database import engine, Base
from app.auth.model import User
from app.auth.router import router as auth_router
from app.pages.router import router as pages_router
from app.experience.router import router as experience_router

BASE_DIR = Path(__file__).resolve().parents[1]
PAGES_DIR = Path(__file__).resolve().parent / "pages"

load_dotenv(BASE_DIR / ".env")


# 서버 시작 및 종료 관리
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시 DB 테이블 생성
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    # 종료 시 DB 연결 정리
    await engine.dispose()


app = FastAPI(lifespan=lifespan)


# 세션 미들웨어
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET_KEY"],
    same_site="lax",
    https_only=False
)


# 정적 파일
app.mount(
    "/static",
    StaticFiles(directory=PAGES_DIR / "static"),
    name="static"
)


# 라우터 등록
app.include_router(auth_router)
app.include_router(experience_router)
app.include_router(pages_router)