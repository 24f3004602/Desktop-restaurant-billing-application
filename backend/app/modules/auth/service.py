from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.auth.models import User
from app.modules.auth.schemas import TokenResponse, UserCreate


def authenticate_user(db: Session, username: str, password: str) -> TokenResponse:
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        raise AuthenticationError("Invalid username or password")

    return TokenResponse(access_token=create_access_token(subject=user.username))


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
