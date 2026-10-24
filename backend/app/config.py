"""Central configuration, loaded once from the project-level .env file."""
import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = Path(os.getenv("DB_PATH", DATA_DIR / "reviews.db"))
FRONTEND_DIR = PROJECT_ROOT / "frontend"


def _flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    langsmith_tracing = _flag("LANGSMITH_TRACING") or _flag("LANGCHAIN_TRACING_V2")
    langsmith_key = (os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY") or "").strip()
    langsmith_project = os.getenv("LANGSMITH_PROJECT", "assignment-review")
    review_min = int(os.getenv("REVIEW_MIN", "4"))
    review_max = int(os.getenv("REVIEW_MAX", "6"))
    teacher_username = os.getenv("TEACHER_USERNAME", "teacher").strip() or "teacher"
    teacher_password = os.getenv("TEACHER_PASSWORD", "teacher123")
    secret_key = os.getenv("SECRET_KEY", "dev-secret-change-me")
    session_hours = int(os.getenv("SESSION_HOURS", "12"))

    @property
    def mock_mode(self) -> bool:
        return _flag("MOCK_LLM") or not self.groq_api_key

    @property
    def tracing_active(self) -> bool:
        return self.langsmith_tracing and bool(self.langsmith_key)


settings = Settings()
