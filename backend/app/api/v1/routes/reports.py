from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.core.time import utcnow
from app.models.bill import Bill
from app.models.order import Order
from app.models.user import User
from app.schemas.report import DailySalesReport, OrderHistoryRow

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily", response_model=DailySalesReport)
def daily_sales(
    date: str | None = Query(default=None),
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> DailySalesReport:
    report_date = date or utcnow().date().isoformat()

    total_orders, total_sales, total_tax, total_discount = (
        db.query(
            func.count(Bill.id),
            func.coalesce(func.sum(Bill.grand_total_cents), 0),
            func.coalesce(func.sum(Bill.tax_cents), 0),
            func.coalesce(func.sum(Bill.discount_cents), 0),
        )
        .filter(func.date(Bill.issued_at) == report_date)
        .one()
    )

    return DailySalesReport(
        date=report_date,
        total_orders=int(total_orders or 0),
        total_sales_cents=int(total_sales or 0),
        total_tax_cents=int(total_tax or 0),
        total_discount_cents=int(total_discount or 0),
    )


@router.get("/orders/history", response_model=list[OrderHistoryRow])
def order_history(
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    table_id: int | None = Query(default=None),
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> list[OrderHistoryRow]:
    query = db.query(Order, Bill.grand_total_cents).outerjoin(Bill, Bill.order_id == Order.id)

    if from_date:
        query = query.filter(func.date(Order.opened_at) >= from_date)
    if to_date:
        query = query.filter(func.date(Order.opened_at) <= to_date)
    if table_id is not None:
        query = query.filter(Order.table_id == table_id)

    rows = query.order_by(Order.id.desc()).limit(500).all()
    result: list[OrderHistoryRow] = []
    for order, grand_total_cents in rows:
        result.append(
            OrderHistoryRow(
                order_id=order.id,
                order_no=order.order_no,
                status=order.status,
                order_type=order.order_type,
                table_id=order.table_id,
                opened_at=order.opened_at.isoformat(),
                grand_total_cents=grand_total_cents,
            )
        )
    return result
