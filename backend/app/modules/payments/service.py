from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, PaymentFailedError
from app.core.time import utcnow
from app.modules.payments.models import Bill, Payment
from app.modules.payments.schemas import PaymentCreate


def load_bill_or_404(db: Session, bill_id: int) -> Bill:
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise NotFoundError("Bill not found")
    return bill


def calculate_remaining_amount(total_cents: int, paid_so_far_cents: int) -> int:
    return max(0, total_cents - paid_so_far_cents)


def add_payment(db: Session, bill_id: int, payload: PaymentCreate, current_user_id: int) -> Payment:
    bill = load_bill_or_404(db, bill_id)

    if payload.amount_cents <= 0:
        raise PaymentFailedError("Payment amount must be positive")

    paid_so_far = db.query(func.coalesce(func.sum(Payment.amount_cents), 0)).filter(Payment.bill_id == bill.id).scalar() or 0
    remaining = calculate_remaining_amount(bill.grand_total_cents, int(paid_so_far))
    if payload.amount_cents > remaining:
        raise PaymentFailedError("Payment exceeds remaining amount")

    payment = Payment(
        bill_id=bill.id,
        order_id=bill.order_id,
        method=payload.method,
        amount_cents=payload.amount_cents,
        reference_no=payload.reference_no,
        paid_by=current_user_id,
    )
    db.add(payment)
    db.flush()

    new_total_paid = int(paid_so_far) + payload.amount_cents
    if new_total_paid >= bill.grand_total_cents:
        bill.payment_status = "paid"
        bill.order.status = "paid"
        bill.order.closed_at = utcnow()
        if bill.order.table:
            bill.order.table.status = "free"
    elif new_total_paid > 0:
        bill.payment_status = "partial"

    db.commit()
    db.refresh(payment)
    return payment


def list_payments(db: Session, bill_id: int) -> list[Payment]:
    _ = load_bill_or_404(db, bill_id)
    return db.query(Payment).filter(Payment.bill_id == bill_id).order_by(Payment.paid_at.asc()).all()
