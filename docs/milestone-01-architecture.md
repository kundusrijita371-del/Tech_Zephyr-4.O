# Architecture: Milestone 01 — Dataset Loading & Backend API

## Overview

This document describes the backend and frontend changes implemented in Milestone 01.

## Backend (`backend/`)

### Module structure

```
backend/
├── app/
│   ├── config.py           Settings (dataset path from env, CORS origins, API prefix)
│   ├── main.py             FastAPI app, CORS middleware, router mounting, /health endpoint
│   ├── models/
│   │   └── dataset.py      Pydantic v2 models for every cit_public.json entity
│   ├── services/
│   │   └── dataset_service.py   lru_cache singleton: loads and validates the JSON on first call
│   └── routers/
│       └── dataset.py      GET endpoints under /api/v1/dataset/*
└── tests/
    ├── conftest.py         session-scoped TestClient fixture
    └── test_dataset.py     40 tests (service + API layer)
```

### Key design decisions

| Decision | Rationale |
|---|---|
| `lru_cache(maxsize=1)` on `get_dataset()` | Loads JSON once at startup; deterministic and zero-cost on repeat calls |
| Pydantic v2 `model_validate` on load | Dataset corruption is caught at startup, not mid-request |
| `DATASET_PATH` env var | Judges can point the server at a different JSON without code changes |
| Read-only `GET` endpoints only | No write surface in M01; scheduling mutations come later |
| `response_model=...` on every route | Pydantic serialises + validates outbound data; unknown fields are dropped |

### API endpoints

| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{"status": "ok"}` |
| GET | `/api/v1/dataset/meta` | `DatasetMeta` (counts of all entities) |
| GET | `/api/v1/dataset/calendar` | `Calendar` |
| GET | `/api/v1/dataset/rooms` | `list[Room]` |
| GET | `/api/v1/dataset/rooms/{room_id}` | `Room` / 404 |
| GET | `/api/v1/dataset/faculty` | `list[Faculty]` |
| GET | `/api/v1/dataset/faculty/{faculty_id}` | `Faculty` / 404 |
| GET | `/api/v1/dataset/student-groups` | `list[StudentGroup]` |
| GET | `/api/v1/dataset/courses` | `list[Course]` |
| GET | `/api/v1/dataset/sessions` | `list[Session]` |
| GET | `/api/v1/dataset/sessions/{session_id}` | `Session` / 404 |
| GET | `/api/v1/dataset/booking-requests` | `list[BookingRequest]` |
| GET | `/api/v1/dataset/exams` | `list[Exam]` |

### Running the backend

```bash
cd backend
.venv/Scripts/uvicorn app.main:app --reload
# API docs: http://localhost:8000/docs
```

### Running tests

```bash
cd backend
.venv/Scripts/pytest tests/ -v
# 40 passed in ~0.12s
```

## Frontend (`frontend/src/lib/`)

### Files added

| File | Purpose |
|---|---|
| `src/lib/types.ts` | TypeScript interfaces matching every Pydantic model |
| `src/lib/api.ts` | Typed async fetch wrappers (one function per endpoint) |

### Usage example (Next.js server component)

```tsx
import { getDatasetMeta, listRooms } from "@/lib/api";

export default async function DatasetPage() {
  const [meta, rooms] = await Promise.all([getDatasetMeta(), listRooms()]);
  return <pre>{JSON.stringify({ meta, rooms }, null, 2)}</pre>;
}
```

### Environment variable

Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (copy from `.env.example`).
Defaults to `http://localhost:8000` when unset.

