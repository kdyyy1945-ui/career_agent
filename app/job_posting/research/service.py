from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.agents.research.schema import ResearchAgentInput
from app.agents.research.research_agent import run_research_agent
from app.job_posting.model import JobPosting


async def create_research(
    db: AsyncSession,
    user_id: int,
    job_posting_id: int
):
    posting = await db.scalar(
        select(JobPosting).where(
            JobPosting.id == job_posting_id,
            JobPosting.user_id == user_id
        )
    )

    if not posting:
        raise HTTPException(404, "채용공고가 없습니다.")

    result = await run_research_agent(
        ResearchAgentInput(
            company_name=posting.company_name,
            position=posting.position,
            job_posting_url=posting.job_posting_url,
            job_posting_text=posting.job_posting_text
        )
    )

    posting.research = result.model_dump(mode="json")

    await db.commit()

    return {"id": posting.id}


async def get_research(
    db: AsyncSession,
    user_id : int,
    job_posting_id: int
):
    posting = await db.scalar(select(JobPosting).where(
        JobPosting.id == job_posting_id,
        JobPosting.user_id == user_id
    ))

    if not posting:
            raise HTTPException(404, "채용공고가 없습니다.")

    if posting.research is None:
        raise HTTPException(404, "리서치 정보가 없습니다.")

    
    return posting.research