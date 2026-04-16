from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TableCreate(BaseModel):
    table_number: str
    seats: int = 4
    status: str = "free"
    is_active: bool = True


class TableUpdate(BaseModel):
    table_number: str | None = None
    seats: int | None = None
    status: str | None = None
    is_active: bool | None = None


class TableRead(BaseModel):
    id: int
    table_number: str
    seats: int
    status: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
