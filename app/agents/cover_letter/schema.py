from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class CoverLetterDeps:
    db: AsyncSession
    user_id: int
    job_posting_id: int


class CoverLetterInput(BaseModel):
    question: str
    max_length: int | None = None


class CoverLetterOutput(BaseModel):
    status: Literal["needs_info", "completed"]

    answer: str | None = None

    followup_questions: list[str] = Field(
        default_factory=list
    )

    used_experience_ids: list[int] = Field(
        default_factory=list
    )