from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .schema import FinalUserInput, ExperienceUpdateInput
from app.agents.experience.schema import InitAgentInput
from .service import create_experience, improve_experience, get_experience, get_experiences,update_experience,delete_experience
from app.core.database import get_db

router = APIRouter(prefix="/api/experiences", tags=["Experience"])


# 1. 최초 경험 분석
@router.post("/initialize")
async def create(
    data: InitAgentInput,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])
    return await create_experience(db, data, user_id)


# 2. 추가 답변을 통한 최종 경험 정리
@router.post("/improve")
async def finalize(
    data: FinalUserInput,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])
    return await improve_experience(db, data, user_id)


@router.get("")
async def list_experiences(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])
    return await get_experiences(db, user_id)


@router.get("/{experience_id}")
async def detail_experience(
    experience_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])
    return await get_experience(db, experience_id, user_id)


@router.patch("/{experience_id}")
async def edit_experience(
    experience_id: int,
    data: ExperienceUpdateInput,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])
    return await update_experience(db, experience_id, data, user_id)


@router.delete("/{experience_id}")
async def remove_experience(
    experience_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])
    return await delete_experience(db, experience_id, user_id)