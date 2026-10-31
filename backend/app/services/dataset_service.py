"""Dataset service — loads, validates, and caches the CIT dataset.

Provides robust error handling for:
  - Missing dataset file (DatasetFileNotFoundError)
  - Invalid JSON syntax (DatasetInvalidJSONError)
  - Missing required top-level keys (DatasetKeyMissingError)
  - Incorrect data types / schema mismatches (DatasetTypeError)

Source JSON is loaded dynamically and validated strictly without modifying the original data.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.config import DATASET_PATH
from app.models.dataset import Dataset, DatasetSummary

# Required top-level keys in cit_public.json
REQUIRED_TOP_LEVEL_KEYS: frozenset[str] = frozenset(
    {
        "dataset_id",
        "institute",
        "calendar",
        "priority_order",
        "role_category_cap",
        "rooms",
        "room_unavailability",
        "faculty",
        "student_groups",
        "courses",
        "sessions",
        "booking_requests",
        "cancellations",
        "exams",
    }
)


# ---------------------------------------------------------------------------
# Custom exceptions for clear, actionable error handling
# ---------------------------------------------------------------------------

class DatasetError(Exception):
    """Base exception for all dataset-related errors."""


class DatasetFileNotFoundError(DatasetError, FileNotFoundError):
    """Raised when the dataset file does not exist at the specified path."""


class DatasetInvalidJSONError(DatasetError, ValueError):
    """Raised when the dataset file does not contain valid JSON syntax."""


class DatasetKeyMissingError(DatasetError, KeyError):
    """Raised when required top-level keys are absent from the dataset JSON."""


class DatasetTypeError(DatasetError, TypeError, ValueError):
    """Raised when data types or nested schemas fail validation."""


# ---------------------------------------------------------------------------
# Core loading & validation functions
# ---------------------------------------------------------------------------

def load_dataset_from_path(file_path: Path | str) -> Dataset:
    """Read, parse, and validate a dataset JSON file from disk.

    Raises:
        DatasetFileNotFoundError: If the file does not exist or is not a file.
        DatasetInvalidJSONError: If the file content is not valid JSON.
        DatasetTypeError: If the root is not an object or types do not match schema.
        DatasetKeyMissingError: If any required top-level key is missing.
    """
    path = Path(file_path).resolve()

    if not path.exists() or not path.is_file():
        raise DatasetFileNotFoundError(f"Dataset file not found at path: {path}")

    try:
        content = path.read_text(encoding="utf-8")
    except Exception as exc:
        raise DatasetFileNotFoundError(f"Could not read dataset file at {path}: {exc}") from exc

    try:
        raw_data: Any = json.loads(content)
    except json.JSONDecodeError as exc:
        raise DatasetInvalidJSONError(
            f"Dataset at {path} contains invalid JSON syntax: {exc}"
        ) from exc

    if not isinstance(raw_data, dict):
        raise DatasetTypeError(
            f"Dataset root must be a JSON object (dict), got {type(raw_data).__name__}"
        )

    # Check for required top-level keys
    missing_keys = REQUIRED_TOP_LEVEL_KEYS - set(raw_data.keys())
    if missing_keys:
        raise DatasetKeyMissingError(
            f"Dataset is missing required top-level keys: {sorted(missing_keys)}"
        )

    # Validate full schema and data types using Pydantic
    try:
        return Dataset.model_validate(raw_data)
    except ValidationError as exc:
        raise DatasetTypeError(
            f"Dataset structure or data types failed schema validation:\n{exc}"
        ) from exc


@lru_cache(maxsize=1)
def get_dataset() -> Dataset:
    """Retrieve the cached Dataset instance loaded from the default DATASET_PATH.

    The dataset is parsed and validated once and cached for high performance.
    """
    return load_dataset_from_path(DATASET_PATH)


def load_dataset(file_path: Path | str | None = None) -> Dataset:
    """Load a dataset, optionally from a custom path, without modifying the source."""
    if file_path is None:
        return get_dataset()
    return load_dataset_from_path(file_path)


def get_dataset_summary(dataset: Dataset | None = None) -> DatasetSummary:
    """Calculate summary statistics for the dataset."""
    ds = dataset or get_dataset()
    return DatasetSummary(
        dataset_id=ds.dataset_id,
        institute=ds.institute,
        total_rooms=len(ds.rooms),
        total_faculty=len(ds.faculty),
        total_student_groups=len(ds.student_groups),
        total_courses=len(ds.courses),
        total_sessions=len(ds.sessions),
        total_booking_requests=len(ds.booking_requests),
        total_cancellations=len(ds.cancellations),
        total_exams=len(ds.exams),
        total_room_unavailability=len(ds.room_unavailability),
    )


# ---------------------------------------------------------------------------
# DatasetService class wrapper for OOP usage
# ---------------------------------------------------------------------------

class DatasetService:
    """Encapsulates dataset loading, validation, and querying operations."""

    def __init__(self, dataset_path: Path | str | None = None) -> None:
        self.dataset_path = Path(dataset_path).resolve() if dataset_path else DATASET_PATH

    def load(self) -> Dataset:
        """Load and return the dataset from the configured path."""
        return load_dataset_from_path(self.dataset_path)

    @classmethod
    def get_dataset(cls) -> Dataset:
        """Get the cached default dataset."""
        return get_dataset()

    @classmethod
    def get_summary(cls, dataset: Dataset | None = None) -> DatasetSummary:
        """Get dataset summary statistics."""
        return get_dataset_summary(dataset)

    @classmethod
    def clear_cache(cls) -> None:
        """Clear the lru_cache for get_dataset."""
        get_dataset.cache_clear()
