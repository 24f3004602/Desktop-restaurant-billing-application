from sqlalchemy import inspect, text

from app.db.base import Base
from app.db.session import engine
from app.models import Bill, Category, InventoryMovement, MenuItem, Order, OrderItem, Payment, RestaurantTable, User  # noqa: F401


def _ensure_order_item_name_column() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        table_names = set(inspector.get_table_names())
        if "order_items" not in table_names:
            return

        column_names = {column["name"] for column in inspector.get_columns("order_items")}
        if "menu_item_name" not in column_names:
            connection.execute(
                text(
                    "ALTER TABLE order_items "
                    "ADD COLUMN menu_item_name VARCHAR(120) NOT NULL DEFAULT 'Unknown Item'"
                )
            )

        connection.execute(
            text(
                """
                UPDATE order_items
                SET menu_item_name = COALESCE(
                    (SELECT name FROM menu_items WHERE menu_items.id = order_items.menu_item_id),
                    'Unknown Item'
                )
                WHERE menu_item_name IS NULL OR menu_item_name = ''
                """
            )
        )


def _ensure_user_security_columns() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        table_names = set(inspector.get_table_names())
        if "users" not in table_names:
            return

        column_names = {column["name"] for column in inspector.get_columns("users")}
        if "failed_login_attempts" not in column_names:
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0"
                )
            )
        if "locked_until" not in column_names:
            connection.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME"))
        if "last_login_at" not in column_names:
            connection.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))


def _ensure_inventory_schema() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        table_names = set(inspector.get_table_names())
        if "menu_items" not in table_names:
            return

        menu_item_columns = {column["name"] for column in inspector.get_columns("menu_items")}
        if "track_inventory" not in menu_item_columns:
            connection.execute(
                text(
                    "ALTER TABLE menu_items "
                    "ADD COLUMN track_inventory BOOLEAN NOT NULL DEFAULT 0"
                )
            )
        if "stock_quantity" not in menu_item_columns:
            connection.execute(
                text(
                    "ALTER TABLE menu_items "
                    "ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0"
                )
            )
        if "low_stock_threshold" not in menu_item_columns:
            connection.execute(
                text(
                    "ALTER TABLE menu_items "
                    "ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5"
                )
            )

        if "inventory_movements" not in table_names:
            connection.execute(
                text(
                    """
                    CREATE TABLE inventory_movements (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        menu_item_id INTEGER NOT NULL,
                        change_quantity INTEGER NOT NULL,
                        quantity_after INTEGER NOT NULL,
                        reason VARCHAR(40) NOT NULL,
                        note TEXT,
                        created_by INTEGER,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
                        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
                    )
                    """
                )
            )

        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_inventory_movements_menu_item_id "
                "ON inventory_movements(menu_item_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_inventory_movements_created_at "
                "ON inventory_movements(created_at)"
            )
        )


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_order_item_name_column()
    _ensure_user_security_columns()
    _ensure_inventory_schema()
