from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.schema import RegisterInput, LoginInput
from app.auth.service import register_user, login_user, logout_user
from app.auth.service import get_session


router = APIRouter(prefix="/api/auth",tags=["Auth"])


@router.post("/register")
async def register(data: RegisterInput, db: AsyncSession = Depends(get_db)):
    return await register_user(db, data)


@router.post("/login")
async def login(data: LoginInput, request: Request, db: AsyncSession = Depends(get_db)):
    return await login_user(db, data, request)


@router.post("/logout")
async def logout(request: Request):
    return await logout_user(request)

@router.get("/session")
async def session(request: Request):
    return await get_session(request)