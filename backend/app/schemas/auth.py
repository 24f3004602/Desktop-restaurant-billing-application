from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.roles import Role


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str
    full_name: str | None = None
    password: str
    role: Role


class UserRead(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: Role
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
