from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PaymentCreate(BaseModel):
    method: str
    amount_cents: int
    reference_no: str | None = None


class PaymentRead(BaseModel):
    id: int
    bill_id: int
    order_id: int
    method: str
    amount_cents: int
    reference_no: str | None
    paid_by: int
    paid_at: datetime

    model_config = ConfigDict(from_attributes=True)
