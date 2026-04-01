const { db } = require("../db");

const TABLE_POLICY = {
  fixedCount: true,
  allowCreate: false,
  allowDelete: false
};

function normalizeBool(value) {
  return value ? 1 : 0;
}

function listCategories() {
  return db
    .prepare(
      `
      SELECT id, name, is_active AS isActive, created_at AS createdAt
      FROM Categories
      ORDER BY name
      `
    )
    .all();
}

function createCategory({ name }) {
  if (!name || !name.trim()) {
    throw new Error("Category name is required");
  }

  db.prepare("INSERT INTO Categories(name) VALUES(?)").run(name.trim());
  return listCategories();
}

function updateCategory({ id, name, isActive }) {
  if (!id) throw new Error("Category id is required");
  if (!name || !name.trim()) throw new Error("Category name is required");

  db.prepare("UPDATE Categories SET name = ?, is_active = ? WHERE id = ?").run(name.trim(), normalizeBool(isActive), id);
  return listCategories();
}

function deleteCategory({ id }) {
  if (!id) throw new Error("Category id is required");
  db.prepare("DELETE FROM Categories WHERE id = ?").run(id);
  return listCategories();
}

function listAddOns() {
  return db
    .prepare(
      `
      SELECT id, name, price, is_active AS isActive
      FROM AddOns
      ORDER BY name
      `
    )
    .all();
}

function createAddOn({ name, price }) {
  if (!name || !name.trim()) throw new Error("Add-on name is required");
  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice) || numericPrice < 0) {
    throw new Error("Add-on price is invalid");
  }

  db.prepare("INSERT INTO AddOns(name, price, is_active) VALUES(?, ?, 1)").run(name.trim(), numericPrice);
  return listAddOns();
}

function listMenuItems() {
  const rows = db
    .prepare(
      `
      SELECT
        m.id,
        m.name,
        m.sku,
        m.is_available AS isAvailable,
        m.category_id AS categoryId,
        c.name AS categoryName
      FROM MenuItems m
      INNER JOIN Categories c ON c.id = m.category_id
      ORDER BY m.name
      `
    )
    .all();

  const variants = db
    .prepare(
      `
      SELECT id, menu_item_id AS menuItemId, name, price, is_default AS isDefault
      FROM Variants
      ORDER BY menu_item_id, price
      `
    )
    .all();

  const addOns = db
    .prepare(
      `
      SELECT
        ia.menu_item_id AS menuItemId,
        a.id,
        a.name,
        a.price
      FROM ItemAddOns ia
      INNER JOIN AddOns a ON a.id = ia.add_on_id
      ORDER BY a.name
      `
    )
    .all();

  const variantsByItem = new Map();
  variants.forEach((variant) => {
    const current = variantsByItem.get(variant.menuItemId) || [];
    current.push(variant);
    variantsByItem.set(variant.menuItemId, current);
  });

  const addOnsByItem = new Map();
  addOns.forEach((addOn) => {
    const current = addOnsByItem.get(addOn.menuItemId) || [];
    current.push({ id: addOn.id, name: addOn.name, price: addOn.price });
    addOnsByItem.set(addOn.menuItemId, current);
  });

  return rows.map((item) => ({
    ...item,
    variants: variantsByItem.get(item.id) || [],
    addOns: addOnsByItem.get(item.id) || []
  }));
}

function createMenuItem({ categoryId, name, sku = null, isAvailable = true, variants = [], addOnIds = [] }) {
  if (!categoryId) throw new Error("Category is required");
  if (!name || !name.trim()) throw new Error("Item name is required");
  if (!Array.isArray(variants) || variants.length === 0) throw new Error("At least one variant is required");

  const cleanedVariants = variants.map((variant, index) => {
    const variantName = String(variant.name || "").trim();
    const variantPrice = Number(variant.price);
    if (!variantName) throw new Error("Variant name is required");
    if (Number.isNaN(variantPrice) || variantPrice < 0) throw new Error("Variant price is invalid");
    return {
      name: variantName,
      price: variantPrice,
      isDefault: index === 0 ? 1 : normalizeBool(variant.isDefault)
    };
  });

  const trx = db.transaction(() => {
    const itemInsert = db
      .prepare(
        "INSERT INTO MenuItems(category_id, name, sku, is_available) VALUES(?, ?, ?, ?)"
      )
      .run(categoryId, name.trim(), sku ? String(sku).trim() : null, normalizeBool(isAvailable));

    const menuItemId = Number(itemInsert.lastInsertRowid);

    const variantInsert = db.prepare(
      "INSERT INTO Variants(menu_item_id, name, price, is_default) VALUES(?, ?, ?, ?)"
    );

    cleanedVariants.forEach((variant) => {
      variantInsert.run(menuItemId, variant.name, variant.price, variant.isDefault);
    });

    if (addOnIds.length) {
      const mapInsert = db.prepare("INSERT OR IGNORE INTO ItemAddOns(menu_item_id, add_on_id) VALUES(?, ?)");
      [...new Set(addOnIds.map(Number))].forEach((addOnId) => {
        mapInsert.run(menuItemId, addOnId);
      });
    }
  });

  trx();
  return listMenuItems();
}

