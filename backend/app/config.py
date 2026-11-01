"""Application configuration — resolved robustly via pathlib with safe defaults."""

from __future__ import annotations

import os
from pathlib import Path

# Backend application root (where app/ resides)
# config.py is at backend/app/config.py -> parent is app/ -> parent.parent is backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Repo root is one level above backend/
REPO_ROOT = BACKEND_ROOT.parent

# Default dataset path: check bundled backend/data first, then fallback to repo root ../data
_bundled_data = BACKEND_ROOT / "data" / "cit_public.json"
if _bundled_data.exists():
    DEFAULT_DATASET_PATH = _bundled_data.resolve()
else:
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

# Exports directory — resolves to repo exports or local backend exports
_raw_exports = os.getenv("EXPORTS_DIR")
if _raw_exports:
    EXPORTS_DIR = Path(_raw_exports).resolve()
elif (REPO_ROOT / "exports").exists():
    EXPORTS_DIR = (REPO_ROOT / "exports").resolve()
else:
    EXPORTS_DIR = (BACKEND_ROOT / "exports").resolve()
try:
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

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

# Database & Authentication Configuration — on Vercel, use /tmp for write operations
if os.getenv("VERCEL") and not os.getenv("DATABASE_PATH"):
    DATABASE_PATH: Path = Path("/tmp/cit_campus.db").resolve()
else:
    DATABASE_PATH: Path = Path(os.getenv("DATABASE_PATH", str(BACKEND_ROOT / "cit_campus.db"))).resolve()
DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")
SECRET_KEY: str = os.getenv("SECRET_KEY", "cit-campus-management-secure-demo-secret-key-2026")

