from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.time import utcnow
from app.db.base import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    table_id: Mapped[int | None] = mapped_column(ForeignKey("restaurant_tables.id", ondelete="SET NULL"))
    order_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)
    notes: Mapped[str | None] = mapped_column(Text)

    table: Mapped["RestaurantTable | None"] = relationship(back_populates="orders")
    creator: Mapped["User"] = relationship(back_populates="orders_created")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    bill: Mapped["Bill | None"] = relationship(back_populates="order", uselist=False)
    payments: Mapped[list["Payment"]] = relationship(back_populates="order")
