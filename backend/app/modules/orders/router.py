from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.models.user import User
from app.modules.orders.models import Order
from app.modules.orders.schemas import OrderCreate, OrderItemCreate, OrderItemUpdate, OrderRead
from app.modules.orders.service import (
    add_order_item,
    cancel_order,
    create_order,
    delete_order_item,
    generate_kot,
    get_order,
    update_order_item,
)

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def add_order(
    payload: OrderCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    return create_order(db, payload, current_user.id)


@router.get("/{order_id}", response_model=OrderRead)
def fetch_order(
    order_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    return get_order(db, order_id)


@router.patch("/{order_id}/cancel", response_model=OrderRead)
def cancel_open_order(
    order_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    return cancel_order(db, order_id)


@router.post("/{order_id}/items", response_model=OrderRead)
def add_item(
    order_id: int,
    payload: OrderItemCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    return add_order_item(db, order_id, payload, current_user.id)


@router.patch("/{order_id}/items/{item_id}", response_model=OrderRead)
def patch_item(
    order_id: int,
    item_id: int,
    payload: OrderItemUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    return update_order_item(db, order_id, item_id, payload, current_user.id)


@router.delete("/{order_id}/items/{item_id}", response_model=OrderRead)
def remove_item(
    order_id: int,
    item_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> Order:
    return delete_order_item(db, order_id, item_id, current_user.id)


@router.post("/{order_id}/kot")
def create_kot(
    order_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> dict[str, int | str]:
    return generate_kot(db, order_id)
