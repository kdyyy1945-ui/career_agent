from pydantic import BaseModel, Field


class RegisterInput(BaseModel):
    login_id: str = Field(min_length=2)
    password: str = Field(min_length=2)
    name: str = Field(min_length=2)


class LoginInput(BaseModel):
    login_id: str
    password: str