from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.reports.models import Bill, Order
from app.modules.reports.schemas import DailySalesReport, OrderHistoryRow, SalesByDayRow


def get_daily_sales(db: Session, date: str | None = None) -> DailySalesReport:
    report_date = date or datetime.utcnow().date().isoformat()

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


def get_order_history(
    db: Session,
    from_date: str | None = None,
    to_date: str | None = None,
    table_id: int | None = None,
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


def get_sales_by_day(
    db: Session,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[SalesByDayRow]:
    query = db.query(
        func.date(Bill.issued_at).label("day"),
        func.count(Bill.id),
        func.coalesce(func.sum(Bill.grand_total_cents), 0),
    )

    if from_date:
        query = query.filter(func.date(Bill.issued_at) >= from_date)
    if to_date:
        query = query.filter(func.date(Bill.issued_at) <= to_date)

    rows = query.group_by(func.date(Bill.issued_at)).order_by(func.date(Bill.issued_at).asc()).all()
    return [
        SalesByDayRow(
            date=day,
            total_orders=int(total_orders or 0),
            total_sales_cents=int(total_sales_cents or 0),
        )
        for day, total_orders, total_sales_cents in rows
    ]
