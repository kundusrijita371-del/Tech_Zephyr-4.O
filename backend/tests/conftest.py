"""Shared pytest fixtures for the backend test suite."""

from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    """A TestClient that reuses the same app (and dataset cache) for the whole session.

    Must be used as a context manager in newer Starlette versions to properly
    start and stop the ASGI lifespan.
    """
    with TestClient(app) as c:
        yield c
