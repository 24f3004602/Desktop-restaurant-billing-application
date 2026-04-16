from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.models.bill import Bill
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentRead

router = APIRouter(prefix="/bills", tags=["payments"])


def _load_bill_or_404(db: Session, bill_id: int) -> Bill:
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return bill


@router.post("/{bill_id}/payments", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
def add_payment(
    bill_id: int,
    payload: PaymentCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> Payment:
    bill = _load_bill_or_404(db, bill_id)

    if payload.amount_cents <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount must be positive")

    paid_so_far = db.query(func.coalesce(func.sum(Payment.amount_cents), 0)).filter(Payment.bill_id == bill.id).scalar() or 0
    remaining = bill.grand_total_cents - int(paid_so_far)
    if payload.amount_cents > remaining:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment exceeds remaining amount")

    payment = Payment(
        bill_id=bill.id,
        order_id=bill.order_id,
        method=payload.method,
        amount_cents=payload.amount_cents,
        reference_no=payload.reference_no,
        paid_by=current_user.id,
    )
    db.add(payment)
    db.flush()

    new_total_paid = int(paid_so_far) + payload.amount_cents
    if new_total_paid >= bill.grand_total_cents:
        bill.payment_status = "paid"
        bill.order.status = "paid"
        bill.order.closed_at = datetime.utcnow()
        if bill.order.table:
            bill.order.table.status = "free"
    elif new_total_paid > 0:
        bill.payment_status = "partial"

    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{bill_id}/payments", response_model=list[PaymentRead])
def list_payments(
    bill_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> list[Payment]:
    _ = _load_bill_or_404(db, bill_id)
    return db.query(Payment).filter(Payment.bill_id == bill_id).order_by(Payment.paid_at.asc()).all()
