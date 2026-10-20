from datetime import date
from pydantic import BaseModel, Field, HttpUrl


class ResearchAgentInput(BaseModel):
    company_name: str = Field(..., description="지원 회사명")
    position: str = Field(..., description="지원 직무")
    job_posting_url: HttpUrl | None = Field(None, description="채용 공고 URL")
    job_posting_text: str | None = Field(None, description="채용 공고 원문")


class ResearchItem(BaseModel):
    title: str = Field(..., description="제목")
    content: str = Field(..., description="분석 내용")
    source_url: HttpUrl | None = Field(None, description="근거 자료 URL")
    published_at: date | None = Field(None, description="자료 발행일")


class ResearchAgentOutput(BaseModel):

    business: list[ResearchItem] = Field(
        default_factory=list,
        description="지원 직무와 관련된 핵심 사업 및 서비스"
    )

    issue: list[ResearchItem] = Field(
        default_factory=list,
        description="지원 직무와 관련된 기업 전략 및 최근 이슈"
    )

    responsibilities: list[ResearchItem] = Field(
        default_factory=list,
        description="채용공고에 명시된 주요 담당 업무"
    )

    requirements: list[ResearchItem] = Field(
        default_factory=list,
        description="채용공고에 명시된 필수 자격 및 요구 역량"
    )

    preferences: list[ResearchItem] = Field(
        default_factory=list,
        description="채용공고에 명시된 우대 사항"
    )