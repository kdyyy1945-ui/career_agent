from pydantic_ai import RunContext
from sqlalchemy import select

from app.job_posting.model import JobPosting
from app.experience.model import Experience

from .schema import CoverLetterDeps


async def get_research(
    ctx: RunContext[CoverLetterDeps]
) -> dict:
    """지원 기업, 직무, 채용 공고 및 분석 결과를 조회합니다."""

    posting = await ctx.deps.db.scalar(
        select(JobPosting).where(
            JobPosting.id == ctx.deps.job_posting_id,
            JobPosting.user_id == ctx.deps.user_id
        )
    )

    if not posting:
        return {"error": "채용 공고가 없습니다."}

    return {
        "company_name": posting.company_name,
        "position": posting.position,
        "research_result": posting.research_result
    }


async def get_experience_list(
    ctx: RunContext[CoverLetterDeps]
) -> list[dict]:
    """사용자의 경험 목록과 태그를 조회합니다."""

    result = await ctx.deps.db.scalars(
        select(Experience).where(
            Experience.user_id == ctx.deps.user_id,
            Experience.status == "completed"
        )
    )

    return [
        {
            "id": exp.id,
            "title": exp.title,
            "tags": exp.tags
        }
        for exp in result.all()
    ]


async def get_experience_detail(
    ctx: RunContext[CoverLetterDeps],
    experience_id: int
) -> dict:
    """선택한 경험의 STAR 상세 내용을 조회합니다."""

    exp = await ctx.deps.db.scalar(
        select(Experience).where(
            Experience.id == experience_id,
            Experience.user_id == ctx.deps.user_id
        )
    )

    if not exp:
        return {"error": "경험이 없습니다."}

    return {
        "id": exp.id,
        "title": exp.title,
        "situation": exp.situation,
        "task": exp.task,
        "action": exp.action,
        "result": exp.result,
        "original_exp": exp.original_exp
    }