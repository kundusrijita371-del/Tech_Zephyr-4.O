import sys
import time
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)
ROOT = Path(r"c:\Users\SUBHAM\CIT-Campus-Management")
sys.path.insert(0, str(ROOT / "backend"))

from app.services.dataset_service import get_dataset
from app.engine.candidate_generator import CandidateGenerator, CandidatePlacement
from app.engine.constraints import TimetableConstraintBuilder
from app.engine.objective import SoftObjectiveBuilder
from ortools.sat.python import cp_model
from validator import Ctx, check_timetable, soft_score

ds = get_dataset()
gen = CandidateGenerator(ds)

def evaluate_strategy(name, room_filter_fn):
    print(f"\n==================== {name} ====================")
    all_cands = {}
    for s in ds.sessions:
        time_slots = gen.get_time_slots_for_session(s)
        compat_rooms = gen.get_compatible_rooms(s)
        
        filtered = room_filter_fn(s, compat_rooms)
        
        cands = []
        dur = s.duration
        for day, start, pers in time_slots:
            for room in filtered:
                if any((room.id, day, p) in gen.room_unavail for p in pers):
                    continue
                c_s1, c_s5, c_s6 = gen.compute_soft_penalties(s, room, day, pers)
                cands.append(CandidatePlacement(
                    session_id=s.id,
                    day=day,
                    start_period=start,
                    room_id=room.id,
                    duration=dur,
                    periods=pers,
                    cost_s1=c_s1,
                    cost_s5=c_s5,
                    cost_s6=c_s6,
                ))
        all_cands[s.id] = cands

    tot = sum(len(c) for c in all_cands.values())
    print(f"Total candidates: {tot} (reduced from 90,280)")
    
    # 1. Test Feasibility
    m_feas = cp_model.CpModel()
    b_feas = TimetableConstraintBuilder(m_feas, ds, all_cands)
    b_feas.build_variables_and_constraints()
    
    s_feas = cp_model.CpSolver()
    s_feas.parameters.max_time_in_seconds = 30.0
    s_feas.parameters.num_workers = 8
    
    t0 = time.perf_counter()
    st_feas = s_feas.Solve(m_feas)
    t_feas = time.perf_counter() - t0
    name_feas = s_feas.StatusName(st_feas)
    print(f"Feasibility: {name_feas} in {t_feas:.2f}s")
    
    # 2. Test Optimization
    m_opt = cp_model.CpModel()
    b_opt = TimetableConstraintBuilder(m_opt, ds, all_cands)
    b_opt.build_variables_and_constraints()
    obj_opt = SoftObjectiveBuilder(m_opt, ds, b_opt)
    obj_opt.build_soft_objective()
    
    s_opt = cp_model.CpSolver()
    s_opt.parameters.max_time_in_seconds = 30.0
    s_opt.parameters.num_workers = 8
    
    t0 = time.perf_counter()
    st_opt = s_opt.Solve(m_opt)
    t_opt = time.perf_counter() - t0
    name_opt = s_opt.StatusName(st_opt)
    print(f"Optimization: {name_opt} in {t_opt:.2f}s")
    
    if name_opt in ("OPTIMAL", "FEASIBLE"):
        assign = {}
        for sid, cands in all_cands.items():
            for idx, c in enumerate(cands):
                if s_opt.Value(b_opt.x_vars[(sid, idx)]) == 1:
                    assign[sid] = (c.day, c.start_period, c.room_id)
                    break
        ctx = Ctx(ds.model_dump())
        v, _ = check_timetable(ctx, assign, "opt")
        pens, tot_pen = soft_score(ctx, assign)
        print(f"Violations: {len(v)}, Soft Score: {tot_pen}")

# Strategy 1: Exclude AUD for small sessions <= 120; exclude LH-1/2 for sessions <= 70
def strat1(s, rooms):
    out = []
    for r in rooms:
        if r.id == "AUD" and s.size <= 120:
            continue
        if r.id in ("LH-1", "LH-2") and s.size <= 70:
            continue
        out.append(r)
    return out

evaluate_strategy("Strategy 1 (Exclude oversized AUD/LH for small sessions)", strat1)

