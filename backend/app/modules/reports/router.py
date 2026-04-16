from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.models.user import User
from app.modules.reports.schemas import DailySalesReport, OrderHistoryRow
from app.modules.reports.service import get_daily_sales, get_order_history

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily", response_model=DailySalesReport)
def daily_sales(
    date: str | None = Query(default=None),
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> DailySalesReport:
    return get_daily_sales(db, date)


@router.get("/orders/history", response_model=list[OrderHistoryRow])
def order_history(
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    table_id: int | None = Query(default=None),
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> list[OrderHistoryRow]:
    return get_order_history(db, from_date=from_date, to_date=to_date, table_id=table_id)
