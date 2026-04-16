from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BillGenerateRequest(BaseModel):
    discount_cents: int = 0


class BillRead(BaseModel):
    id: int
    bill_no: str
    order_id: int
    subtotal_cents: int
    tax_cents: int
    discount_cents: int
    grand_total_cents: int
    payment_status: str
    issued_by: int
    issued_at: datetime

    model_config = ConfigDict(from_attributes=True)
