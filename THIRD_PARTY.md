# Third-Party Libraries & Attributions

This project integrates the following open-source libraries and services:

### 1. Backend Core & Optimization
- **Google OR-Tools** (v9.15+) — *Apache License 2.0*  
  Used for CP-SAT constraint satisfaction programming in the Regular Timetable Solver, Examination Seating Solver, and Disruption Repair Solver.
- **FastAPI** (v0.162+) — *MIT License*  
  Powers the high-performance asynchronous REST API backend.
- **Pydantic** (v2.14+) — *MIT License*  
  Provides robust data validation and type enforcement for datasets, schedules, disruption payloads, and AI assistant schemas.
- **Uvicorn** (v0.54+) — *BSD 3-Clause License*  
  ASGI web server running the FastAPI application.
- **HTTPX** (v0.28+) — *BSD 3-Clause License*  
  Asynchronous and synchronous HTTP client used for Google Gemini API integration and test client requests.

### 2. Frontend & User Interface
- **Next.js** (v16.4+) — *MIT License*  
  App Router framework powering the campus management dashboard.
- **React** (v19+) — *MIT License*  
  Component library for the interactive dashboard, timetable grid, exam allocator, venue manager, and AI chat view.
- **Tailwind CSS** (v4+) — *MIT License*  
  Utility-first CSS framework for clean, responsive university administration styling.

### 3. Artificial Intelligence & NLP
- **Google Gemini 2.0 Flash API** — *Google APIs Terms of Service*  
  Provides natural language parsing and intent extraction for English and Hinglish inquiries.
- **In-Memory Fallback Parser** — *Custom CIT Implementation*  
  Pure Python regex and semantic keyword engine ensuring 100% offline uptime without external dependencies.

### 4. Official Evaluation Benchmark
- **CrunchWeek Starter Pack (`validator.py`)**  
  Untouched official evaluation suite verifying timetable hard constraints (H1–H14), midsem exam capacity rules, and Spectra Week booking constraints.

