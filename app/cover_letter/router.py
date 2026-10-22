from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

from . import service
from .schema import (
    CoverLetterCreate,
    QuestionUpdate,
    DraftUpdate,
    FollowupAnswer,
)


router = APIRouter(
    prefix="/cover-letter",
    tags=["cover-letter"]
)


@router.post("/{job_posting_id}")
async def create(
    job_posting_id: int,
    data: CoverLetterCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])

    return await service.create_cover_letter(
        db, user_id, job_posting_id, data
    )


@router.get("/{job_posting_id}")
async def show(
    job_posting_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])

    return await service.get_cover_letter(
        db, user_id, job_posting_id
    )


@router.patch("/questions/{question_id}")
async def update_question(
    question_id: int,
    data: QuestionUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])

    return await service.update_question(
        db, user_id, question_id, data
    )


@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])

    return await service.delete_question(
        db, user_id, question_id
    )


@router.patch("/questions/{question_id}/draft")
async def save_draft(
    question_id: int,
    data: DraftUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])

    return await service.update_draft(
        db, user_id, question_id, data.draft
    )


@router.get("/questions/{question_id}/followups")
async def show_followups(
    question_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])

    return await service.get_followups(
        db, user_id, question_id
    )


@router.patch("/followups/{followup_id}")
async def answer_followup(
    followup_id: int,
    data: FollowupAnswer,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = int(request.session["id"])

    return await service.answer_followup(
        db, user_id, followup_id, data.answer
    )