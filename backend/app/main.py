from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.core.config import bootstrap_env_file, get_settings
from app.core.exceptions import AppError
from app.core.rate_limiter import limiter
from app.core.roles import Role
from app.core.security import hash_password
from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.logging import configure_logging
from app.models.user import User


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global settings
    bootstrap_env_file()
    get_settings.cache_clear()
    settings = get_settings()
    init_db()
    _seed_default_admin()
    yield


settings = get_settings()
configure_logging()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.exception_handler(AppError)
def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
            }
        },
    )


@app.exception_handler(Exception)
def handle_unexpected_error(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
            }
        },
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _seed_default_admin() -> None:
    db = SessionLocal()
    try:
        exists = db.query(User).filter(User.username == settings.default_admin_username).first()
        if exists:
            return

        admin = User(
            username=settings.default_admin_username,
            full_name="System Admin",
            password_hash=hash_password(settings.default_admin_password),
            role=Role.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
