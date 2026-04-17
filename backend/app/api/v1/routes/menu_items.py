from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.core.time import utcnow
from app.models.category import Category
from app.models.menu_item import MenuItem
from app.models.user import User
from app.schemas.menu_item import MenuItemCreate, MenuItemRead, MenuItemUpdate

router = APIRouter(prefix="/menu-items", tags=["menu-items"])


class AvailabilityUpdate(BaseModel):
    is_available: bool


@router.get("", response_model=list[MenuItemRead])
def list_menu_items(db: Session = Depends(get_db_session)) -> list[MenuItem]:
    return db.query(MenuItem).order_by(MenuItem.id.asc()).all()


@router.post("", response_model=MenuItemRead, status_code=status.HTTP_201_CREATED)
def create_menu_item(
    payload: MenuItemCreate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN)),
) -> MenuItem:
    category = db.query(Category).filter(Category.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    item = MenuItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=MenuItemRead)
def update_menu_item(
    item_id: int,
    payload: MenuItemUpdate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN)),
) -> MenuItem:
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}/availability", response_model=MenuItemRead)
def set_menu_item_availability(
    item_id: int,
    payload: AvailabilityUpdate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER)),
) -> MenuItem:
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")

    item.is_available = payload.is_available
    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item
