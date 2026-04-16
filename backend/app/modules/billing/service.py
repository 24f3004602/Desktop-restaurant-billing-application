from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import DomainValidationError, NotFoundError
from app.modules.billing.models import Bill, Order, OrderItem
from app.modules.billing.schemas import BillGenerateRequest


def make_bill_no() -> str:
    return f"BILL-{datetime.utcnow():%Y%m%d-%H%M%S}-{uuid4().hex[:4].upper()}"


def compute_order_totals(order_items: list[OrderItem], discount_cents: int) -> tuple[int, int, int, int]:
    subtotal = sum(item.line_subtotal_cents for item in order_items)
    tax = sum(item.line_tax_cents for item in order_items)
    discount = max(0, discount_cents)
    grand_total = max(0, subtotal + tax - discount)
    return subtotal, tax, discount, grand_total


def load_order_or_404(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise NotFoundError("Order not found")
    return order


def generate_bill(db: Session, order_id: int, payload: BillGenerateRequest, current_user_id: int) -> Bill:
    order = load_order_or_404(db, order_id)
    if not order.items:
        raise DomainValidationError("Cannot bill an empty order")

    if order.bill:
        return order.bill

    subtotal, tax, discount, grand_total = compute_order_totals(order.items, payload.discount_cents)
    bill = Bill(
        bill_no=make_bill_no(),
        order_id=order.id,
        subtotal_cents=subtotal,
        tax_cents=tax,
        discount_cents=discount,
        grand_total_cents=grand_total,
        payment_status="unpaid",
        issued_by=current_user_id,
    )

    order.status = "billed"
    if order.table:
        order.table.status = "billed"

    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


def get_bill(db: Session, bill_id: int) -> Bill:
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise NotFoundError("Bill not found")
    return bill
