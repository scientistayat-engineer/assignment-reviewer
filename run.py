"""Start the app:  python run.py   ->  http://127.0.0.1:8000"""
import sys
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).parent / "backend"))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
