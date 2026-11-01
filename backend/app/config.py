"""Application configuration — resolved robustly via pathlib with safe defaults."""

from __future__ import annotations

import os
from pathlib import Path

# Backend application root (where app/ resides)
# config.py is at backend/app/config.py -> parent is app/ -> parent.parent is backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Repo root is one level above backend/
REPO_ROOT = BACKEND_ROOT.parent

# ---------------------------------------------------------------------------
# Dataset Path Resolution
# ---------------------------------------------------------------------------
def _resolve_dataset_path() -> Path:
    env_path = os.getenv("DATASET_PATH")
    if env_path:
        cand = Path(env_path)
        if cand.is_absolute() and cand.exists():
            return cand
        for root in (BACKEND_ROOT, REPO_ROOT):
            if (root / cand).exists():
                return (root / cand).resolve()

    # Search candidates in priority order (prefer self-contained backend assets)
    candidates = [
        BACKEND_ROOT / "deployment_assets" / "cit_public.json",
        BACKEND_ROOT / "data" / "cit_public.json",
        BACKEND_ROOT / "starter-pack" / "CrunchWeek_StarterPack" / "data" / "cit_public.json",
        REPO_ROOT / "data" / "cit_public.json",
        REPO_ROOT / "starter-pack" / "CrunchWeek_StarterPack" / "data" / "cit_public.json",
    ]
    for cand in candidates:
        if cand.exists():
            return cand.resolve()

    # Default fallback
    return (BACKEND_ROOT / "deployment_assets" / "cit_public.json").resolve()

DATASET_PATH: Path = _resolve_dataset_path()
DEFAULT_DATASET_PATH: Path = DATASET_PATH

# ---------------------------------------------------------------------------
# Validator Directory Resolution
# ---------------------------------------------------------------------------
def _resolve_validator_dir() -> Path:
    env_dir = os.getenv("VALIDATOR_DIR")
    if env_dir:
        cand = Path(env_dir)
        if cand.is_absolute() and (cand / "validator.py").exists():
            return cand
        for root in (BACKEND_ROOT, REPO_ROOT):
            if (root / cand / "validator.py").exists():
                return (root / cand).resolve()

    # Search candidates containing official validator.py
    candidates = [
        BACKEND_ROOT / "starter-pack" / "CrunchWeek_StarterPack",
        BACKEND_ROOT / "deployment_assets" / "starter-pack" / "CrunchWeek_StarterPack",
        REPO_ROOT / "starter-pack" / "CrunchWeek_StarterPack",
    ]
    for cand in candidates:
        if (cand / "validator.py").exists():
            return cand.resolve()

    # Default fallback
    return (BACKEND_ROOT / "starter-pack" / "CrunchWeek_StarterPack").resolve()

VALIDATOR_DIR: Path = _resolve_validator_dir()

# ---------------------------------------------------------------------------
# Sample Disruption Path Resolution
# ---------------------------------------------------------------------------
def _resolve_disruption_sample_path() -> Path:
    env_path = os.getenv("DISRUPTION_SAMPLE_PATH")
    if env_path:
        cand = Path(env_path)
        if cand.is_absolute() and cand.exists():
            return cand
        for root in (BACKEND_ROOT, REPO_ROOT):
            if (root / cand).exists():
                return (root / cand).resolve()

    candidates = [
        BACKEND_ROOT / "deployment_assets" / "sample_disruption.json",
        BACKEND_ROOT / "starter-pack" / "CrunchWeek_StarterPack" / "examples" / "sample_disruption.json",
        REPO_ROOT / "starter-pack" / "CrunchWeek_StarterPack" / "examples" / "sample_disruption.json",
    ]
    for cand in candidates:
        if cand.exists():
            return cand.resolve()

    return (BACKEND_ROOT / "deployment_assets" / "sample_disruption.json").resolve()

DISRUPTION_SAMPLE_PATH: Path = _resolve_disruption_sample_path()

# ---------------------------------------------------------------------------
# Exports and Runtime Storage
# ---------------------------------------------------------------------------
is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))

_raw_exports = os.getenv("EXPORTS_DIR")
if _raw_exports:
    EXPORTS_DIR = Path(_raw_exports).resolve()
elif is_serverless:
    EXPORTS_DIR = Path("/tmp/exports")
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

# ---------------------------------------------------------------------------
# CORS Configuration
# ---------------------------------------------------------------------------
_default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_env_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "").split(",")
    if o.strip()
]
frontend_url = os.getenv("FRONTEND_URL", "").strip()
if frontend_url and frontend_url not in _env_origins:
    _env_origins.append(frontend_url)

CORS_ORIGINS: list[str] = _env_origins if _env_origins else _default_origins
CORS_ORIGIN_REGEX: str = os.getenv("CORS_ORIGIN_REGEX", r"^https:\/\/.*\.vercel\.app$")

# API version prefix
API_V1_PREFIX = "/api/v1"

# ---------------------------------------------------------------------------
# Database & Authentication Configuration
# ---------------------------------------------------------------------------
if is_serverless and not os.getenv("DATABASE_PATH"):
    DATABASE_PATH: Path = Path("/tmp/cit_campus.db").resolve()
else:
    DATABASE_PATH: Path = Path(os.getenv("DATABASE_PATH", str(BACKEND_ROOT / "cit_campus.db"))).resolve()

DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")
SECRET_KEY: str = os.getenv("SECRET_KEY", "cit-campus-management-secure-demo-secret-key-2026")
