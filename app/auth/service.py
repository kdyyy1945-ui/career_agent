from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.model import User
from app.auth.schema import RegisterInput
from app.auth.security import hash_password


from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.model import User
from app.auth.schema import RegisterInput, LoginInput
from app.auth.security import hash_password, verify_password


async def register_user(db: AsyncSession, data: RegisterInput):
    user = await db.scalar(
        select(User).where(User.login_id == data.login_id)
    )
    if user:
        raise HTTPException(409, "이미 존재하는 아이디입니다.")

    db.add(User(
        login_id=data.login_id,
        password_hash=hash_password(data.password),
        name=data.name
    ))
    await db.commit()
    return {"message": "회원가입 성공"}


async def login_user(db: AsyncSession, data: LoginInput, request: Request):
    user = await db.scalar(
        select(User).where(User.login_id == data.login_id)
    )
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "로그인 실패")

    request.session["id"] = user.id
    return {"message": "로그인 성공"}


async def logout_user(request: Request):
    request.session.clear()
    return {"message": "로그아웃 성공"}


async def get_session(request: Request):

    id = request.session.get("id")

    return{
        "authenticated": id is not None,
        "user_id": id
    }