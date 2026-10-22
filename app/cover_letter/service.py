from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.job_posting.model import JobPosting

from .model import (
    CoverLetter,
    CoverLetterQuestion,
    CoverLetterFollowup,
)
from .schema import (
    CoverLetterCreate,
    QuestionUpdate,
)


async def get_posting(
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

    return posting


async def get_question(
    db: AsyncSession,
    user_id: int,
    question_id: int
):
    question = await db.scalar(
        select(CoverLetterQuestion)
        .join(CoverLetter)
        .join(JobPosting)
        .where(
            CoverLetterQuestion.id == question_id,
            JobPosting.user_id == user_id
        )
    )

    if not question:
        raise HTTPException(404, "자소서 문항이 없습니다.")

    return question


# 자소서 생성
async def create_cover_letter(
    db: AsyncSession,
    user_id: int,
    job_posting_id: int,
    data: CoverLetterCreate
):
    await get_posting(db, user_id, job_posting_id)

    existing = await db.scalar(
        select(CoverLetter).where(
            CoverLetter.job_posting_id == job_posting_id
        )
    )

    if existing:
        raise HTTPException(409, "이미 자소서가 존재합니다.")

    cover_letter = CoverLetter(
        job_posting_id=job_posting_id
    )

    db.add(cover_letter)
    await db.flush()

    for order, item in enumerate(data.questions, start=1):
        db.add(
            CoverLetterQuestion(
                cover_letter_id=cover_letter.id,
                order=order,
                question=item.question,
                max_length=item.max_length
            )
        )

    await db.commit()

    return {"id": cover_letter.id}


# 자소서 조회
async def get_cover_letter(
    db: AsyncSession,
    user_id: int,
    job_posting_id: int
):
    await get_posting(db, user_id, job_posting_id)

    cover_letter = await db.scalar(
        select(CoverLetter).where(
            CoverLetter.job_posting_id == job_posting_id
        )
    )

    if not cover_letter:
        raise HTTPException(404, "자소서가 없습니다.")

    questions = await db.scalars(
        select(CoverLetterQuestion)
        .where(
            CoverLetterQuestion.cover_letter_id == cover_letter.id
        )
        .order_by(CoverLetterQuestion.order)
    )

    return {
        "id": cover_letter.id,
        "job_posting_id": job_posting_id,
        "questions": [
            {
                "id": q.id,
                "order": q.order,
                "question": q.question,
                "max_length": q.max_length,
                "analysis": q.analysis,
                "draft": q.draft
            }
            for q in questions.all()
        ]
    }


# 문항 수정
async def update_question(
    db: AsyncSession,
    user_id: int,
    question_id: int,
    data: QuestionUpdate
):
    question = await get_question(db, user_id, question_id)

    updates = data.model_dump(exclude_unset=True)

    for key, value in updates.items():
        setattr(question, key, value)

    await db.commit()

    return {"id": question.id}


# 문항 삭제
async def delete_question(
    db: AsyncSession,
    user_id: int,
    question_id: int
):
    question = await get_question(db, user_id, question_id)

    # 추가 질문도 함께 삭제
    followups = await db.scalars(
        select(CoverLetterFollowup).where(
            CoverLetterFollowup.cover_letter_question_id == question_id
        )
    )

    for followup in followups.all():
        await db.delete(followup)

    await db.delete(question)
    await db.commit()

    return {"message": "문항 삭제 완료"}


# 초안 저장 / 수정
async def update_draft(
    db: AsyncSession,
    user_id: int,
    question_id: int,
    draft: str
):
    question = await get_question(db, user_id, question_id)

    question.draft = draft

    await db.commit()

    return {"id": question.id}


# 추가 질문 조회
async def get_followups(
    db: AsyncSession,
    user_id: int,
    question_id: int
):
    await get_question(db, user_id, question_id)

    result = await db.scalars(
        select(CoverLetterFollowup)
        .where(
            CoverLetterFollowup.cover_letter_question_id == question_id
        )
        .order_by(
            CoverLetterFollowup.round,
            CoverLetterFollowup.id
        )
    )

    return [
        {
            "id": item.id,
            "round": item.round,
            "question": item.question,
            "answer": item.answer
        }
        for item in result.all()
    ]


# 추가 질문 답변
async def answer_followup(
    db: AsyncSession,
    user_id: int,
    followup_id: int,
    answer: str
):
    followup = await db.scalar(
        select(CoverLetterFollowup)
        .join(
            CoverLetterQuestion,
            CoverLetterFollowup.cover_letter_question_id
            == CoverLetterQuestion.id
        )
        .join(CoverLetter)
        .join(JobPosting)
        .where(
            CoverLetterFollowup.id == followup_id,
            JobPosting.user_id == user_id
        )
    )

    if not followup:
        raise HTTPException(404, "추가 질문이 없습니다.")

    followup.answer = answer

    await db.commit()

    return {"id": followup.id}