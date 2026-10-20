from pydantic import BaseModel, Field
from datetime import date


class JobPostingUserInput(BaseModel):

    title: str = Field(..., description="공고 관리용 제목")
    company_name: str = Field(..., description="회사명")
    position: str = Field(..., description="지원 직무")

    job_posting_url: str | None = Field(
        None, description="채용공고 URL"
    )
    job_posting_text: str | None = Field(
        None, description="채용공고 원문"
    )

    end_at: date | None = Field(
        None, description="채용 마감일"
    )


class JobPostingUserOutput(BaseModel):
    job_posting_id: int
    

class JobPostingUpdateInput(BaseModel):
    title: str | None = None
    company_name: str | None = None
    position: str | None = None
    job_posting_url: str | None = None
    job_posting_text: str | None = None
    end_at: date | None = None