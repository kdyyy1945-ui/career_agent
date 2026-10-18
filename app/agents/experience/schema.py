
from enum import Enum
from typing import Literal, Optional, List

from pydantic import BaseModel, Field


# 핵심 어필 역량
class Competency(str, Enum):
    # 문제해결 · 사고
    PROBLEM_SOLVING = "문제해결"
    ANALYSIS = "분석력"
    CREATIVITY = "창의성"
    DECISION_MAKING = "의사결정"
    INNOVATION = "개선혁신"

    # 협업 · 대인관계
    TEAMWORK = "협업"
    COMMUNICATION = "의사소통"
    CONFLICT_MANAGEMENT = "갈등관리"
    NEGOTIATION = "설득협상"
    LEADERSHIP = "리더십"
    CUSTOMER_FOCUS = "고객지향"

    # 실행 · 성과
    INITIATIVE = "주도성"
    EXECUTION = "실행력"
    RESPONSIBILITY = "책임감"
    GOAL_ACHIEVEMENT = "목표달성"
    PLANNING_MANAGEMENT = "계획관리"
    RESOURCE_MANAGEMENT = "자원관리"

    # 성장 · 자기관리
    LEARNING = "학습능력"
    CHALLENGE = "도전정신"
    ADAPTABILITY = "적응력"
    PERSEVERANCE = "끈기"

    # 직업윤리 · 태도
    ETHICS = "윤리의식"
    TRUSTWORTHINESS = "신뢰성"
    ATTENTION_TO_DETAIL = "꼼꼼함"
    SAFETY_QUALITY = "안전품질의식"

    # 직무 · 전문역량
    JOB_EXPERTISE = "직무전문성"
    TECHNICAL_APPLICATION = "기술활용"
    DATA_LITERACY = "데이터활용"
    PLANNING = "기획력"
    AUTOMATION = "업무자동화"


# STAR 분석
class STAR(BaseModel):
    situation: Optional[str] = Field(
        None, description="경험의 배경, 당시 상황 및 발생한 문제"
    )
    task: Optional[str] = Field(
        None, description="해결해야 했던 과제, 달성할 목표 및 맡은 역할"
    )
    action: Optional[str] = Field(
        None, description="과제 해결을 위해 본인이 직접 수행한 구체적인 행동과 방법"
    )
    result: Optional[str] = Field(
        None, description="행동으로 인해 나타난 결과 및 정량적, 정성적 성과"
    )


# 추가 질문
class FollowUpQuestion(BaseModel):

    type: Literal[
        "situation", "task", "action", "result"
    ] = Field(
        ..., description="추가 보완이 필요한 STAR 항목"
    )

    question: str = Field(
        ..., description="해당 항목을 구체화하기 위한 질문"
    )


# 최초 경험 입력
class InitAgentInput(BaseModel):

    title: str = Field(
        ..., description="경험 제목"
    )

    exp: str = Field(
        ..., description="사용자가 자유롭게 작성한 경험 내용"
    )


# 최초 경험 분석 결과
class InitAgentOutput(BaseModel):

    star: STAR = Field(
        ..., description="사용자 경험을 STAR 기법으로 구조화한 결과"
    )

    follow_up: List[FollowUpQuestion] = Field(
        default_factory=list,
        description="STAR 항목 중 구체화가 필요한 부분에 대한 추가 질문"
    )




###################-2차 에이전트 스키마-##################



# 추가 질문 답변
class FollowUpAnswer(BaseModel):

    type: Literal[
        "situation", "task", "action", "result"
    ] = Field(
        ..., description="STAR 항목"
    )

    question: str  = Field(
        ..., description="경험 정리 보완을 위한 질문사항"
    )

    answer: str = Field(
        ..., description="사용자의 추가 질문 답변"
    )

class FinalAgentInput(BaseModel):

    original_exp: str
    star: STAR
    follow_up_answers: list[FollowUpAnswer] = Field(
        ...,
        description="추가 질문에 대한 사용자 답변 목록"
    )


class FinalAgentOutput(BaseModel):

    star: STAR = Field(
        ...,
        description="추가 답변을 반영하여 완성한 최종 STAR"
    )

    tags: List[Competency] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="사용자의 실제 행동과 성과로 확인되는 핵심 어필 역량 1~5개"
    )

