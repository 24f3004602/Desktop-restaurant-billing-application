from fastapi import APIRouter, Depends, Request
from fastapi import status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session, require_roles
from app.core.config import get_settings
from app.core.rate_limiter import limiter
from app.core.roles import Role
from app.modules.auth.models import User
from app.modules.auth.schemas import RefreshTokenRequest, LoginRequest, TokenResponse, UserCreate, UserRead, UserUpdate
from app.modules.auth.service import authenticate_user, create_user as create_user_service, get_users, refresh_access, update_user

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.auth_login_rate_limit)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    _ = request
    return authenticate_user(db, payload.username, payload.password)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshTokenRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    return refresh_access(db, payload.refresh_token)


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


@router.patch("/users/{user_id}", response_model=UserRead)
def patch_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_roles(Role.ADMIN)),
) -> User:
    return update_user(db, user_id, payload, current_admin)
