from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

# Use PBKDF2 to avoid bcrypt backend issues across Python/bcrypt versions.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def _create_token(subject: str, token_type: str, expires_minutes: int) -> str:
    settings = get_settings()
    expire_delta = timedelta(minutes=expires_minutes)
    expire = datetime.now(timezone.utc) + expire_delta
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": token_type}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    return _create_token(subject, token_type="access", expires_minutes=expires_minutes or settings.access_token_expire_minutes)


def create_refresh_token(subject: str, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    return _create_token(subject, token_type="refresh", expires_minutes=expires_minutes or settings.refresh_token_expire_minutes)


def _decode_token(token: str, expected_type: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError as exc:
        raise ValueError("Invalid authentication token") from exc

    token_type = payload.get("type")
    if expected_type == "access" and token_type not in {"access", None}:
        raise ValueError("Invalid access token")
    if expected_type == "refresh" and token_type != "refresh":
        raise ValueError("Invalid refresh token")

    return payload


def decode_access_token(token: str) -> dict[str, Any]:
    return _decode_token(token, expected_type="access")


def decode_refresh_token(token: str) -> dict[str, Any]:
    return _decode_token(token, expected_type="refresh")
