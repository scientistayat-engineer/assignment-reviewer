"""LangSmith helpers. Tracing is switched on by LANGSMITH_* env vars; this module
exports them for the SDK and attaches teacher feedback to runs."""
import os

from ..config import settings


def configure():
    if settings.tracing_active:
        os.environ["LANGSMITH_TRACING"] = "true"
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGSMITH_API_KEY"] = settings.langsmith_key
        os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project
        os.environ["LANGCHAIN_PROJECT"] = settings.langsmith_project
    else:
        os.environ["LANGSMITH_TRACING"] = "false"
        os.environ["LANGCHAIN_TRACING_V2"] = "false"


def send_feedback(run_id: str, key: str, score: float, comment: str = "") -> bool:
    """Attach the teacher's decision to the LangSmith run. Never breaks the app."""
    if not (settings.tracing_active and run_id):
        return False
    try:
        from langsmith import Client
        Client().create_feedback(run_id, key=key, score=score, comment=comment)
        return True
    except Exception:
        return False
