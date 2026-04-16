"""add menu_item_name to order_items

Revision ID: 20260416_0002
Revises: 20260413_0001
Create Date: 2026-04-16 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260416_0002"
down_revision: str | None = "20260413_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "order_items",
        sa.Column("menu_item_name", sa.String(length=120), nullable=False, server_default="Unknown Item"),
    )

    op.execute(
        """
        UPDATE order_items
        SET menu_item_name = COALESCE(
            (SELECT name FROM menu_items WHERE menu_items.id = order_items.menu_item_id),
            'Unknown Item'
        )
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("order_items") as batch_op:
        batch_op.drop_column("menu_item_name")
