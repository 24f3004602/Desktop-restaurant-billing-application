from pathlib import Path
import importlib
import os
import sys

import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    test_db = tmp_path / "pytest-pos.db"

    monkeypatch.setenv("DATABASE_PATH", str(test_db))
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-pytest-0123456789")
    monkeypatch.setenv("DEFAULT_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("DEFAULT_ADMIN_PASSWORD", "admin123")
    monkeypatch.setenv("AUTH_LOGIN_RATE_LIMIT", "1000/minute")
    monkeypatch.setenv("ENV_BOOTSTRAPPED", "1")

    from app.core.config import get_settings

    get_settings.cache_clear()

    import app.db.init_db as init_db_module
    import app.db.session as db_session_module
    import app.main as main_module

    importlib.reload(db_session_module)
    importlib.reload(init_db_module)
    main_module = importlib.reload(main_module)

    auth_router_module = importlib.import_module("app.modules.auth.router")
    auth_router_module.limiter.reset()

    with TestClient(main_module.app) as test_client:
        yield test_client
