from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.models.bill import Bill
from app.models.order import Order
from app.models.user import User
from app.schemas.bill import BillGenerateRequest, BillRead

router = APIRouter(prefix="/billing", tags=["billing"])


def _make_bill_no() -> str:
    return f"BILL-{datetime.utcnow():%Y%m%d-%H%M%S}-{uuid4().hex[:4].upper()}"


def _load_order_or_404(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


def _compute_totals(order: Order, discount_cents: int) -> tuple[int, int, int, int]:
    subtotal = sum(item.line_subtotal_cents for item in order.items)
    tax = sum(item.line_tax_cents for item in order.items)
    discount = max(0, discount_cents)
    grand_total = max(0, subtotal + tax - discount)
    return subtotal, tax, discount, grand_total


@router.post("/orders/{order_id}/bill", response_model=BillRead)
def generate_bill(
    order_id: int,
    payload: BillGenerateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> Bill:
    order = _load_order_or_404(db, order_id)
    if not order.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot bill an empty order")

    if order.bill:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bill already exists for this order")

    subtotal, tax, discount, grand_total = _compute_totals(order, payload.discount_cents)
    bill = Bill(
        bill_no=_make_bill_no(),
        order_id=order.id,
        subtotal_cents=subtotal,
        tax_cents=tax,
        discount_cents=discount,
        grand_total_cents=grand_total,
        payment_status="unpaid",
        issued_by=current_user.id,
    )

    order.status = "billed"
    if order.table:
        order.table.status = "billed"

    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


@router.get("/{bill_id}", response_model=BillRead)
def get_bill(
    bill_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Bill:
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return bill
