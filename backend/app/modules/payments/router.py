from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.models.user import User
from app.modules.payments.models import Payment
from app.modules.payments.schemas import PaymentCreate, PaymentRead
from app.modules.payments.service import add_payment, list_payments

router = APIRouter(prefix="/bills", tags=["payments"])


@router.post("/{bill_id}/payments", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
def create_payment(
    bill_id: int,
    payload: PaymentCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> Payment:
    return add_payment(db, bill_id, payload, current_user.id)


@router.get("/{bill_id}/payments", response_model=list[PaymentRead])
def get_payments(
    bill_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> list[Payment]:
    return list_payments(db, bill_id)
