"""FastAPI application entry point.

Run with:
    cd backend
    .venv/Scripts/uvicorn app.main:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import API_V1_PREFIX, CORS_ORIGINS
from app.routers import assistant as assistant_router
from app.routers import bookings as bookings_router
from app.routers import dataset as dataset_router
from app.routers import exams as exams_router
from app.routers import rescheduling as rescheduling_router
from app.routers import timetable as timetable_router

app = FastAPI(
    title="CIT Campus Scheduling & Venue Management API",
    description="Backend API for Chilika Institute of Technology scheduling, timetable, and venue management.",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS — configured for local Next.js frontend (default http://localhost:3000)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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


# ---------------------------------------------------------------------------
# Health check endpoint
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"], summary="Health check endpoint")
def health() -> dict[str, str]:
    """Verify that the FastAPI service is running and responsive."""
    return {"status": "ok"}
