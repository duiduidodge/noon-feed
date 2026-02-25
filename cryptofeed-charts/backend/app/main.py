"""
FastAPI application entry point.
Starts the cryptofeed FeedHandler as a background task on startup.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .feed_manager import run_feed
from .routers.ws import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start cryptofeed in a background task
    feed_task = asyncio.create_task(run_feed())
    logger.info("cryptofeed FeedHandler started")
    yield
    feed_task.cancel()
    try:
        await feed_task
    except (asyncio.CancelledError, Exception):
        pass
    logger.info("cryptofeed FeedHandler stopped")


app = FastAPI(title="Cryptofeed Charts API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production if needed
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}
