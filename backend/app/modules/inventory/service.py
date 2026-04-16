from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, DomainValidationError, InsufficientStockError, NotFoundError
from app.core.time import utcnow
from app.modules.inventory.models import Category, InventoryMovement, MenuItem, RestaurantTable
from app.modules.inventory.schemas import (
    AvailabilityUpdate,
    CategoryCreate,
    CategoryUpdate,
    MenuItemCreate,
    MenuItemUpdate,
    StockAdjustmentCreate,
    TableCreate,
    TableStatusUpdate,
    TableUpdate,
)


def list_categories(db: Session) -> list[Category]:
    return db.query(Category).order_by(Category.display_order.asc(), Category.name.asc()).all()


def create_category(db: Session, payload: CategoryCreate) -> Category:
    exists = db.query(Category).filter(Category.name == payload.name).first()
    if exists:
        raise ConflictError("Category already exists")

    category = Category(
        name=payload.name,
        display_order=payload.display_order,
        is_active=payload.is_active,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(db: Session, category_id: int, payload: CategoryUpdate) -> Category:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise NotFoundError("Category not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)

    db.commit()
    db.refresh(category)
    return category


def list_menu_items(db: Session) -> list[MenuItem]:
    return db.query(MenuItem).order_by(MenuItem.id.asc()).all()


def load_menu_item_or_404(db: Session, item_id: int) -> MenuItem:
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise NotFoundError("Menu item not found")
    return item


def apply_stock_delta(
    db: Session,
    menu_item: MenuItem,
    delta_quantity: int,
    reason: str,
    created_by: int | None,
    note: str | None = None,
) -> None:
    if delta_quantity == 0 or not menu_item.track_inventory:
        return

    previous_quantity = menu_item.stock_quantity
    next_quantity = menu_item.stock_quantity + delta_quantity
    if next_quantity < 0:
        raise InsufficientStockError(f"Insufficient stock for {menu_item.name}. Remaining quantity: {menu_item.stock_quantity}")

    menu_item.stock_quantity = next_quantity
    if menu_item.stock_quantity == 0:
        menu_item.is_available = False
    elif previous_quantity == 0 and not menu_item.is_available:
        menu_item.is_available = True

    movement = InventoryMovement(
        menu_item_id=menu_item.id,
        change_quantity=delta_quantity,
        quantity_after=menu_item.stock_quantity,
        reason=reason,
        note=note,
        created_by=created_by,
    )
    db.add(movement)


def create_menu_item(db: Session, payload: MenuItemCreate) -> MenuItem:
    category = db.query(Category).filter(Category.id == payload.category_id).first()
    if not category:
        raise NotFoundError("Category not found")

    item = MenuItem(**payload.model_dump())
    if item.stock_quantity < 0:
        raise DomainValidationError("Stock quantity cannot be negative")
    if item.low_stock_threshold < 0:
        raise DomainValidationError("Low-stock threshold cannot be negative")
    if item.track_inventory and item.stock_quantity == 0:
        item.is_available = False

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_menu_item(db: Session, item_id: int, payload: MenuItemUpdate) -> MenuItem:
    item = load_menu_item_or_404(db, item_id)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    if item.stock_quantity < 0:
        raise DomainValidationError("Stock quantity cannot be negative")
    if item.low_stock_threshold < 0:
        raise DomainValidationError("Low-stock threshold cannot be negative")
    if item.track_inventory and item.stock_quantity == 0:
        item.is_available = False

    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


def set_menu_item_availability(db: Session, item_id: int, payload: AvailabilityUpdate) -> MenuItem:
    item = load_menu_item_or_404(db, item_id)

    if payload.is_available and item.track_inventory and item.stock_quantity == 0:
        raise DomainValidationError("Cannot mark item available while stock quantity is zero")

    item.is_available = payload.is_available
    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


def adjust_menu_item_stock(
    db: Session,
    item_id: int,
    payload: StockAdjustmentCreate,
    current_user_id: int,
) -> MenuItem:
    item = load_menu_item_or_404(db, item_id)
    if not item.track_inventory:
        raise DomainValidationError("Enable inventory tracking for this item before adjusting stock")
    if payload.delta_quantity == 0:
        raise DomainValidationError("Stock adjustment cannot be zero")

    apply_stock_delta(
        db,
        item,
        delta_quantity=payload.delta_quantity,
        reason=payload.reason,
        note=payload.note,
        created_by=current_user_id,
    )

    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


def list_menu_item_stock_movements(db: Session, item_id: int) -> list[InventoryMovement]:
    _ = load_menu_item_or_404(db, item_id)
    return (
        db.query(InventoryMovement)
        .filter(InventoryMovement.menu_item_id == item_id)
        .order_by(InventoryMovement.id.desc())
        .limit(300)
        .all()
    )


def list_tables(db: Session) -> list[RestaurantTable]:
    return db.query(RestaurantTable).order_by(RestaurantTable.table_number.asc()).all()


def create_table(db: Session, payload: TableCreate) -> RestaurantTable:
    exists = db.query(RestaurantTable).filter(RestaurantTable.table_number == payload.table_number).first()
    if exists:
        raise ConflictError("Table number already exists")

    table = RestaurantTable(**payload.model_dump())
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


def update_table(db: Session, table_id: int, payload: TableUpdate) -> RestaurantTable:
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise NotFoundError("Table not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(table, key, value)

    db.commit()
    db.refresh(table)
    return table


def update_table_status(db: Session, table_id: int, payload: TableStatusUpdate) -> RestaurantTable:
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise NotFoundError("Table not found")

    table.status = payload.status
    db.commit()
    db.refresh(table)
    return table
