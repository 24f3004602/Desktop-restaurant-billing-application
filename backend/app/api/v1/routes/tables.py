from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db_session, require_roles
from app.core.roles import Role
from app.models.restaurant_table import RestaurantTable
from app.models.user import User
from app.schemas.restaurant_table import TableCreate, TableRead, TableUpdate

router = APIRouter(prefix="/tables", tags=["tables"])


class TableStatusUpdate(BaseModel):
    status: str


@router.get("", response_model=list[TableRead])
def list_tables(db: Session = Depends(get_db_session)) -> list[RestaurantTable]:
    return db.query(RestaurantTable).order_by(RestaurantTable.table_number.asc()).all()


@router.post("", response_model=TableRead, status_code=status.HTTP_201_CREATED)
def create_table(
    payload: TableCreate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN)),
) -> RestaurantTable:
    exists = db.query(RestaurantTable).filter(RestaurantTable.table_number == payload.table_number).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Table number already exists")

    table = RestaurantTable(**payload.model_dump())
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@router.patch("/{table_id}", response_model=TableRead)
def update_table(
    table_id: int,
    payload: TableUpdate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN)),
) -> RestaurantTable:
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(table, key, value)

    db.commit()
    db.refresh(table)
    return table


@router.patch("/{table_id}/status", response_model=TableRead)
def update_table_status(
    table_id: int,
    payload: TableStatusUpdate,
    db: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(Role.ADMIN, Role.CASHIER, Role.WAITER)),
) -> RestaurantTable:
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")

    table.status = payload.status
    db.commit()
    db.refresh(table)
    return table
