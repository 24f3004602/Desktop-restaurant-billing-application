from fastapi import APIRouter, Depends
from fastapi import status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session, require_roles
from app.core.roles import Role
from app.modules.auth.models import User
from app.modules.auth.schemas import LoginRequest, TokenResponse, UserCreate, UserRead
from app.modules.auth.service import authenticate_user, create_user as create_user_service, get_users

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    return authenticate_user(db, payload.username, payload.password)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db_session),
    _admin: User = Depends(require_roles(Role.ADMIN)),
) -> list[User]:
    return get_users(db)


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db_session),
    _admin: User = Depends(require_roles(Role.ADMIN)),
) -> User:
    return create_user_service(db, payload)
