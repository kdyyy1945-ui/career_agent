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
    company_overview: list[ResearchItem] = Field(
        default_factory=list,
        description="기업의 주요 사업, 제품, 서비스 및 고객"
    )

    vision_strategy: list[ResearchItem] = Field(
        default_factory=list,
        description="기업의 비전, 중장기 목표 및 핵심 사업 전략"
    )

    competitive_advantages: list[ResearchItem] = Field(
        default_factory=list,
        description="경쟁사 대비 차별점과 경쟁 우위"
    )

    recent_issues: list[ResearchItem] = Field(
        default_factory=list,
        description="최근 주요 뉴스, 사업 동향 및 이슈"
    )

    company_culture: list[ResearchItem] = Field(
        default_factory=list,
        description="기업의 인재상, 핵심 가치 및 조직 문화"
    )

    position_analysis: list[ResearchItem] = Field(
        default_factory=list,
        description="지원 직무의 주요 업무와 기업 내 역할"
    )

    required_competencies: list[ResearchItem] = Field(
        default_factory=list,
        description="지원 직무에 필요한 핵심 역량"
    )

    preferred_qualifications: list[ResearchItem] = Field(
        default_factory=list,
        description="채용 공고에 명시된 우대사항"
    )

