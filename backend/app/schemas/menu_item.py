from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MenuItemCreate(BaseModel):
    category_id: int
    name: str
    description: str | None = None
    price_cents: int
    gst_percent: float = 5.0
    is_available: bool = True


class MenuItemUpdate(BaseModel):
    category_id: int | None = None
    name: str | None = None
    description: str | None = None
    price_cents: int | None = None
    gst_percent: float | None = None
    is_available: bool | None = None


class MenuItemRead(BaseModel):
    id: int
    category_id: int
    name: str
    description: str | None
    price_cents: int
    gst_percent: float
    is_available: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
