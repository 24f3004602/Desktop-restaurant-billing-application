from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.core.time import utcnow
from app.models.menu_item import MenuItem
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.restaurant_table import RestaurantTable
from app.models.user import User
from app.schemas.order import OrderCreate, OrderItemCreate, OrderItemUpdate, OrderRead

router = APIRouter(prefix="/orders", tags=["orders"])


def _make_order_no() -> str:
    return f"ORD-{utcnow():%Y%m%d-%H%M%S}-{uuid4().hex[:4].upper()}"


def _recalculate_line(item: OrderItem) -> None:
    subtotal = item.unit_price_cents * item.quantity
    tax = int(round(subtotal * (item.gst_percent / 100.0)))
    item.line_subtotal_cents = subtotal
    item.line_tax_cents = tax
    item.line_total_cents = subtotal + tax


def _load_order_or_404(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    table = None
    if payload.table_id is not None:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == payload.table_id).first()
        if not table:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")

    order = Order(
        order_no=_make_order_no(),
        table_id=payload.table_id,
        order_type=payload.order_type,
        status="open",
        created_by=current_user.id,
        notes=payload.notes,
    )
    db.add(order)

    if table:
        table.status = "occupied"

    db.commit()
    db.refresh(order)
    return order


@router.get("/{order_id}", response_model=OrderRead)
def get_order(
    order_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    return _load_order_or_404(db, order_id)


@router.post("/{order_id}/items", response_model=OrderRead)
def add_order_item(
    order_id: int,
    payload: OrderItemCreate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    order = _load_order_or_404(db, order_id)
    menu_item = db.query(MenuItem).filter(MenuItem.id == payload.menu_item_id).first()
    if not menu_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")
    if not menu_item.is_available:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Menu item is unavailable")

    if payload.quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be greater than zero")

    order_item = OrderItem(
        order_id=order.id,
        menu_item_id=menu_item.id,
        quantity=payload.quantity,
        unit_price_cents=menu_item.price_cents,
        gst_percent=menu_item.gst_percent,
        special_note=payload.special_note,
        kot_status="pending",
    )
    _recalculate_line(order_item)

    db.add(order_item)
    db.commit()
    db.refresh(order)
    return order


@router.patch("/{order_id}/items/{item_id}", response_model=OrderRead)
def update_order_item(
    order_id: int,
    item_id: int,
    payload: OrderItemUpdate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    order = _load_order_or_404(db, order_id)
    item = db.query(OrderItem).filter(OrderItem.id == item_id, OrderItem.order_id == order_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order item not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "quantity" in update_data:
        if update_data["quantity"] <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be greater than zero")
    for key, value in update_data.items():
        setattr(item, key, value)

    _recalculate_line(item)
    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}/items/{item_id}", response_model=OrderRead)
def delete_order_item(
    order_id: int,
    item_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    order = _load_order_or_404(db, order_id)
    item = db.query(OrderItem).filter(OrderItem.id == item_id, OrderItem.order_id == order_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order item not found")

    db.delete(item)
    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/kot")
def generate_kot(
    order_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> dict[str, int | str]:
    order = _load_order_or_404(db, order_id)
    sent_count = 0
    for item in order.items:
        if item.kot_status == "pending":
            item.kot_status = "sent"
            sent_count += 1

    order.status = "kot_sent" if sent_count else order.status
    db.commit()

    return {
        "order_id": order.id,
        "order_no": order.order_no,
        "items_sent": sent_count,
    }
