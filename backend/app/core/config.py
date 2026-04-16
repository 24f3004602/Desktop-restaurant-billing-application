from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Restaurant POS API"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "change-this-in-production"
    access_token_expire_minutes: int = 60 * 12
    default_admin_username: str = "admin"
    default_admin_password: str = "admin123"
    database_path: str | None = None

    @property
    def database_url(self) -> str:
        if self.database_path:
            db_path = Path(self.database_path)
            if not db_path.is_absolute():
                root_dir = Path(__file__).resolve().parents[3]
                db_path = root_dir / db_path
        else:
            root_dir = Path(__file__).resolve().parents[3]
            db_path = root_dir / "database" / "restaurant_pos.db"

        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path}"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
