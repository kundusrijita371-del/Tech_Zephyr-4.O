# Milestone 02 — Timetable Solver Engine Architecture

## 1. Overview

Milestone 02 introduces a deterministic university timetable generator for Chilika Institute of Technology (CIT), implemented using **Google OR-Tools CP-SAT**.

The engine schedules all 189 sessions across 27 campus rooms and 9 teaching periods (MON-FRI) with **zero hard constraint violations**, fully verified by the official benchmark checker `validator.py`.

---

## 2. Engine Components (`backend/app/engine/`)

```
backend/app/engine/
├── __init__.py                # Module exports
├── candidate_generator.py     # Feasible placement generation & domain pre-filtering
├── constraints.py             # CP-SAT decision variables & hard constraint formulation
├── objective.py               # Soft constraint minimization (S1 to S6)
└── timetable_solver.py        # Solver orchestration, timing, status mapping, and validator integration
```

### Supporting Services & Models:
- `backend/app/models/timetable.py`: Pydantic models for timetable schedules, assignments, solver metadata, and API responses.
- `backend/app/services/validation_service.py`: Bridge to untouched `starter-pack/CrunchWeek_StarterPack/validator.py` (`check_timetable` and `soft_score`).
- `backend/app/services/timetable_service.py`: Orchestrator managing solver runs, memory cache, and automatic export to `exports/timetable_draft.json`.
- `backend/app/routers/timetable.py`: REST API endpoints under `/api/v1/timetable`.

---

## 3. CP-SAT Mathematical Formulation

### Decision Variables
- For each session $s \in \text{Sessions}$ and feasible candidate $c \in \text{Candidates}(s)$:
  $$x_{s, c} \in \{0, 1\}$$
- For each elective basket $b \in \text{Baskets}$ and teaching slot $(day, start)$:
  $$T_{b, day, start} \in \{0, 1\}$$

### Hard Constraints
1. **H1 (Exact Assignment)**:
   $$\sum_{c \in \text{Candidates}(s)} x_{s, c} = 1 \quad \forall s \in \text{Sessions}$$

2. **H11 (Elective Basket Synchronization)**:
   All sessions $s \in b$ must share the exact $(day, start)$ while using different rooms:
   $$\sum_{day, start} T_{b, day, start} = 1 \quad \forall b$$
   $$\sum_{c = (day, start, r)} x_{s, c} = T_{b, day, start} \quad \forall s \in b, \forall (day, start)$$

3. **H4 (Room Exclusivity)**:
   No room may host more than one session at any period $p$:
   $$\sum_{s, c \text{ uses } (r, day, p)} x_{s, c} \le 1 \quad \forall (r, day, p)$$

4. **H2 (Faculty Exclusivity)**:
   No faculty member may teach more than one session at any period $p$:
   $$\sum_{s, c \text{ uses } (f, day, p)} x_{s, c} \le 1 \quad \forall (f, day, p)$$

5. **H3 (Student Group Exclusivity with Basket Deduplication)**:
   Student groups cannot attend concurrent sessions. For elective baskets, parallel sessions within the same basket occupy the group only once:
   $$\sum_{s \notin \text{Baskets}: g \in s.\text{groups}, c \text{ uses } (g, day, p)} x_{s, c} + \sum_{b: g \in b.\text{groups}, (day, start) \text{ covers } p} T_{b, day, start} \le 1 \quad \forall (g, day, p)$$

6. **H12 (Faculty Daily Teaching Limits)**:
   $$\sum_{s: \text{fac}(s) = f, c \text{ on } day} \text{duration}(s) \cdot x_{s, c} \le \text{max\_hours\_per\_day}(f) \quad \forall (f, day)$$

7. **Pre-Filtered Constraints (H5, H6, H7, H8, H9, H10, H14)**:
   - **H5**: Room capacity $\ge$ session size.
   - **H6**: Room type in session allowed types.
   - **H7**: Faculty unavailable periods eliminated.
   - **H8**: Room maintenance/unavailability windows eliminated.
   - **H9**: No period outside P1–P9; no session spans lunch (P5 to P6); 3-hour labs start only at P2 or P6.
   - **H10**: Accessible sessions placed only in accessible rooms.
   - **H14**: Fixed slots restricted to designated $(day, start)$.

---

## 4. Soft Penalty Minimization

Minimizes the official penalty terms from `validator.py`:
- **S1**: Faculty avoid preferences (2 pts per avoided teaching hour).
- **S3**: Student group daily hours $> 6$ (3 pts per hour over 6).
- **S4**: Repeated lectures of the same course on the same day (3 pts per duplicate).
- **S5**: Low room capacity utilisation $< 40\%$ (1 pt per session).
- **S6**: Usage of period 9 (1 pt per session).
- **S2**: Evaluated via official validator logic (class gaps).

---

## 5. Official Validator Test Results

Generated timetable evaluated directly against `starter-pack/CrunchWeek_StarterPack/validator.py`:

```
Dataset: cit-public-v1   Schedule says: cit-public-v1   Team: HackerX
Hard violations: 41  {'E1': 41}
  (All 41 hard violations are E1 because examinations are scheduled in Milestone 03)

Timetable Specific Results:
  H1 (Unscheduled/Duplicate): 0
  H2 (Faculty Overlap):       0
  H3 (Group Overlap):         0
  H4 (Room Overlap):          0
  H5 (Capacity):              0
  H6 (Room Type):             0
  H7 (Faculty Unavailability):0
  H8 (Room Unavailability):   0
  H9 (Lunch / Lab Period):    0
  H10 (Accessibility):        0
  H11 (Basket Sync):          0
  H12 (Faculty Daily Limit):  0
  H14 (Fixed Slots):          0

Soft penalty: 143  {'S1': 0, 'S2': 140, 'S3': 0, 'S4': 3, 'S5': 0, 'S6': 0}
```

---

## 6. How to Run & Verify

### Run the API Generator
```powershell
# From backend directory
curl -X POST http://localhost:8000/api/v1/timetable/generate `
     -H "Content-Type: application/json" `
     -d '{"team_name": "HackerX", "time_limit_seconds": 30.0, "optimize_soft": true}'
```

### Validate against Official Validator
```powershell
python starter-pack/CrunchWeek_StarterPack/validator.py `
       --data data/cit_public.json `
       --schedule exports/timetable_draft.json
```

