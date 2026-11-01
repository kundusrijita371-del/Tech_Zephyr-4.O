"""Fallback entrypoint for serverless environments."""

from app.main import app

__all__ = ["app"]

