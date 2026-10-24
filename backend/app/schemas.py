"""Pydantic models shared by the API and the LangGraph workflow."""
from typing import Optional

from pydantic import BaseModel, Field


class Criterion(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    max_points: int = Field(ge=1, le=20)
    description: str = Field(default="", max_length=300)


class QuestionIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    text: str = Field(min_length=5, max_length=1000)
    criteria: list[Criterion] = Field(min_length=1, max_length=8)


class ReviewRequest(BaseModel):
    question_id: int
    student_name: str = Field(default="Anonymous", max_length=80)
    answer: str = Field(min_length=3, max_length=6000)


class CriterionScore(BaseModel):
    name: str
    score: int = Field(ge=0)
    comment: str = ""


class LLMReview(BaseModel):
    """Structured output requested from the model."""
    criteria: list[CriterionScore]
    feedback: str
    improvement: str


class TeacherDecision(BaseModel):
    action: str = Field(pattern="^(approve|override)$")
    final_score: Optional[int] = Field(default=None, ge=0, le=10)
    note: str = Field(default="", max_length=500)


class LoginIn(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=1, max_length=100)


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern="^[A-Za-z0-9_.-]+$")
    display_name: str = Field(min_length=2, max_length=60)
    password: str = Field(min_length=6, max_length=100)
