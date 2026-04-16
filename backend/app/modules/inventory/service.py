from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.inventory.models import Category, MenuItem, RestaurantTable
from app.modules.inventory.schemas import (
    AvailabilityUpdate,
    CategoryCreate,
    CategoryUpdate,
    MenuItemCreate,
    MenuItemUpdate,
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


def create_menu_item(db: Session, payload: MenuItemCreate) -> MenuItem:
    category = db.query(Category).filter(Category.id == payload.category_id).first()
    if not category:
        raise NotFoundError("Category not found")

    item = MenuItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_menu_item(db: Session, item_id: int, payload: MenuItemUpdate) -> MenuItem:
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise NotFoundError("Menu item not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


def set_menu_item_availability(db: Session, item_id: int, payload: AvailabilityUpdate) -> MenuItem:
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise NotFoundError("Menu item not found")

    item.is_available = payload.is_available
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


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
