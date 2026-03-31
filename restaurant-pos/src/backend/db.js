const path = require("path");
const Database = require("better-sqlite3");

const dbPath = process.env.POS_DB_PATH
  ? path.resolve(process.env.POS_DB_PATH)
  : path.join(__dirname, "..", "..", "database", "pos.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS SchemaMigrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS MenuItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      is_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES Categories(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS Variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL CHECK(price >= 0),
      is_default INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (menu_item_id) REFERENCES MenuItems(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS AddOns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      price REAL NOT NULL CHECK(price >= 0),
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ItemAddOns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL,
      add_on_id INTEGER NOT NULL,
      FOREIGN KEY (menu_item_id) REFERENCES MenuItems(id) ON DELETE CASCADE,
      FOREIGN KEY (add_on_id) REFERENCES AddOns(id) ON DELETE CASCADE,
      UNIQUE(menu_item_id, add_on_id)
    );

    CREATE TABLE IF NOT EXISTS Orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      order_type TEXT NOT NULL CHECK(order_type IN ('DINE_IN','TAKEAWAY')),
      table_ref TEXT,
      status TEXT NOT NULL CHECK(status IN ('DRAFT','PREPARING','SERVED','PAID','CANCELLED')),
      discount_type TEXT NOT NULL DEFAULT 'NONE' CHECK(discount_type IN ('NONE','PERCENT','FIXED')),
      discount_value REAL NOT NULL DEFAULT 0,
      notes TEXT,
      cancelled_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      paid_at TEXT
    );

    CREATE TABLE IF NOT EXISTS OrderItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      variant_id INTEGER NOT NULL,
      qty INTEGER NOT NULL CHECK(qty > 0),
      unit_price REAL NOT NULL CHECK(unit_price >= 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES MenuItems(id) ON DELETE RESTRICT,
      FOREIGN KEY (variant_id) REFERENCES Variants(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS OrderItemAddOns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id INTEGER NOT NULL,
      add_on_id INTEGER NOT NULL,
      price REAL NOT NULL CHECK(price >= 0),
      FOREIGN KEY (order_item_id) REFERENCES OrderItems(id) ON DELETE CASCADE,
      FOREIGN KEY (add_on_id) REFERENCES AddOns(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS Payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('CASH','UPI','CARD')),
      amount REAL NOT NULL CHECK(amount > 0),
      reference_no TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS RestaurantTables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 4 CHECK(capacity > 0),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_table_ref ON Orders(table_ref, status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON OrderItems(order_id);
    CREATE INDEX IF NOT EXISTS idx_variants_menu_item_id ON Variants(menu_item_id);
    CREATE INDEX IF NOT EXISTS idx_tables_is_active ON RestaurantTables(is_active);
  `);

  applyMigrations();

  seedDemoMenu();
  seedDefaultTables();
}

function applyMigrations() {
  const migrations = [
    {
      version: 1,
      name: "create_app_settings",
      run: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS AppSettings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );
        `);
      }
    },
    {
      version: 2,
      name: "users_role_and_auth_sessions",
      run: () => {
        const columns = db.prepare("PRAGMA table_info(Users)").all().map((row) => row.name);
        if (!columns.includes("role")) {
          db.exec("ALTER TABLE Users ADD COLUMN role TEXT NOT NULL DEFAULT 'ADMIN'");
        }

        db.exec(`
          CREATE TABLE IF NOT EXISTS AuthSessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            user_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            revoked INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON AuthSessions(token);
          CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON AuthSessions(user_id);
        `);
      }
    }
  ];

  const getMigration = db.prepare("SELECT version FROM SchemaMigrations WHERE version = ?");
  const insertMigration = db.prepare("INSERT INTO SchemaMigrations(version, name) VALUES(?, ?)");

  migrations.forEach((migration) => {
    const exists = getMigration.get(migration.version);
    if (exists) {
      return;
    }

    const trx = db.transaction(() => {
      migration.run();
      insertMigration.run(migration.version, migration.name);
    });

    trx();
  });
}

function seedDemoMenu() {
  const count = db.prepare("SELECT COUNT(*) AS total FROM Categories").get().total;
  if (count > 0) return;

  const insertCategory = db.prepare("INSERT INTO Categories(name) VALUES(?)");
  const insertItem = db.prepare("INSERT INTO MenuItems(category_id, name, sku) VALUES(?, ?, ?)");
  const insertVariant = db.prepare("INSERT INTO Variants(menu_item_id, name, price, is_default) VALUES(?, ?, ?, ?)");
  const insertAddOn = db.prepare("INSERT INTO AddOns(name, price) VALUES(?, ?)");
  const mapAddOn = db.prepare("INSERT INTO ItemAddOns(menu_item_id, add_on_id) VALUES(?, ?)");

  const trx = db.transaction(() => {
    const starters = insertCategory.run("Starters").lastInsertRowid;
    const mains = insertCategory.run("Main Course").lastInsertRowid;
    const pizza = insertCategory.run("Pizza").lastInsertRowid;
    const beverages = insertCategory.run("Beverages").lastInsertRowid;
    const desserts = insertCategory.run("Desserts").lastInsertRowid;

    const garlicBread = insertItem.run(starters, "Garlic Bread", "ST-GAR-001").lastInsertRowid;
    insertVariant.run(garlicBread, "Regular", 120, 1);
    insertVariant.run(garlicBread, "Large", 180, 0);

    const paneer = insertItem.run(mains, "Paneer Butter Masala", "MC-PBM-001").lastInsertRowid;
    insertVariant.run(paneer, "Half", 280, 1);
    insertVariant.run(paneer, "Full", 460, 0);

    const margherita = insertItem.run(pizza, "Margherita Pizza", "PZ-MRG-001").lastInsertRowid;
    insertVariant.run(margherita, "Small", 200, 0);
    insertVariant.run(margherita, "Medium", 260, 1);
    insertVariant.run(margherita, "Large", 340, 0);

    const coldCoffee = insertItem.run(beverages, "Cold Coffee", "BV-CCF-001").lastInsertRowid;
    insertVariant.run(coldCoffee, "Regular", 140, 1);

    const brownie = insertItem.run(desserts, "Brownie With Ice Cream", "DS-BWN-001").lastInsertRowid;
    insertVariant.run(brownie, "Single", 180, 1);

    const extraCheese = insertAddOn.run("Extra Cheese", 40).lastInsertRowid;
    const butter = insertAddOn.run("Butter Topping", 20).lastInsertRowid;
    const extraSauce = insertAddOn.run("Extra Sauce", 15).lastInsertRowid;

    mapAddOn.run(garlicBread, butter);
    mapAddOn.run(margherita, extraCheese);
    mapAddOn.run(margherita, extraSauce);
    mapAddOn.run(paneer, butter);
  });

  trx();
}

function seedDefaultTables() {
  const count = db.prepare("SELECT COUNT(*) AS total FROM RestaurantTables").get().total;
  if (count > 0) return;

  const insert = db.prepare(
    "INSERT INTO RestaurantTables(table_code, display_name, capacity, is_active) VALUES(?, ?, ?, 1)"
  );

  const trx = db.transaction(() => {
    for (let i = 1; i <= 10; i += 1) {
      const code = `T${i}`;
      insert.run(code, `Table ${i}`, 4);
    }
  });

  trx();
}

module.exports = {
  db,
  dbPath,
  initializeDatabase
};
