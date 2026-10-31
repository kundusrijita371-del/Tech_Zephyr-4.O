"""Repair candidate generator for CIT schedule repair.

Generates candidate placements for disrupted and displaced sessions while enforcing
all official timetable constraints and prioritizing stability (keeping original placements).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.engine.candidate_generator import CandidateGenerator, CandidatePlacement
from app.models.dataset import Dataset, Room, Session


@dataclass(frozen=True)
class RepairPlacement:
    """A feasible candidate placement for a session during timetable repair."""
    session_id: str
    day: str
    start_period: int
    room_id: str
    duration: int
    periods: list[int] = field(default_factory=list)

    # Soft penalties
    cost_s1: int = 0
    cost_s5: int = 0
    cost_s6: int = 0

    # Stability indicators relative to baseline schedule
    is_original: bool = False
    is_same_time: bool = False

    @property
    def stability_penalty(self) -> int:
        """Penalty for deviating from baseline assignment."""
        if self.is_original:
            return 0
        if self.is_same_time:
            return 10  # Room-only change: minimal disruption to faculty/students
        return 100  # Time change: disruptive

    @property
    def time_slot_key(self) -> tuple[str, int]:
        return (self.day, self.start_period)


class RepairCandidateGenerator:
    """Generates repair candidates for all sessions, ensuring minimal disruption."""

    def __init__(
        self,
        dataset: Dataset,
        baseline_timetable: dict[str, tuple[str, int, str]],
        affected_session_ids: set[str],
    ) -> None:
        self.dataset = dataset
        self.baseline_timetable = baseline_timetable
        self.affected_session_ids = affected_session_ids

        # Underlying candidate generator respects all domain rules
        self.cand_gen = CandidateGenerator(dataset)
        self.rooms: dict[str, Room] = {r.id: r for r in dataset.rooms}
        self.sessions: dict[str, Session] = {s.id: s for s in dataset.sessions}

    def generate_all(
        self,
    ) -> tuple[dict[str, list[RepairPlacement]], dict[str, list[str]]]:
        """Generate repair candidate placements for all 189 sessions."""
        all_candidates: dict[str, list[RepairPlacement]] = {}
        diagnostics: dict[str, list[str]] = {}

        for session in self.dataset.sessions:
            sid = session.id
            is_affected = sid in self.affected_session_ids
            orig_placement = self.baseline_timetable.get(sid)

            raw_cands, diag = self.cand_gen.generate_candidates_for_session(session)

            is_orig_feasible = (
                any(
                    c.day == orig_placement[0]
                    and c.start_period == orig_placement[1]
                    and c.room_id == orig_placement[2]
                    for c in raw_cands
                )
                if orig_placement
                else False
            )

            # If original placement is no longer valid in disrupted dataset, mark as affected
            if not is_orig_feasible:
                is_affected = True

            repair_cands: list[RepairPlacement] = []
            for c in raw_cands:
                is_orig = False
                is_same_t = False
                if orig_placement:
                    orig_day, orig_start, orig_room = orig_placement
                    if c.day == orig_day and c.start_period == orig_start:
                        is_same_t = True
                        if c.room_id == orig_room:
                            is_orig = True

                # If session is NOT affected, keep it strictly in its original placement to minimize disruption
                if not is_affected and orig_placement:
                    if not is_orig:
                        continue

                repair_cands.append(
                    RepairPlacement(
                        session_id=sid,
                        day=c.day,
                        start_period=c.start_period,
                        room_id=c.room_id,
                        duration=c.duration,
                        periods=c.periods,
                        cost_s1=c.cost_s1,
                        cost_s5=c.cost_s5,
                        cost_s6=c.cost_s6,
                        is_original=is_orig,
                        is_same_time=is_same_t,
                    )
                )

            if not repair_cands:
                diagnostics[sid] = diag.reasons or [
                    f"No feasible repair placements found for session {sid} after disruption."
                ]

            all_candidates[sid] = repair_cands

        return all_candidates, diagnostics
