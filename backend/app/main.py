"""FastAPI entrypoint: serves the REST API and the static frontend."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import db
from .api.routes import router
from .config import FRONTEND_DIR
from .services import tracing


@asynccontextmanager
async def lifespan(_: FastAPI):
    tracing.configure()
    db.init()
    yield


app = FastAPI(title="Assignment Reviewer", version="1.0.0", lifespan=lifespan)
app.include_router(router)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
