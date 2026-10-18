from uuid import uuid4
from typing import Literal
from pydantic import BaseModel, Field

## Agent 사용을 위한 사용자 입력 스키마
class FollowUpQuestionWithID(BaseModel):
    question_id: int
    type: Literal["situation", "task", "action", "result"]
    question: str


class FollowUpAnswerWithID(BaseModel):
    question_id: int
    answer: str

class FinalUserInput(BaseModel):
    experience_id: int
    follow_up: list[FollowUpAnswerWithID]


## 경험 CRUD 스키마

class ExperienceUpdateInput(BaseModel):
    title: str | None = None
    situation: str | None = None
    task: str | None = None
    action: str | None = None
    result: str | None = None
    tags: list[str] | None = None