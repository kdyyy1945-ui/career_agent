from fastapi import APIRouter, Depends, Request
from app.job_posting.service import create_job_posting, get_list_job_postings, show_job_posting, delete_job_posting, update_job_posting
from app.job_posting.schema import JobPostingUserInput, JobPostingUserOutput, JobPostingUpdateInput
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(prefix="/api/jobposting", tags=["JobPosting"])


@router.post("")
async def job_posting_create(
    data: JobPostingUserInput,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])
    job_posting_id = await create_job_posting(db, user_id, data)

    return JobPostingUserOutput(job_posting_id=job_posting_id)

    
@router.get("")
async def job_posting_list(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = int(request.session["id"])
    postings = await get_list_job_postings(db, user_id)

    return postings

@router.get("/{job_posting_id}")
async def job_posting_show(
    request: Request,
    job_posting_id: int,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])
    posting = await show_job_posting(db, user_id, job_posting_id)

    return posting

@router.patch("/{job_posting_id}")
async def job_posting_update(
    job_posting_id: int,
    data: JobPostingUpdateInput,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])

    return await update_job_posting(
        db, user_id, job_posting_id, data
    )


@router.delete("/{job_posting_id}")
async def job_posting_delete(
    job_posting_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])

    return await delete_job_posting(
        db, user_id, job_posting_id
    )