"""Settings service managing system configuration, booking priorities, audit logging, and demo resets."""

from __future__ import annotations

import datetime
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.config import (
    API_V1_PREFIX,
    BOOKINGS_DRAFT_PATH,
    DATABASE_PATH,
    DATASET_PATH,
    DEMO_MODE,
    EXAMS_DRAFT_PATH,
    EXPORTS_DIR,
    SCHEDULE_DRAFT_PATH,
    SCHEDULE_FINAL_PATH,
    TIMETABLE_DRAFT_PATH,
)
from app.models.dataset import Dataset
from app.models.settings import (
    CategoryInfo,
    DatasetPreviewResponse,
    DemoResetResponse,
    PriorityOrderResponse,
    SystemStatusResponse,
    ValidatorReportsResponse,
)
from app.services.database import get_db_connection
from app.services.dataset_service import DatasetService, get_dataset
from app.services.seed_demo import seed_demo_accounts

logger = logging.getLogger(__name__)

AUDIT_LOG_PATH: Path = EXPORTS_DIR / "history" / "audit_log.json"

DEFAULT_PRIORITY_ORDER: list[str] = [
    "exam",
    "regular_session",
    "institute_event",
    "guest_lecture",
    "department_event",
    "club_event",
]

CATEGORY_METADATA: dict[str, dict[str, Any]] = {
    "exam": {
        "name": "Exams",
        "description": "Midsem and final semester examinations enforcing 50% capacity and strict clash-free allocations.",
        "official_role_cap": "System",
    },
    "regular_session": {
        "name": "Regular Classes",
        "description": "Mandatory teaching timetable lectures, tutorials, and 3-hour synchronized lab sessions.",
        "official_role_cap": "System",
    },
    "institute_event": {
        "name": "Institute Events",
        "description": "Flagship university gatherings, convocation, and official institutional ceremonies.",
        "official_role_cap": "admin",
    },
    "guest_lecture": {
        "name": "Guest Lectures",
        "description": "Visiting scholar seminars, industry expert colloquiums, and academic lectures.",
        "official_role_cap": "faculty",
    },
    "department_event": {
        "name": "Department Events",
        "description": "Internal departmental workshops, hackathons, and branch-specific technical sessions.",
        "official_role_cap": "department_coordinator",
    },
    "club_event": {
        "name": "Club Events",
        "description": "Student club activities and Spectra festival evening celebrations (subject to the 3-event club cap).",
        "official_role_cap": "club",
    },
}


