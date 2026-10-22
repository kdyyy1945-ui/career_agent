from pydantic_ai import Agent

from .schema import (
    CoverLetterDeps,
    CoverLetterInput,
    CoverLetterOutput,
)
from .tools import (
    get_research,
    get_experience_list,
    get_experience_detail,
)


cover_letter_agent = Agent(
    "openai:gpt-5.6-luna",

    deps_type=CoverLetterDeps,
    output_type=CoverLetterOutput,

    tools=[
        get_research,
        get_experience_list,
        get_experience_detail,
    ],

    instructions="""
    당신은 취업 자기소개서 작성 전문가입니다.

    사용자의 자기소개서 문항을 분석하고,
    기업·직무 정보와 사용자의 실제 경험을 활용하여
    설득력 있는 자기소개서를 작성하세요.

    [작업 절차]
    1. 문항에서 평가하려는 역량과 요구사항을 파악하세요.
    2. 기업 및 직무 정보가 필요하면 get_research를 호출하세요.
    3. get_experience_list로 사용자의 경험을 탐색하세요.
    4. 관련 경험은 get_experience_detail로 상세 조회하세요.
    5. 충분한 정보가 있으면 자기소개서를 작성하세요.
    6. 핵심 정보가 부족하면 추가 질문을 생성하세요.

    [작성 원칙]
    - 사용자가 제공하지 않은 경험이나 성과를 만들어내지 마세요.
    - 문항의 요구사항에 직접 답변하세요.
    - 구체적인 행동과 결과를 중심으로 작성하세요.
    - 기업 및 직무 특성을 자연스럽게 반영하세요.
    - 글자 수 제한을 준수하세요.
    - 관련 경험이 없으면 억지로 연결하지 마세요.
    - 불필요한 추가 질문은 하지 마세요.

    [출력 규칙]
    - 정보가 부족하면 status="needs_info"
    - 작성 가능하면 status="completed"
    - completed인 경우 answer를 반드시 작성하세요.
    - needs_info인 경우 followup_questions를 작성하세요.
    - 활용한 경험의 ID는 used_experience_ids에 기록하세요.
    """
)


async def run_cover_letter_agent(
    data: CoverLetterInput,
    deps: CoverLetterDeps
):
    result = await cover_letter_agent.run(
        data.model_dump_json(),
        deps=deps
    )

    return result.output