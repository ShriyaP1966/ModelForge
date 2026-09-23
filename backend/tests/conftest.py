"""
Pytest session bootstrap.

Forces an isolated, disposable database and storage directories *before* any
`app.*` module is imported. Without this, `app.core.config.settings` binds to
the real `modelforge.db` and the real `exports/` folders (its defaults), so
running the test suite would read/write the same database and artifact
directories as the actual running application.
"""
import os
import tempfile
from pathlib import Path

_TEST_TMP_DIR = Path(tempfile.mkdtemp(prefix="modelforge_pytest_"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TEST_TMP_DIR / 'test_modelforge.db').as_posix()}"
os.environ["DATA_DIR"] = str(_TEST_TMP_DIR / "data")
os.environ["MODELS_DIR"] = str(_TEST_TMP_DIR / "models")

import shutil
import pytest


@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_storage():
    yield
    shutil.rmtree(_TEST_TMP_DIR, ignore_errors=True)
