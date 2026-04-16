from datetime import datetime

from pydantic import BaseModel, ConfigDict


class OrderCreate(BaseModel):
    table_id: int | None = None
    order_type: str
    notes: str | None = None


class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int
    special_note: str | None = None


class OrderItemUpdate(BaseModel):
    quantity: int | None = None
    special_note: str | None = None
    kot_status: str | None = None


class OrderItemRead(BaseModel):
    id: int
    menu_item_id: int
    quantity: int
    unit_price_cents: int
    gst_percent: float
    special_note: str | None
    kot_status: str
    line_subtotal_cents: int
    line_tax_cents: int
    line_total_cents: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderRead(BaseModel):
    id: int
    order_no: str
    table_id: int | None
    order_type: str
    status: str
    created_by: int
    opened_at: datetime
    closed_at: datetime | None
    notes: str | None
    items: list[OrderItemRead]

    model_config = ConfigDict(from_attributes=True)
