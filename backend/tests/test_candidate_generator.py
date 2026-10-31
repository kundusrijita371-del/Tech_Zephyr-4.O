"""Tests for CandidateGenerator covering filtering and domain rules."""

from __future__ import annotations

import copy
import pytest

from app.engine.candidate_generator import CandidateGenerator
from app.models.dataset import FixedSlot, Session
from app.services.dataset_service import get_dataset


@pytest.fixture(scope="module")
def dataset():
    return get_dataset()


@pytest.fixture(scope="module")
def generator(dataset):
    return CandidateGenerator(dataset)


class TestCandidateGenerator:
    """Verifies pre-filtering logic for feasible candidate placement generation."""

    def test_all_189_sessions_have_candidates(self, generator, dataset) -> None:
        """Every session in cit_public.json must have at least one feasible candidate."""
        candidates, diags = generator.generate_all()
        assert len(candidates) == len(dataset.sessions) == 189
        for sid, cands in candidates.items():
            assert len(cands) > 0, f"Session {sid} has 0 candidates: {diags.get(sid)}"

    def test_no_lunch_crossing_in_candidates(self, generator) -> None:
        """No candidate placement may cross the lunch boundary (between P5 and P6)."""
        candidates, _ = generator.generate_all()
        lunch_boundary = generator.lunch_after_period  # 5
        for sid, cands in candidates.items():
            for c in cands:
                # Rule: pers[0] <= 5 < pers[-1] is forbidden
                assert not (c.periods[0] <= lunch_boundary < c.periods[-1]), (
                    f"Candidate for {sid} crosses lunch: {c.day} P{c.periods}"
                )

    def test_lab_candidates_start_only_at_p2_or_p6(self, generator, dataset) -> None:
        """3-hour lab sessions must strictly start at Period 2 or Period 6."""
        candidates, _ = generator.generate_all()
        lab_starts = generator.lab_start_periods  # {2, 6}
        for session in dataset.sessions:
            if session.kind == "lab":
                cands = candidates[session.id]
                assert len(cands) > 0
                for c in cands:
                    assert c.start_period in lab_starts, (
                        f"Lab candidate {c} does not start at P2 or P6"
                    )
                    assert c.duration == 3
                    assert c.periods in ([2, 3, 4], [6, 7, 8])

    def test_room_capacity_and_type_matching(self, generator, dataset) -> None:
        """Every candidate room must match required room types and capacity >= size."""
        candidates, _ = generator.generate_all()
        rooms_by_id = {r.id: r for r in dataset.rooms}
        for session in dataset.sessions:
            for c in candidates[session.id]:
                room = rooms_by_id[c.room_id]
                assert room.type in session.room_types, (
                    f"Room {room.id} type {room.type} not in {session.room_types} for {session.id}"
                )
                assert room.capacity >= session.size, (
                    f"Room {room.id} capacity {room.capacity} < session size {session.size} for {session.id}"
                )

    def test_accessibility_filtering(self, generator, dataset) -> None:
        """If session requires accessibility, candidate rooms must be accessible."""
        candidates, _ = generator.generate_all()
        rooms_by_id = {r.id: r for r in dataset.rooms}
        for session in dataset.sessions:
            if session.needs_accessible:
                for c in candidates[session.id]:
                    room = rooms_by_id[c.room_id]
                    assert room.accessible is True, (
                        f"Session {session.id} requires accessible room, but {room.id} is not accessible."
                    )

    def test_faculty_unavailability_filtered(self, generator, dataset) -> None:
        """No candidate placement may overlap with its faculty's unavailable slots."""
        candidates, _ = generator.generate_all()
        fac_unavail = generator.faculty_unavail
        for session in dataset.sessions:
            for c in candidates[session.id]:
                for p in c.periods:
                    assert (session.faculty_id, c.day, p) not in fac_unavail, (
                        f"Candidate for {session.id} overlaps unavailable slot: "
                        f"{session.faculty_id} on {c.day} P{p}"
                    )

    def test_room_unavailability_filtered(self, generator, dataset) -> None:
        """No candidate placement may overlap with room maintenance windows."""
        candidates, _ = generator.generate_all()
        room_unavail = generator.room_unavail
        for session in dataset.sessions:
            for c in candidates[session.id]:
                for p in c.periods:
                    assert (c.room_id, c.day, p) not in room_unavail, (
                        f"Candidate for {session.id} in room {c.room_id} overlaps unavailable: "
                        f"{c.day} P{p}"
                    )

    def test_fixed_slot_filtering(self, generator, dataset) -> None:
        """If a session has a fixed slot, candidate placements must strictly adhere to it."""
        # Create a copy of a session with a fixed slot
        sample = dataset.sessions[0]
        fixed_session = sample.model_copy(
            update={"fixed_slot": FixedSlot(day="THU", start_period=6)}
        )
        cands, _ = generator.generate_candidates_for_session(fixed_session)
        assert len(cands) > 0
        for c in cands:
            assert c.day == "THU"
            assert c.start_period == 6

    def test_candidate_diagnostics_when_infeasible(self, generator, dataset) -> None:
        """A session with impossible requirements must return an empty list and diagnostics."""
        impossible_session = Session(
            id="IMPOSSIBLE-01",
            course_id="CS999",
            kind="lecture",
            groups=["Y1-A"],
            faculty_id="F01",
            size=9999,  # No room on campus seats 9999 students
            duration=1,
            room_types=["classroom"],
            needs_accessible=False,
            basket_slot=None,
            fixed_slot=None,
        )
        cands, diag = generator.generate_candidates_for_session(impossible_session)
        assert len(cands) == 0
        assert len(diag.reasons) > 0
        assert any("capacity" in r.lower() or "compatible" in r.lower() for r in diag.reasons)

