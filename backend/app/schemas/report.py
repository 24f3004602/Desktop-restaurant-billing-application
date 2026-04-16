from pydantic import BaseModel


class DailySalesReport(BaseModel):
    date: str
    total_orders: int
    total_sales_cents: int
    total_tax_cents: int
    total_discount_cents: int


class OrderHistoryRow(BaseModel):
    order_id: int
    order_no: str
    status: str
    order_type: str
    table_id: int | None
    opened_at: str
    grand_total_cents: int | None
