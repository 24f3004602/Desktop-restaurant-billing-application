from functools import lru_cache
from pathlib import Path
from secrets import token_urlsafe

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_ROOT / ".env"
ENV_EXAMPLE_FILE = BACKEND_ROOT / ".env.example"


def _parse_env(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def _write_env(path: Path, values: dict[str, str]) -> None:
    ordered_keys = sorted(values.keys())
    body = "\n".join(f"{key}={values[key]}" for key in ordered_keys)
    path.write_text(f"{body}\n", encoding="utf-8")


def _is_weak_secret(value: str | None) -> bool:
    if not value:
        return True
    weak_values = {
        "change-this-in-production",
        "replace-me",
        "changeme",
    }
    return value.strip().lower() in weak_values


def _is_weak_password(value: str | None) -> bool:
    if not value:
        return True
    weak_values = {
        "admin123",
        "change-me",
        "replace-me",
        "changeme",
    }
    return value.strip().lower() in weak_values


def bootstrap_env_file() -> None:
    values = _parse_env(ENV_FILE)
    if not values and ENV_EXAMPLE_FILE.exists():
        values = _parse_env(ENV_EXAMPLE_FILE)

    changed = not ENV_FILE.exists()

    if _is_weak_secret(values.get("SECRET_KEY")):
        values["SECRET_KEY"] = token_urlsafe(48)
        changed = True

    if _is_weak_password(values.get("DEFAULT_ADMIN_PASSWORD")):
        values["DEFAULT_ADMIN_PASSWORD"] = token_urlsafe(18)
        changed = True

    if not values.get("DEFAULT_ADMIN_USERNAME"):
        values["DEFAULT_ADMIN_USERNAME"] = "admin"
        changed = True

    if changed:
        _write_env(ENV_FILE, values)


bootstrap_env_file()


class Settings(BaseSettings):
    app_name: str = "Restaurant POS API"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = Field(min_length=32)
    access_token_expire_minutes: int = 60 * 12
    refresh_token_expire_minutes: int = 60 * 24 * 7
    auth_login_rate_limit: str = "5/minute"
    auth_max_failed_attempts: int = 5
    auth_lockout_minutes: int = 15
    default_admin_username: str = "admin"
    default_admin_password: str = Field(min_length=8)
    cors_allowed_origins: list[str] = Field(default_factory=lambda: ["http://127.0.0.1:5173", "http://localhost:5173"])
    database_path: str | None = None

    @property
    def database_url(self) -> str:
        if self.database_path:
            db_path = Path(self.database_path)
            if not db_path.is_absolute():
                db_path = PROJECT_ROOT / db_path
        else:
            db_path = PROJECT_ROOT / "database" / "restaurant_pos.db"

        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path}"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
