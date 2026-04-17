from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.models.user import User
from app.schemas.bill import BillGenerateRequest, BillRead
from app.modules.billing.models import Bill
from app.modules.billing.service import generate_bill as generate_bill_service
from app.modules.billing.service import get_bill as get_bill_service

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/orders/{order_id}/bill", response_model=BillRead)
def generate_bill(
    order_id: int,
    payload: BillGenerateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> Bill:
    return generate_bill_service(db, order_id, payload, current_user.id)


@router.get("/{bill_id}", response_model=BillRead)
def get_bill(
    bill_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Bill:
    return get_bill_service(db, bill_id)
