from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.job_posting.model import JobPosting
from app.job_posting.schema import JobPostingUserInput, JobPostingUpdateInput


async def create_job_posting(
    db: AsyncSession,
    user_id: int,
    data: JobPostingUserInput
):
    posting = JobPosting(
        user_id=user_id,
        **data.model_dump()
    )

    db.add(posting)
    await db.commit()
    await db.refresh(posting)

    return posting.id


async def get_list_job_postings(
    db: AsyncSession,
    user_id: int
):
    postings = await db.scalars(
        select(JobPosting).where(
            JobPosting.user_id == user_id
        )
    )

    return postings.all()


async def show_job_posting(
    db: AsyncSession,
    user_id: int,
    job_posting_id: int
):
    posting = await db.scalar(
        select(JobPosting).where(
            JobPosting.user_id == user_id,
            JobPosting.id == job_posting_id
        )
    )

    if not posting:
        raise HTTPException(404, "채용공고가 없습니다.")

    return posting


async def update_job_posting(
    db: AsyncSession,
    user_id: int,
    job_posting_id: int,
    data: JobPostingUpdateInput
):
    posting = await show_job_posting(db, user_id, job_posting_id)

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(posting, key, value)

    await db.commit()

    return {"id": posting.id}


async def delete_job_posting(
    db: AsyncSession,
    user_id: int,
    job_posting_id: int
):
    posting = await show_job_posting(db, user_id, job_posting_id)

    await db.delete(posting)
    await db.commit()

    return {"message": "채용공고가 삭제되었습니다."}