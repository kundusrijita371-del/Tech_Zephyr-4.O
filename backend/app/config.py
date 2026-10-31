"""Application configuration — resolved robustly via pathlib with safe defaults."""

from __future__ import annotations

import os
from pathlib import Path

# Backend application root (where app/ resides)
# config.py is at backend/app/config.py -> parent is app/ -> parent.parent is backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Repo root is one level above backend/
REPO_ROOT = BACKEND_ROOT.parent

# Default dataset path is ../data/cit_public.json relative to backend application root
DEFAULT_DATASET_PATH = (BACKEND_ROOT / ".." / "data" / "cit_public.json").resolve()

# Allow override via DATASET_PATH environment variable
_raw_dataset_path = os.getenv("DATASET_PATH")
if _raw_dataset_path:
    candidate = Path(_raw_dataset_path)
    if candidate.is_absolute():
        DATASET_PATH = candidate
    elif (BACKEND_ROOT / candidate).exists():
        DATASET_PATH = (BACKEND_ROOT / candidate).resolve()
    else:
        DATASET_PATH = (REPO_ROOT / candidate).resolve()
else:
    DATASET_PATH = DEFAULT_DATASET_PATH

# Exports directory
EXPORTS_DIR: Path = (REPO_ROOT / "exports").resolve()
TIMETABLE_DRAFT_PATH: Path = EXPORTS_DIR / "timetable_draft.json"
EXAMS_DRAFT_PATH: Path = EXPORTS_DIR / "exams_draft.json"
SCHEDULE_DRAFT_PATH: Path = EXPORTS_DIR / "schedule_draft.json"
SCHEDULE_FINAL_PATH: Path = EXPORTS_DIR / "schedule.json"
BOOKINGS_DRAFT_PATH: Path = EXPORTS_DIR / "bookings_draft.json"

# CORS origins for the frontend dev server (Next.js default is http://localhost:3000)
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

# API version prefix
API_V1_PREFIX = "/api/v1"

# Database & Authentication Configuration
DATABASE_PATH: Path = Path(os.getenv("DATABASE_PATH", str(BACKEND_ROOT / "cit_campus.db"))).resolve()
DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")
SECRET_KEY: str = os.getenv("SECRET_KEY", "cit-campus-management-secure-demo-secret-key-2026")

