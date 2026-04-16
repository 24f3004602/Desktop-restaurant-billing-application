from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.schemas.menu_item import MenuItemCreate, MenuItemRead, MenuItemUpdate
from app.schemas.restaurant_table import TableCreate, TableRead, TableUpdate


class AvailabilityUpdate(BaseModel):
    is_available: bool


class TableStatusUpdate(BaseModel):
    status: str


class StockAdjustmentCreate(BaseModel):
    delta_quantity: int
    reason: str = Field(min_length=2, max_length=40)
    note: str | None = Field(default=None, max_length=300)


class StockAdjustmentRead(BaseModel):
    id: int
    menu_item_id: int
    change_quantity: int
    quantity_after: int
    reason: str
    note: str | None
    created_by: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


__all__ = [
    "CategoryCreate",
    "CategoryRead",
    "CategoryUpdate",
    "MenuItemCreate",
    "MenuItemRead",
    "MenuItemUpdate",
    "TableCreate",
    "TableRead",
    "TableUpdate",
    "AvailabilityUpdate",
    "TableStatusUpdate",
    "StockAdjustmentCreate",
    "StockAdjustmentRead",
]
