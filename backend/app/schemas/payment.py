from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PaymentCreate(BaseModel):
    method: str
    amount_cents: int
    reference_no: str | None = Field(default=None, max_length=80)


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
