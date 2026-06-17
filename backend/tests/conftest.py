"""Shared test fixtures.

The two module-level caches in ``wca_api`` live for the process lifetime, which
would leak state between tests. Clear them before every test so each runs against
a clean slate.
"""

import pytest

from services import wca_api


@pytest.fixture(autouse=True)
def _clear_caches():
    wca_api._competition_cache.clear()
    wca_api._world_record_cache.clear()
    yield
    wca_api._competition_cache.clear()
    wca_api._world_record_cache.clear()
