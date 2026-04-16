"""add inventory tracking columns and movements table

Revision ID: 20260416_0004
Revises: 20260416_0003
Create Date: 2026-04-16 01:15:00.000000

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260416_0004"
down_revision: str | None = "20260416_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "menu_items" in table_names:
        menu_item_columns = {column["name"] for column in inspector.get_columns("menu_items")}
        with op.batch_alter_table("menu_items") as batch_op:
            if "track_inventory" not in menu_item_columns:
                batch_op.add_column(sa.Column("track_inventory", sa.Boolean(), nullable=False, server_default="0"))
            if "stock_quantity" not in menu_item_columns:
                batch_op.add_column(sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default="0"))
            if "low_stock_threshold" not in menu_item_columns:
                batch_op.add_column(sa.Column("low_stock_threshold", sa.Integer(), nullable=False, server_default="5"))

    if "inventory_movements" not in table_names:
        op.create_table(
            "inventory_movements",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("menu_item_id", sa.Integer(), nullable=False),
            sa.Column("change_quantity", sa.Integer(), nullable=False),
            sa.Column("quantity_after", sa.Integer(), nullable=False),
            sa.Column("reason", sa.String(length=40), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["menu_item_id"], ["menu_items.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    inspector = sa.inspect(bind)
    if "inventory_movements" in set(inspector.get_table_names()):
        index_names = {index["name"] for index in inspector.get_indexes("inventory_movements")}
        if "ix_inventory_movements_menu_item_id" not in index_names:
            op.create_index("ix_inventory_movements_menu_item_id", "inventory_movements", ["menu_item_id"])
        if "ix_inventory_movements_created_at" not in index_names:
            op.create_index("ix_inventory_movements_created_at", "inventory_movements", ["created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "inventory_movements" in table_names:
        index_names = {index["name"] for index in inspector.get_indexes("inventory_movements")}
        if "ix_inventory_movements_created_at" in index_names:
            op.drop_index("ix_inventory_movements_created_at", table_name="inventory_movements")
        if "ix_inventory_movements_menu_item_id" in index_names:
            op.drop_index("ix_inventory_movements_menu_item_id", table_name="inventory_movements")
        op.drop_table("inventory_movements")

    if "menu_items" in table_names:
        menu_item_columns = {column["name"] for column in inspector.get_columns("menu_items")}
        with op.batch_alter_table("menu_items") as batch_op:
            if "low_stock_threshold" in menu_item_columns:
                batch_op.drop_column("low_stock_threshold")
            if "stock_quantity" in menu_item_columns:
                batch_op.drop_column("stock_quantity")
            if "track_inventory" in menu_item_columns:
                batch_op.drop_column("track_inventory")
