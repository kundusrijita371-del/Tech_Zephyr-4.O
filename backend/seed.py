"""Standalone entry point to seed judge demo accounts.

Usage:
    cd backend
    .venv/Scripts/python seed.py
"""

import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.seed_demo import seed_demo_accounts

if __name__ == "__main__":
    print("Seeding CIT judge demo accounts...")
    res = seed_demo_accounts(force=True)
    print(f"Result: {res['total']} accounts processed ({res['created']} created, {res['updated']} updated).")
