from datetime import datetime, timezone

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import (
    ForeignKey,
    Text,
    JSON,
    DateTime,
    UniqueConstraint,
)

from app.core.database import Base


class CoverLetterQuestion(Base):
    __tablename__ = "cover_letter_questions"

    id: Mapped[int] = mapped_column(primary_key=True)

    job_posting_id: Mapped[int] = mapped_column(
        ForeignKey("job_postings.id"),
        nullable=False
    )

    question: Mapped[str] = mapped_column(Text)
    max_length: Mapped[int | None]

    analysis: Mapped[dict | None] = mapped_column(JSON)


class CoverLetterFollowUp(Base):
    __tablename__ = "cover_letter_follow_up"

    id: Mapped[int] = mapped_column(primary_key=True)

    question_id: Mapped[int] = mapped_column(
        ForeignKey("cover_letter_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text)


class CoverLetterVersion(Base):
    __tablename__ = "cover_letter_versions"

    __table_args__ = (
        UniqueConstraint("question_id", "version_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    question_id: Mapped[int] = mapped_column(
        ForeignKey("cover_letter_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    version_number: Mapped[int]

    content: Mapped[str] = mapped_column(Text)

    is_final: Mapped[bool] = mapped_column(
        default=False,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )