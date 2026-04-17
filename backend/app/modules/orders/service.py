from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import DomainValidationError, InsufficientStockError, NotFoundError
from app.core.time import utcnow
from app.modules.inventory.service import apply_stock_delta
from app.modules.orders.models import MenuItem, Order, OrderItem, RestaurantTable
from app.modules.orders.schemas import OrderCreate, OrderItemCreate, OrderItemUpdate


def make_order_no() -> str:
    return f"ORD-{utcnow():%Y%m%d-%H%M%S}-{uuid4().hex[:4].upper()}"


def recalculate_line(item: OrderItem) -> None:
    subtotal = item.unit_price_cents * item.quantity
    tax = int(round(subtotal * (item.gst_percent / 100.0)))
    item.line_subtotal_cents = subtotal
    item.line_tax_cents = tax
    item.line_total_cents = subtotal + tax


def load_order_or_404(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise NotFoundError("Order not found")
    return order


def create_order(db: Session, payload: OrderCreate, current_user_id: int) -> Order:
    table = None
    if payload.table_id is not None:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == payload.table_id).first()
        if not table:
            raise NotFoundError("Table not found")

    order = Order(
        order_no=make_order_no(),
        table_id=payload.table_id,
        order_type=payload.order_type,
        status="open",
        created_by=current_user_id,
        notes=payload.notes,
    )
    db.add(order)

    if table:
        table.status = "occupied"

    db.commit()
    db.refresh(order)
    return order


def get_order(db: Session, order_id: int) -> Order:
    return load_order_or_404(db, order_id)


def cancel_order(db: Session, order_id: int) -> Order:
    order = load_order_or_404(db, order_id)

    if order.status != "open":
        raise DomainValidationError("Only open orders can be cancelled")
    if order.items:
        raise DomainValidationError("Only empty orders can be cancelled")

    order.status = "cancelled"
    order.closed_at = utcnow()
    if order.table:
        order.table.status = "free"

    db.commit()
    db.refresh(order)
    return order


def add_order_item(db: Session, order_id: int, payload: OrderItemCreate, current_user_id: int) -> Order:
    order = load_order_or_404(db, order_id)
    menu_item = db.query(MenuItem).filter(MenuItem.id == payload.menu_item_id).first()
    if not menu_item:
        raise NotFoundError("Menu item not found")
    if not menu_item.is_available:
        raise InsufficientStockError("Menu item is unavailable")

    if payload.quantity <= 0:
        raise DomainValidationError("Quantity must be greater than zero")

    order_item = OrderItem(
        order_id=order.id,
        menu_item_id=menu_item.id,
        menu_item_name=menu_item.name,
        quantity=payload.quantity,
        unit_price_cents=menu_item.price_cents,
        gst_percent=menu_item.gst_percent,
        special_note=payload.special_note,
        kot_status="pending",
    )
    recalculate_line(order_item)
    apply_stock_delta(
        db,
        menu_item,
        delta_quantity=-payload.quantity,
        reason="order_item_add",
        note=f"order_id={order.id}",
        created_by=current_user_id,
    )

    db.add(order_item)
    db.commit()
    db.refresh(order)
    return order


def update_order_item(db: Session, order_id: int, item_id: int, payload: OrderItemUpdate, current_user_id: int) -> Order:
    order = load_order_or_404(db, order_id)
    item = db.query(OrderItem).filter(OrderItem.id == item_id, OrderItem.order_id == order_id).first()
    if not item:
        raise NotFoundError("Order item not found")

    update_data = payload.model_dump(exclude_unset=True)
    current_quantity = item.quantity
    if "quantity" in update_data and update_data["quantity"] <= 0:
        raise DomainValidationError("Quantity must be greater than zero")

    if "quantity" in update_data:
        next_quantity = int(update_data["quantity"])
        quantity_delta = next_quantity - current_quantity
        if quantity_delta != 0:
            menu_item = db.query(MenuItem).filter(MenuItem.id == item.menu_item_id).first()
            if not menu_item:
                raise NotFoundError("Menu item not found")

            apply_stock_delta(
                db,
                menu_item,
                delta_quantity=-quantity_delta,
                reason="order_item_quantity_update",
                note=f"order_id={order_id};order_item_id={item_id}",
                created_by=current_user_id,
            )

    for key, value in update_data.items():
        setattr(item, key, value)

    recalculate_line(item)
    db.commit()
    db.refresh(order)
    return order


def delete_order_item(db: Session, order_id: int, item_id: int, current_user_id: int) -> Order:
    order = load_order_or_404(db, order_id)
    item = db.query(OrderItem).filter(OrderItem.id == item_id, OrderItem.order_id == order_id).first()
    if not item:
        raise NotFoundError("Order item not found")

    menu_item = db.query(MenuItem).filter(MenuItem.id == item.menu_item_id).first()
    if menu_item:
        apply_stock_delta(
            db,
            menu_item,
            delta_quantity=item.quantity,
            reason="order_item_delete",
            note=f"order_id={order_id};order_item_id={item_id}",
            created_by=current_user_id,
        )

    db.delete(item)
    db.commit()
    db.refresh(order)
    return order


def generate_kot(db: Session, order_id: int) -> dict[str, int | str]:
    order = load_order_or_404(db, order_id)
    if not order.items:
        raise DomainValidationError("Cannot generate KOT for an empty order")

    sent_count = 0
    for item in order.items:
        if item.kot_status == "pending":
            item.kot_status = "sent"
            sent_count += 1

    if sent_count:
        order.status = "kot_sent"

    db.commit()
    return {
        "order_id": order.id,
        "order_no": order.order_no,
        "items_sent": sent_count,
    }
