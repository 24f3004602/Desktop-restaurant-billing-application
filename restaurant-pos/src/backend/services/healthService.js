const fs = require("fs");
const path = require("path");
const { db, dbPath } = require("../db");

const REQUIRED_TABLES = [
  "Users",
  "Categories",
  "MenuItems",
  "Variants",
  "AddOns",
  "ItemAddOns",
  "Orders",
  "OrderItems",
  "OrderItemAddOns",
  "Payments",
  "RestaurantTables"
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function assertWritableDirectory(dirPath) {
  ensureDir(dirPath);
  const probe = path.join(dirPath, ".healthcheck");
  fs.writeFileSync(probe, "ok", "utf8");
  fs.unlinkSync(probe);
}

function assertDatabaseConnectivity() {
  const row = db.prepare("SELECT 1 AS ok").get();
  if (!row || Number(row.ok) !== 1) {
    throw new Error("Database connectivity check failed");
  }
}

function assertRequiredTables() {
  const tableRows = db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `
    )
    .all();

  const names = new Set(tableRows.map((row) => row.name));
  const missing = REQUIRED_TABLES.filter((name) => !names.has(name));
  if (missing.length > 0) {
    throw new Error(`Required tables missing: ${missing.join(", ")}`);
  }
}

function runStartupHealthChecks() {
  assertDatabaseConnectivity();
  assertRequiredTables();

  const databaseDir = path.dirname(dbPath);
  const backupDir = path.join(databaseDir, "backups");

  assertWritableDirectory(databaseDir);
  assertWritableDirectory(backupDir);

  return {
    dbPath,
    backupDir,
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  runStartupHealthChecks
};