class SettingsService:
    """Manages application settings, priority queues, and demo environments."""

    @classmethod
    def get_booking_priority(cls) -> list[str]:
        """Fetch the active booking priority order from the database or fall back to default."""
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM system_settings WHERE key = 'booking_priority_order'")
            row = cursor.fetchone()
            if row:
                try:
                    data = json.loads(row["value"])
                    if isinstance(data, list) and len(data) == 6:
                        return data
                except Exception:
                    pass
        except Exception as exc:
            logger.warning("Could not read booking_priority_order from database: %s", exc)
        finally:
            conn.close()

        # Fall back to dataset or default
        try:
            ds = get_dataset()
            if ds and ds.priority_order and len(ds.priority_order) == 6:
                return list(ds.priority_order)
        except Exception:
            pass

        return list(DEFAULT_PRIORITY_ORDER)

    @classmethod
    def get_priority_response(cls) -> PriorityOrderResponse:
        """Construct the complete PriorityOrderResponse with category metadata."""
        current_order = cls.get_booking_priority()
        conn = get_db_connection()
        updated_at = None
        updated_by = None
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT updated_at, updated_by FROM system_settings WHERE key = 'booking_priority_order'")
            row = cursor.fetchone()
            if row:
                updated_at = row["updated_at"]
                updated_by = row["updated_by"]
        finally:
            conn.close()

        categories: list[CategoryInfo] = []
        for idx, cat_id in enumerate(current_order, start=1):
            meta = CATEGORY_METADATA.get(cat_id, {
                "name": cat_id.replace("_", " ").title(),
                "description": "Configured booking event priority stage.",
                "official_role_cap": "Custom",
            })
            categories.append(
                CategoryInfo(
                    id=cat_id,
                    name=meta["name"],
                    rank=idx,
                    description=meta["description"],
                    official_role_cap=meta["official_role_cap"],
                )
            )

        is_default = (current_order == DEFAULT_PRIORITY_ORDER) and (updated_at is None)

        return PriorityOrderResponse(
            priority_order=current_order,
            categories=categories,
            updated_at=updated_at,
            updated_by=updated_by,
            is_default=is_default,
        )

    @classmethod
    def save_booking_priority(cls, new_order: list[str], admin_email: str) -> PriorityOrderResponse:
        """Validate, persist, and apply an updated 6-stage booking priority order."""
        if len(new_order) != 6:
            raise ValueError(f"Priority order must contain exactly 6 categories, got {len(new_order)}.")

        expected = set(DEFAULT_PRIORITY_ORDER)
        provided = set(new_order)
        if provided != expected:
            missing = expected - provided
            extras = provided - expected
            msg_parts = []
            if missing:
                msg_parts.append(f"Missing categories: {missing}")
            if extras:
                msg_parts.append(f"Unrecognized categories: {extras}")
            raise ValueError(f"Invalid priority order list. {'; '.join(msg_parts)}")

        previous_order = cls.get_booking_priority()
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO system_settings (key, value, updated_at, updated_by)
                VALUES ('booking_priority_order', ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at,
                    updated_by = excluded.updated_by
                """,
                (json.dumps(new_order), now, admin_email),
            )
            conn.commit()
        finally:
            conn.close()

        # Update live dataset memory instance
        try:
            ds = get_dataset()
            ds.priority_order = list(new_order)
        except Exception as exc:
            logger.warning("Could not sync priority_order to cached Dataset: %s", exc)

        # Log change into audit trail
        cls.append_audit_log({
            "action": "UPDATE_BOOKING_PRIORITY",
            "admin": admin_email,
            "timestamp": now,
            "previous_order": previous_order,
            "new_order": new_order,
            "reason": "Administrative priority queue order update via Settings module",
        })

        return cls.get_priority_response()

    @classmethod
    def append_audit_log(cls, entry: dict[str, Any]) -> None:
        """Record an administrative action to the persistent audit log JSON file."""
        try:
            AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            entries: list[dict[str, Any]] = []
            if AUDIT_LOG_PATH.exists():
                try:
                    entries = json.loads(AUDIT_LOG_PATH.read_text(encoding="utf-8"))
                except Exception:
                    entries = []
            entries.append(entry)
            AUDIT_LOG_PATH.write_text(json.dumps(entries, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.error("Failed to append to audit log: %s", exc)

    @classmethod
    def get_audit_log(cls, limit: int = 50) -> list[dict[str, Any]]:
        """Retrieve recent administrative audit log entries, newest first."""
        if not AUDIT_LOG_PATH.exists():
            return []
        try:
            entries = json.loads(AUDIT_LOG_PATH.read_text(encoding="utf-8"))
            if isinstance(entries, list):
                return list(reversed(entries))[:limit]
        except Exception as exc:
            logger.error("Failed to read audit log: %s", exc)
        return []

    @classmethod
    def get_system_status(cls) -> SystemStatusResponse:
        """Execute live operational diagnostics across all backend subsystems."""
        # 1. Dataset Diagnostic
        dataset_info: dict[str, Any] = {"loaded": False}
        try:
            ds = get_dataset()
            dataset_info = {
                "loaded": True,
                "dataset_id": ds.dataset_id,
                "institute": ds.institute,
                "total_rooms": len(ds.rooms),
                "total_sessions": len(ds.sessions),
                "total_faculty": len(ds.faculty),
                "total_exams": len(ds.exams),
                "total_bookings": len(ds.booking_requests),
                "file_path": str(DATASET_PATH),
                "exists_on_disk": DATASET_PATH.exists(),
            }
        except Exception as exc:
            dataset_info["error"] = str(exc)

        # 2. Solver Engine Diagnostic
        solver_info: dict[str, Any] = {"available": False}
        try:
            import ortools
            from ortools.sat.python import cp_model
            solver_info = {
                "available": True,
                "engine": "Google OR-Tools CP-SAT",
                "version": getattr(ortools, "__version__", "unknown"),
                "status": "Ready for multi-threaded constraint satisfaction solving",
            }
        except Exception as exc:
            solver_info = {"available": False, "error": str(exc)}

        # 3. AI Copilot Engine Diagnostic
        ai_info: dict[str, Any] = {}
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            ai_info = {
                "status": "configured",
                "provider": "google_gemini",
                "model": "gemini-2.5-flash",
                "mode": "Live LLM Parsing & Conversational Copilot",
            }
        else:
            ai_info = {
                "status": "fallback_active",
                "provider": "deterministic_fallback",
                "model": "rule_based_intent_parser",
                "mode": "Zero-dependency deterministic NLP (Bilingual English & Hinglish)",
            }

        # 4. Database Status
        db_info: dict[str, Any] = {"status": "connected"}
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT count(*) as count FROM users")
            user_count = cursor.fetchone()["count"]
            cursor.execute("SELECT count(*) as count FROM user_sessions")
            session_count = cursor.fetchone()["count"]
            conn.close()
            db_info = {
                "status": "connected",
                "type": "SQLite",
                "path": str(DATABASE_PATH),
                "registered_users": user_count,
                "active_sessions": session_count,
            }
        except Exception as exc:
            db_info = {"status": "error", "error": str(exc)}

        # 5. Output Artifact Existence Checks
        tt_gen = TIMETABLE_DRAFT_PATH.exists()
        ex_gen = EXAMS_DRAFT_PATH.exists()
        bk_gen = BOOKINGS_DRAFT_PATH.exists() or SCHEDULE_DRAFT_PATH.exists()
        res_active = (EXPORTS_DIR / "history" / "schedule_v1.json").exists() or (EXPORTS_DIR / "proposals").exists()

        backend_info = {
            "status": "online",
            "service": "CIT Campus Scheduling API",
            "version": "0.1.0",
            "api_prefix": API_V1_PREFIX,
            "demo_mode": DEMO_MODE,
        }

        return SystemStatusResponse(
            backend=backend_info,
            database=db_info,
            solver=solver_info,
            ai=ai_info,
            dataset=dataset_info,
            timetable_generated=tt_gen,
            exams_generated=ex_gen,
            bookings_generated=bk_gen,
            rescheduling_active=res_active,
        )

    @classmethod
    def get_validator_reports(cls) -> ValidatorReportsResponse:
        """Compile verified reports directly from official validator outputs."""
        from app.services.timetable_service import TimetableService
        from app.services.exam_service import ExamService
        from app.services.booking_service import BookingService
        from app.services.rescheduling_service import ReschedulingService

        # Timetable report
        tt_rep = None
        tt_res = TimetableService.get_latest()
        if tt_res and hasattr(tt_res, "metadata"):
            tt_rep = {
                "is_valid": tt_res.metadata.hard_violation_count == 0,
                "hard_violation_count": tt_res.metadata.hard_violation_count,
                "soft_penalty": tt_res.metadata.soft_penalty,
                "hard_by_rule": tt_res.metadata.hard_by_rule,
                "soft_penalties": tt_res.metadata.soft_penalties,
                "scheduled_sessions": tt_res.metadata.scheduled_sessions,
                "total_sessions": tt_res.metadata.total_sessions,
            }
        elif TIMETABLE_DRAFT_PATH.exists():
            try:
                val = TimetableService.get_validation()
                if val:
                    tt_rep = val.model_dump()
            except Exception:
                pass

        # Exam report
        ex_rep = None
        ex_val = ExamService.get_validation()
        if ex_val:
            ex_rep = ex_val.model_dump()

        # Bookings report
        bk_rep = None
        bk_val = BookingService.get_latest()
        if bk_val and bk_val[1]:
            bk_rep = bk_val[1].model_dump()

        # Disruption report from history
        dis_rep = None
        try:
            history = ReschedulingService.get_history()
            if history:
                latest = history[0]
                dis_rep = latest.model_dump()
        except Exception:
            pass

        return ValidatorReportsResponse(
            timetable=tt_rep,
            exams=ex_rep,
            bookings=bk_rep,
            disruptions=dis_rep,
        )

    @classmethod
    def reset_demo_data(cls, admin_email: str) -> DemoResetResponse:
        """Perform a clean reset of all mutable scheduling state to the official demo baseline."""
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        restored: list[str] = []

        # 1. Reset Booking Priority in Database
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM system_settings WHERE key = 'booking_priority_order'")
            conn.commit()
            restored.append("Booking priority order restored to default [exam -> regular_session -> ...]")
        finally:
            conn.close()

        # 2. Reset Booking In-Memory State & Drafts
        try:
            from app.services.booking_service import BookingService
            BookingService._latest_schedule = None
            BookingService._latest_report = None
            if BOOKINGS_DRAFT_PATH.exists():
                BOOKINGS_DRAFT_PATH.unlink()
            if SCHEDULE_DRAFT_PATH.exists():
                SCHEDULE_DRAFT_PATH.unlink()
            if SCHEDULE_FINAL_PATH.exists():
                SCHEDULE_FINAL_PATH.unlink()
            restored.append("Spectra Fest booking allocations and session overrides cleared")
        except Exception as exc:
            logger.warning("Error clearing booking drafts: %s", exc)

        # 3. Reset Rescheduling Proposals & History
        try:
            from app.services.rescheduling_service import ReschedulingService, PROPOSALS_DIR, HISTORY_DIR
            ReschedulingService._proposals.clear()
            ReschedulingService._version_history.clear()
            if PROPOSALS_DIR.exists():
                shutil.rmtree(PROPOSALS_DIR, ignore_errors=True)
                PROPOSALS_DIR.mkdir(parents=True, exist_ok=True)
            restored.append("Disruption repair proposals and schedule version forks cleared")
        except Exception as exc:
            logger.warning("Error clearing rescheduling state: %s", exc)

        # 4. Clear Timetable and Exam drafts
        if TIMETABLE_DRAFT_PATH.exists():
            TIMETABLE_DRAFT_PATH.unlink()
            restored.append("Timetable draft cleared")
        if EXAMS_DRAFT_PATH.exists():
            EXAMS_DRAFT_PATH.unlink()
            restored.append("Examination hall allocation draft cleared")

        # 5. Reload Dataset & Clear Cache
        DatasetService.clear_cache()
        ds = get_dataset()
        ds.priority_order = list(DEFAULT_PRIORITY_ORDER)
        restored.append("CIT Public Dataset v1 cache reloaded from official cit_public.json")

        # 6. Re-seed Demo Accounts (idempotent, ensures 4 accounts are active)
        seed_demo_accounts()
        restored.append("4 Judge demo accounts verified and re-synchronized")

        # 7. Append audit log
        cls.append_audit_log({
            "action": "DEMO_DATA_RESET",
            "admin": admin_email,
            "timestamp": now,
            "reason": "Complete judge evaluation state reset to baseline benchmark",
            "restored_entities": restored,
        })

        return DemoResetResponse(
            status="success",
            message="Campus scheduling demo data successfully reset to baseline.",
            reset_timestamp=now,
            reset_by=admin_email,
            restored_entities=restored,
        )

    @classmethod
    def preview_dataset(cls, data: dict[str, Any]) -> DatasetPreviewResponse:
        """Validate an uploaded JSON object against the official starter-pack schema without applying it."""
        errors: list[str] = []
        try:
            ds = Dataset.model_validate(data)
            return DatasetPreviewResponse(
                is_valid=True,
                dataset_id=ds.dataset_id,
                institute=ds.institute,
                counts={
                    "rooms": len(ds.rooms),
                    "faculty": len(ds.faculty),
                    "student_groups": len(ds.student_groups),
                    "courses": len(ds.courses),
                    "sessions": len(ds.sessions),
                    "exams": len(ds.exams),
                    "booking_requests": len(ds.booking_requests),
                    "cancellations": len(ds.cancellations),
                },
                validation_errors=[],
            )
        except ValidationError as exc:
            for err in exc.errors():
                loc = " -> ".join(str(x) for x in err["loc"])
                errors.append(f"{loc}: {err['msg']}")
            return DatasetPreviewResponse(
                is_valid=False,
                dataset_id=data.get("dataset_id", "invalid-dataset"),
                institute=data.get("institute", "Unknown Institute"),
                counts={},
                validation_errors=errors[:15],  # First 15 errors
            )
        except Exception as exc:
            return DatasetPreviewResponse(
                is_valid=False,
                dataset_id="unknown",
                institute="Unknown Institute",
                counts={},
                validation_errors=[str(exc)],
            )

    @classmethod
    def apply_dataset(cls, data: dict[str, Any], confirm: bool, admin_email: str) -> dict[str, Any]:
        """Atomically replace the active dataset file after validation and explicit confirmation."""
        if not confirm:
            raise ValueError("Dataset replacement requires explicit confirmation ('confirm': true).")

        # Validate strictly first
        try:
            ds = Dataset.model_validate(data)
        except ValidationError as exc:
            raise ValueError(f"Cannot apply invalid dataset schema: {exc}")

        # Create backup of current file
        now_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = DATASET_PATH.parent / f"cit_public_backup_{now_str}.json"
        if DATASET_PATH.exists():
            shutil.copyfile(DATASET_PATH, backup_path)

        # Write new content
        DATASET_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")

        # Invalidate cache
        DatasetService.clear_cache()

        cls.append_audit_log({
            "action": "REPLACE_DATASET",
            "admin": admin_email,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "new_dataset_id": ds.dataset_id,
            "backup_file": str(backup_path),
            "institute": ds.institute,
        })

        return {
            "status": "success",
            "message": f"Dataset successfully updated to {ds.dataset_id}.",
            "dataset_id": ds.dataset_id,
            "institute": ds.institute,
            "backup_path": str(backup_path),
        }
