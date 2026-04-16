from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.db.session import SessionLocal  # noqa: E402
from app.models.category import Category  # noqa: E402
from app.models.menu_item import MenuItem  # noqa: E402


def seed() -> None:
  db = SessionLocal()
  try:
    beverages = db.query(Category).filter(Category.name == "Beverages").first()
    if not beverages:
      beverages = Category(name="Beverages", display_order=1, is_active=True)
      db.add(beverages)
      db.flush()

    snacks = db.query(Category).filter(Category.name == "Snacks").first()
    if not snacks:
      snacks = Category(name="Snacks", display_order=2, is_active=True)
      db.add(snacks)
      db.flush()

    existing = db.query(MenuItem).filter(MenuItem.name == "Masala Tea").first()
    if not existing:
      db.add(
        MenuItem(
          category_id=beverages.id,
          name="Masala Tea",
          description="House masala tea",
          price_cents=2500,
          gst_percent=5,
          is_available=True,
        )
      )

    existing = db.query(MenuItem).filter(MenuItem.name == "Paneer Wrap").first()
    if not existing:
      db.add(
        MenuItem(
          category_id=snacks.id,
          name="Paneer Wrap",
          description="Spicy paneer wrap",
          price_cents=14900,
          gst_percent=5,
          is_available=True,
        )
      )

    db.commit()
    print("Seed complete")
  finally:
    db.close()


if __name__ == "__main__":
  seed()
