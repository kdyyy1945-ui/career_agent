from fastapi import APIRouter, Depends, Request
from app.job_posting.research.service import create_research, get_research
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(prefix="/api/job_posting", tags=["JobPosting"])

@router.post("{job_posting_id}/research")
async def research_create(
    request: Request,
    job_posting_id: int,
    db: AsyncSession = Depends(get_db)
):
    
    user_id = int(request.session["id"])

    return await create_research(db, user_id, job_posting_id)

@router.get("{job_posting_id}/research")
async def research_show(
    request: Request,
    job_posting_id : int,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])

    return await get_research(db, user_id, job_posting_id)
