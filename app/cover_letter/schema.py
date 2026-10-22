from pydantic import BaseModel, Field


class QuestionInput(BaseModel):
    question: str
    max_length: int | None = Field(default=None, gt=0)


class CoverLetterCreate(BaseModel):
    questions: list[QuestionInput] = Field(min_length=1)


class QuestionUpdate(BaseModel):
    question: str | None = None
    max_length: int | None = Field(default=None, gt=0)


class DraftUpdate(BaseModel):
    draft: str


class FollowupAnswer(BaseModel):
    answer: str