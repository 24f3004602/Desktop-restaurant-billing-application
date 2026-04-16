from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.models.user import User
from app.modules.inventory.models import Category, InventoryMovement, MenuItem, RestaurantTable
from app.modules.inventory.schemas import (
    AvailabilityUpdate,
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    MenuItemCreate,
    MenuItemRead,
    StockAdjustmentCreate,
    StockAdjustmentRead,
    MenuItemUpdate,
    TableCreate,
    TableRead,
    TableStatusUpdate,
    TableUpdate,
)
from app.modules.inventory.service import (
    create_category,
    create_menu_item,
    create_table,
    adjust_menu_item_stock,
    list_categories,
    list_menu_items,
    list_menu_item_stock_movements,
    list_tables,
    set_menu_item_availability,
    update_category,
    update_menu_item,
    update_table,
    update_table_status,
)

router = APIRouter(tags=["inventory"])


@router.get("/categories", response_model=list[CategoryRead])
def get_categories(db: Session = Depends(get_db_session)) -> list[Category]:
    return list_categories(db)


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def add_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN)),
) -> Category:
    return create_category(db, payload)


@router.patch("/categories/{category_id}", response_model=CategoryRead)
def patch_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN)),
) -> Category:
    return update_category(db, category_id, payload)


@router.get("/menu-items", response_model=list[MenuItemRead])
def get_menu_items(db: Session = Depends(get_db_session)) -> list[MenuItem]:
    return list_menu_items(db)


@router.post("/menu-items", response_model=MenuItemRead, status_code=status.HTTP_201_CREATED)
def add_menu_item(
    payload: MenuItemCreate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN)),
) -> MenuItem:
    return create_menu_item(db, payload)


@router.patch("/menu-items/{item_id}", response_model=MenuItemRead)
def patch_menu_item(
    item_id: int,
    payload: MenuItemUpdate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN)),
) -> MenuItem:
    return update_menu_item(db, item_id, payload)


@router.patch("/menu-items/{item_id}/availability", response_model=MenuItemRead)
def patch_menu_item_availability(
    item_id: int,
    payload: AvailabilityUpdate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> MenuItem:
    return set_menu_item_availability(db, item_id, payload)


@router.post("/menu-items/{item_id}/stock-adjustments", response_model=MenuItemRead)
def create_stock_adjustment(
    item_id: int,
    payload: StockAdjustmentCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> MenuItem:
    return adjust_menu_item_stock(db, item_id, payload, current_user.id)


@router.get("/menu-items/{item_id}/stock-adjustments", response_model=list[StockAdjustmentRead])
def get_stock_adjustments(
    item_id: int,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> list[InventoryMovement]:
    return list_menu_item_stock_movements(db, item_id)


@router.get("/tables", response_model=list[TableRead])
def get_tables(db: Session = Depends(get_db_session)) -> list[RestaurantTable]:
    return list_tables(db)


@router.post("/tables", response_model=TableRead, status_code=status.HTTP_201_CREATED)
def add_table(
    payload: TableCreate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN)),
) -> RestaurantTable:
    return create_table(db, payload)


@router.patch("/tables/{table_id}", response_model=TableRead)
def patch_table(
    table_id: int,
    payload: TableUpdate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN)),
) -> RestaurantTable:
    return update_table(db, table_id, payload)


@router.patch("/tables/{table_id}/status", response_model=TableRead)
def patch_table_status(
    table_id: int,
    payload: TableStatusUpdate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> RestaurantTable:
    return update_table_status(db, table_id, payload)
