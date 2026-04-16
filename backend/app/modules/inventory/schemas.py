from pydantic import BaseModel

from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.schemas.menu_item import MenuItemCreate, MenuItemRead, MenuItemUpdate
from app.schemas.restaurant_table import TableCreate, TableRead, TableUpdate


class AvailabilityUpdate(BaseModel):
    is_available: bool


class TableStatusUpdate(BaseModel):
    status: str


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
]
