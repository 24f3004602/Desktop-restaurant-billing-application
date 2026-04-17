from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentRead
from app.modules.payments.models import Payment
from app.modules.payments.service import add_payment as add_payment_service
from app.modules.payments.service import list_payments as list_payments_service

router = APIRouter(prefix="/bills", tags=["payments"])


@router.post("/{bill_id}/payments", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
def add_payment(
    bill_id: int,
    payload: PaymentCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> Payment:
    return add_payment_service(db, bill_id, payload, current_user.id)


@router.get("/{bill_id}/payments", response_model=list[PaymentRead])
def list_payments(
    bill_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> list[Payment]:
    return list_payments_service(db, bill_id)