function updateMenuItem({ id, categoryId, name, sku = null, isAvailable = true, variants = [], addOnIds = [] }) {
  if (!id) throw new Error("Menu item id is required");
  if (!categoryId) throw new Error("Category is required");
  if (!name || !name.trim()) throw new Error("Item name is required");
  if (!Array.isArray(variants) || variants.length === 0) throw new Error("At least one variant is required");

  const cleanedVariants = variants.map((variant, index) => {
    const variantName = String(variant.name || "").trim();
    const variantPrice = Number(variant.price);
    if (!variantName) throw new Error("Variant name is required");
    if (Number.isNaN(variantPrice) || variantPrice < 0) throw new Error("Variant price is invalid");
    return {
      name: variantName,
      price: variantPrice,
      isDefault: index === 0 ? 1 : normalizeBool(variant.isDefault)
    };
  });

  const trx = db.transaction(() => {
    db.prepare("UPDATE MenuItems SET category_id = ?, name = ?, sku = ?, is_available = ? WHERE id = ?").run(
      categoryId,
      name.trim(),
      sku ? String(sku).trim() : null,
      normalizeBool(isAvailable),
      id
    );

    db.prepare("DELETE FROM Variants WHERE menu_item_id = ?").run(id);
    const variantInsert = db.prepare(
      "INSERT INTO Variants(menu_item_id, name, price, is_default) VALUES(?, ?, ?, ?)"
    );
    cleanedVariants.forEach((variant) => {
      variantInsert.run(id, variant.name, variant.price, variant.isDefault);
    });

    db.prepare("DELETE FROM ItemAddOns WHERE menu_item_id = ?").run(id);
    const mapInsert = db.prepare("INSERT OR IGNORE INTO ItemAddOns(menu_item_id, add_on_id) VALUES(?, ?)");
    [...new Set(addOnIds.map(Number))].forEach((addOnId) => {
      mapInsert.run(id, addOnId);
    });
  });

  trx();
  return listMenuItems();
}

function deleteMenuItem({ id }) {
  if (!id) throw new Error("Menu item id is required");
  db.prepare("DELETE FROM MenuItems WHERE id = ?").run(id);
  return listMenuItems();
}

function toggleMenuAvailability({ id, isAvailable }) {
  if (!id) throw new Error("Menu item id is required");
  db.prepare("UPDATE MenuItems SET is_available = ? WHERE id = ?").run(normalizeBool(isAvailable), id);
  return listMenuItems();
}

function listTables() {
  return db
    .prepare(
      `
      SELECT id, table_code AS tableCode, display_name AS displayName, capacity, is_active AS isActive
      FROM RestaurantTables
      ORDER BY id
      `
    )
    .all();
}

function getTablePolicy() {
  return {
    ...TABLE_POLICY,
    currentCount: Number(db.prepare("SELECT COUNT(*) AS total FROM RestaurantTables").get().total || 0)
  };
}

function createTable({ tableCode, displayName, capacity = 4, isActive = true }) {
  if (TABLE_POLICY.fixedCount && !TABLE_POLICY.allowCreate) {
    throw new Error("Table creation is locked. This outlet uses fixed table count policy.");
  }

  if (!tableCode || !String(tableCode).trim()) throw new Error("Table code is required");
  if (!displayName || !String(displayName).trim()) throw new Error("Display name is required");

  const numericCapacity = Number(capacity);
  if (!Number.isInteger(numericCapacity) || numericCapacity <= 0) {
    throw new Error("Table capacity is invalid");
  }

  db.prepare(
    "INSERT INTO RestaurantTables(table_code, display_name, capacity, is_active) VALUES(?, ?, ?, ?)"
  ).run(String(tableCode).trim(), String(displayName).trim(), numericCapacity, normalizeBool(isActive));

  return listTables();
}

function updateTable({ id, tableCode, displayName, capacity = 4, isActive = true }) {
  if (!id) throw new Error("Table id is required");
  if (!tableCode || !String(tableCode).trim()) throw new Error("Table code is required");
  if (!displayName || !String(displayName).trim()) throw new Error("Display name is required");

  const numericCapacity = Number(capacity);
  if (!Number.isInteger(numericCapacity) || numericCapacity <= 0) {
    throw new Error("Table capacity is invalid");
  }

  db.prepare(
    "UPDATE RestaurantTables SET table_code = ?, display_name = ?, capacity = ?, is_active = ? WHERE id = ?"
  ).run(String(tableCode).trim(), String(displayName).trim(), numericCapacity, normalizeBool(isActive), id);

  return listTables();
}

function deleteTable({ id }) {
  if (!id) throw new Error("Table id is required");

  if (TABLE_POLICY.fixedCount && !TABLE_POLICY.allowDelete) {
    throw new Error("Table deletion is locked. This outlet uses fixed table count policy.");
  }

  const activeSession = db
    .prepare(
      "SELECT id FROM Orders WHERE table_ref = (SELECT table_code FROM RestaurantTables WHERE id = ?) AND status IN ('DRAFT','PREPARING','SERVED') LIMIT 1"
    )
    .get(id);

  if (activeSession) {
    throw new Error("Cannot delete table with an active order session");
  }

  db.prepare("DELETE FROM RestaurantTables WHERE id = ?").run(id);
  return listTables();
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listAddOns,
  createAddOn,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuAvailability,
  getTablePolicy,
  listTables,
  createTable,
  updateTable,
  deleteTable
};
