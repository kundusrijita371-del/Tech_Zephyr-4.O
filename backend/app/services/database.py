"""SQLite database connection and schema management service.

Provides thread-safe connections, table initialization, and idempotent schema
migrations for CIT campus user and session persistence.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any
from app.config import DATABASE_PATH


def get_db_connection() -> sqlite3.Connection:
    """Return an open SQLite database connection with row factory configured."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize database tables idempotently if they do not exist."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Users table (stores hashed passwords and salts; never plaintext)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                salt TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL,
                department TEXT,
                club TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                is_verified INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # Index for email lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        """)

        # 2. Sessions table (stores active session bearer tokens)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        conn.commit()
    finally:
        conn.close()

