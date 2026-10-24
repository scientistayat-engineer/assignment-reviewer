from typing import TypedDict


class State(TypedDict, total=False):
    question: dict           # {title, text, criteria[]}
    answer: str
    criteria_scores: list    # [{name, score, max, comment}]
    raw_total: int
    max_total: int
    score: int               # normalised to 0-10 (same scale as the teacher's rule)
    feedback: str
    improvement: str
    status: str
    needs_teacher: bool
    mode: str                # "groq" | "demo"
