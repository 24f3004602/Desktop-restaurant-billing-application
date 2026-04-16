from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MenuItemCreate(BaseModel):
    category_id: int
    name: str
    description: str | None = None
    price_cents: int
    gst_percent: float = 5.0
    is_available: bool = True
    track_inventory: bool = False
    stock_quantity: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=5, ge=0)


class MenuItemUpdate(BaseModel):
    category_id: int | None = None
    name: str | None = None
    description: str | None = None
    price_cents: int | None = None
    gst_percent: float | None = None
    is_available: bool | None = None
    track_inventory: bool | None = None
    stock_quantity: int | None = Field(default=None, ge=0)
    low_stock_threshold: int | None = Field(default=None, ge=0)


class MenuItemRead(BaseModel):
    id: int
    category_id: int
    name: str
    description: str | None
    price_cents: int
    gst_percent: float
    is_available: bool
    track_inventory: bool
    stock_quantity: int
    low_stock_threshold: int
    is_low_stock: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
