"""FastAPI application entry point.

Run with:
    cd backend
    .venv/Scripts/uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import API_V1_PREFIX, CORS_ORIGINS, CORS_ORIGIN_REGEX, DEMO_MODE, DATASET_PATH, VALIDATOR_DIR
from app.routers import assistant as assistant_router
from app.routers import auth as auth_router
from app.routers import bookings as bookings_router
from app.routers import dataset as dataset_router
from app.routers import exams as exams_router
from app.routers import rescheduling as rescheduling_router
from app.routers import settings as settings_router
from app.routers import timetable as timetable_router
from app.services.database import init_db
from app.services.seed_demo import seed_demo_accounts

logger = logging.getLogger(__name__)


def verify_startup_integrity() -> dict[str, Any]:
    """Verify that all core engine components, validator, and dataset are functional.

    Raises:
        RuntimeError: If any critical component fails initialization.
    """
    failures: list[str] = []

    # 1. OR-Tools CP-SAT
    try:
        from ortools.sat.python import cp_model
        _m = cp_model.CpModel()
    except Exception as exc:
        failures.append(f"OR-Tools CP-SAT import failed: {exc}")

    # 2. Official Validator
    try:
        from app.services.validation_service import validator
        if not hasattr(validator, "Ctx") or not hasattr(validator, "check_timetable"):
            failures.append("Official validator is missing Ctx or check_timetable functions")
    except Exception as exc:
        failures.append(f"Official validator import failed from {VALIDATOR_DIR}: {exc}")

    # 3. Dataset Loading
    try:
        from app.services.dataset_service import get_dataset
        ds = get_dataset()
        if not ds.sessions or not ds.rooms:
            failures.append(f"Dataset at {DATASET_PATH} contains 0 sessions or rooms")
    except Exception as exc:
        failures.append(f"Dataset loading failed from {DATASET_PATH}: {exc}")

    # 4. Database initialization
    try:
        init_db()
    except Exception as exc:
        failures.append(f"Database initialization failed: {exc}")

    if failures:
        error_msg = "CIT Campus OS startup verification failed:\n" + "\n".join(f" - {f}" for f in failures)
        logger.error(error_msg)
        raise RuntimeError(error_msg)

    logger.info("Startup verification passed: OR-Tools, Official Validator, and Dataset ready.")
    return {"status": "healthy"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify system integrity, initialize database, and seed demo accounts upon startup."""
    verify_startup_integrity()
    if DEMO_MODE:
        seed_demo_accounts()
    yield


app = FastAPI(
    title="CIT Campus Scheduling & Venue Management API",
    description="Backend API for Chilika Institute of Technology scheduling, timetable, and venue management.",
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — configured via environment variables with regex fallback for Vercel
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(dataset_router.router, prefix=API_V1_PREFIX)
app.include_router(timetable_router.router, prefix=API_V1_PREFIX)
app.include_router(exams_router.router, prefix=API_V1_PREFIX)
app.include_router(bookings_router.router, prefix=API_V1_PREFIX)
app.include_router(rescheduling_router.router, prefix=API_V1_PREFIX)
app.include_router(assistant_router.router, prefix=API_V1_PREFIX)
app.include_router(auth_router.router, prefix=API_V1_PREFIX)
app.include_router(settings_router.router, prefix=API_V1_PREFIX)


# ---------------------------------------------------------------------------
# Health check endpoints
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"], summary="Health check endpoint")
@app.get("/api/health", tags=["health"], summary="API health check alias")
@app.get(f"{API_V1_PREFIX}/health", tags=["health"], summary="Versioned health check alias")
def health() -> dict[str, str]:
    """Verify that the FastAPI service is running and responsive."""
    return {"status": "ok"}
