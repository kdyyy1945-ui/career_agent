from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, JSON
from app.core.database import Base
from datetime import date

class JobPosting(Base):
    __tablename__ = "job_posting"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )
    title: Mapped[str]

    research: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True
    )
    company_name: Mapped[str]
    position: Mapped[str]
    job_posting_url: Mapped[str | None]
    job_posting_text: Mapped[str | None]
    end_at: Mapped[date | None]


    


