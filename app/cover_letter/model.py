from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, Text, JSON, UniqueConstraint

from app.core.database import Base


class CoverLetter(Base):
    __tablename__ = "cover_letter"

    id: Mapped[int] = mapped_column(primary_key=True)

    job_posting_id: Mapped[int] = mapped_column(
        ForeignKey("job_posting.id"),
        nullable=False,
        unique=True
    )


class CoverLetterQuestion(Base):
    __tablename__ = "cover_letter_question"

    id: Mapped[int] = mapped_column(primary_key=True)

    cover_letter_id: Mapped[int] = mapped_column(
        ForeignKey("cover_letter.id"),
        nullable=False
    )

    order: Mapped[int]

    question: Mapped[str] = mapped_column(Text)

    max_length: Mapped[int | None] = mapped_column(
        nullable=True
    )

    analysis: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True
    )

    draft: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    __table_args__ = (
        UniqueConstraint("cover_letter_id", "order"),
    )


class CoverLetterFollowup(Base):
    __tablename__ = "cover_letter_followup"

    id: Mapped[int] = mapped_column(primary_key=True)

    cover_letter_question_id: Mapped[int] = mapped_column(
        ForeignKey("cover_letter_question.id"),
        nullable=False
    )

    round: Mapped[int] = mapped_column(default=1)

    question: Mapped[str] = mapped_column(Text)

    answer: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )