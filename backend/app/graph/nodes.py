"""LangGraph nodes. Logic mirrors the teacher's original app.py."""
from ..config import settings
from ..services import llm


def evaluate(state):
    q = state["question"]
    if settings.mock_mode:
        review, mode = llm.demo_review(q, state["answer"]), "demo"
    else:
        review, mode = llm.groq_review(q, state["answer"]), "groq"

    by_name = {c.name.strip().lower(): c for c in review.criteria}
    scores, raw, mx = [], 0, 0
    for c in q["criteria"]:
        got = by_name.get(c["name"].strip().lower())
        s = max(0, min(int(got.score if got else 0), c["max_points"]))  # clamp to rubric
        scores.append({"name": c["name"], "score": s, "max": c["max_points"],
                       "comment": got.comment if got else ""})
        raw += s
        mx += c["max_points"]
    score = round(raw / mx * 10) if mx else 0
    return {"criteria_scores": scores, "raw_total": raw, "max_total": mx, "score": score,
            "feedback": review.feedback, "improvement": review.improvement, "mode": mode}


def route(state) -> str:
    return "teacher_review" if settings.review_min <= state["score"] <= settings.review_max else "finish"


def teacher_review(state):
    return {"status": "Flagged for teacher review.", "needs_teacher": True}


def finish(state):
    return {"status": "Feedback ready.", "needs_teacher": False}
