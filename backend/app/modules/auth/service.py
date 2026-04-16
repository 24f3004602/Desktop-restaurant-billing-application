from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, ConflictError, DomainValidationError, NotFoundError
from app.core.roles import Role
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.modules.auth.models import User
from app.modules.auth.schemas import PasswordChangeRequest, TokenResponse, UserCreate, UserUpdate


def _issue_tokens(username: str) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(subject=username),
        refresh_token=create_refresh_token(subject=username),
    )


def authenticate_user(db: Session, username: str, password: str) -> TokenResponse:
    settings = get_settings()
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise AuthenticationError("Invalid username or password")

    now = datetime.utcnow()
    if user.locked_until and user.locked_until > now:
        raise AuthenticationError("Account is temporarily locked due to failed login attempts")

    if not verify_password(password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.auth_max_failed_attempts:
            user.failed_login_attempts = 0
            user.locked_until = now + timedelta(minutes=settings.auth_lockout_minutes)
        db.commit()
        raise AuthenticationError("Invalid username or password")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    db.commit()
    return _issue_tokens(user.username)


def refresh_access(db: Session, refresh_token: str) -> TokenResponse:
    try:
        payload = decode_refresh_token(refresh_token)
    except ValueError as exc:
        raise AuthenticationError(str(exc)) from exc

    username = payload.get("sub")
    if not username:
        raise AuthenticationError("Invalid token subject")

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise AuthenticationError("Inactive or missing user")

    return _issue_tokens(user.username)


def change_current_user_password(db: Session, current_user: User, payload: PasswordChangeRequest) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise AuthenticationError("Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise DomainValidationError("New password must be different from current password")

    current_user.password_hash = hash_password(payload.new_password)
    current_user.failed_login_attempts = 0
    current_user.locked_until = None
    db.commit()


def get_users(db: Session) -> list[User]:
    return db.query(User).order_by(User.id.asc()).all()


def create_user(db: Session, payload: UserCreate) -> User:
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise ConflictError("Username already exists")

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, payload: UserUpdate, current_admin: User) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundError("User not found")

    update_data = payload.model_dump(exclude_unset=True)
    if current_admin.id == user.id:
        if update_data.get("is_active") is False:
            raise DomainValidationError("You cannot deactivate your own account")
        if update_data.get("role") and update_data.get("role") != Role.ADMIN:
            raise DomainValidationError("You cannot demote your own admin role")

    if "password" in update_data and update_data["password"]:
        user.password_hash = hash_password(update_data.pop("password"))
        user.failed_login_attempts = 0
        user.locked_until = None

    for key, value in update_data.items():
        setattr(user, key, value)

    if user.is_active:
        user.failed_login_attempts = 0
        user.locked_until = None

    db.commit()
    db.refresh(user)
    return user
