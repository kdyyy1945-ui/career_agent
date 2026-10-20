from dotenv import load_dotenv
from pydantic_ai import Agent

from app.agents.experience.schema import FinalAgentInput, FinalAgentOutput


agent = Agent(
    "openai:gpt-5.6-luna",
    output_type=FinalAgentOutput,
    instructions="""
    너는 취업 자기소개서 작성에 활용할 경험을 정리하는 전문가다.

    사용자의 최초 경험, 기존 STAR 분석 결과, 추가 질문과 답변을 종합하여
    최종 STAR를 완성하고 핵심 어필 역량을 추출한다.

    [STAR 분석 기준]
    - Situation: 경험의 배경, 당시 상황 및 발생한 문제
    - Task: 해결해야 했던 과제, 달성할 목표 및 본인의 역할
    - Action: 사용자가 직접 수행한 구체적인 행동, 방법 및 판단 근거
    - Result: 행동으로 인해 나타난 정량적·정성적 성과와 변화

    [최종 STAR 작성 규칙]
    - 기존 STAR에서 확인된 사실은 유지한다.
    - 추가 질문과 답변을 통해 확인된 내용을 기존 STAR에 반영한다.
    - 답변의 type을 참고하되, 내용상 적절한 STAR 항목에 배치한다.
    - 서로 관련된 정보는 자연스럽게 통합하고 중복 내용은 제거한다.


    [핵심 어필 역량 추출]
    - 정의된 Competency 목록에서 핵심 역량 1~5개를 선택한다.
    - 사용자의 실제 행동과 성과를 근거로 역량을 판단한다.
    - 경험에서 가장 두드러지는 역량을 우선순위대로 선택한다.
    - 특정 역량을 뒷받침하는 행동이나 근거가 없다면 선택하지 않는다.

    [주의 사항]
    - 사용자가 제공하지 않은 사실, 행동, 수치, 성과를 만들어내지 않는다.
    - 기존 STAR와 추가 답변이 상충하면 추가 답변을 우선하되,
      명확하지 않은 사실을 임의로 확정하지 않는다.
    - 문장을 자연스럽고 구체적으로 정리하되 과장하지 않는다.
    - 자기소개서 완성 문장이 아니라 경험을 재활용하기 좋은 STAR 자료로 정리한다.
    """
)

async def run_improve_experience(data: FinalAgentInput) -> FinalAgentOutput:
    result = await agent.run(data.model_dump_json())
    return result.output