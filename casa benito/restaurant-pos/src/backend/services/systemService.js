const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { db, dbPath } = require("../db");

const backupDir = path.join(path.dirname(dbPath), "backups");
const requiredBackupTables = [
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

function ensureBackupDir() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function listBackupFiles() {
  ensureBackupDir();

  return fs
    .readdirSync(backupDir)
    .filter((file) => file.endsWith(".db"))
    .map((file) => {
      const fullPath = path.join(backupDir, file);
      const stat = fs.statSync(fullPath);
      return {
        fileName: file,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function createBackup() {
  ensureBackupDir();

  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "_",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");

  const fileName = `pos_backup_${ts}.db`;
  const fullPath = path.join(backupDir, fileName);
  const escapedPath = fullPath.replace(/'/g, "''");

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.exec(`VACUUM INTO '${escapedPath}'`);

  return {
    fileName,
    fullPath,
    backups: listBackupFiles()
  };
}

function restoreBackup({ fileName }) {
  if (!fileName) {
    throw new Error("fileName is required");
  }

  ensureBackupDir();
  const fullPath = path.join(backupDir, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error("Backup file not found");
  }

  const integrity = validateBackupFile({ fileName });
  if (!integrity.valid) {
    throw new Error(`Backup integrity failed: ${integrity.issues.join("; ")}`);
  }

  const sourceDb = new Database(fullPath, { readonly: true });

  try {
    const targetTables = db
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
        `
      )
      .all()
      .map((row) => row.name)
      .filter((name) => name !== "SchemaMigrations");

    const sourceTables = new Set(
      sourceDb
        .prepare(
          `
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
          `
        )
        .all()
        .map((row) => row.name)
    );

    const tablesToRestore = targetTables.filter((table) => sourceTables.has(table));

    const trx = db.transaction(() => {

      tablesToRestore.forEach((table) => {
        const tableName = quoteIdentifier(table);
        const cols = sourceDb
          .prepare(`PRAGMA table_info(${tableName})`)
          .all()
          .map((row) => row.name);

        if (cols.length === 0) {
          return;
        }

        db.prepare(`DELETE FROM ${tableName}`).run();

        const escapedCols = cols.map((col) => quoteIdentifier(col)).join(", ");
        const placeholders = cols.map(() => "?").join(", ");
        const insertStmt = db.prepare(`INSERT INTO ${tableName} (${escapedCols}) VALUES (${placeholders})`);

        const rows = sourceDb.prepare(`SELECT ${escapedCols} FROM ${tableName}`).all();
        rows.forEach((row) => {
          insertStmt.run(...cols.map((col) => row[col]));
        });
      });

      try {
        db.prepare("DELETE FROM sqlite_sequence").run();
        if (sourceTables.has("sqlite_sequence")) {
          const seqRows = sourceDb.prepare("SELECT name, seq FROM sqlite_sequence").all();
          const seqInsert = db.prepare("INSERT INTO sqlite_sequence(name, seq) VALUES(?, ?)");
          seqRows.forEach((row) => seqInsert.run(row.name, row.seq));
        }
      } catch (_error) {
        // sqlite_sequence may be absent when no AUTOINCREMENT rows exist yet.
      }
    });

    db.pragma("foreign_keys = OFF");
    try {
      trx();
    } finally {
      db.pragma("foreign_keys = ON");
    }
  } finally {
    sourceDb.close();
  }

  return {
    restoredFrom: fileName,
    restoredAt: new Date().toISOString()
  };
}

function getSetting(key, defaultValue = null) {
  const row = db.prepare("SELECT value FROM AppSettings WHERE key = ?").get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  db.prepare(
    `
      INSERT INTO AppSettings(key, value, updated_at)
      VALUES(?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `
  ).run(key, value);
}

function getPrinterProfile() {
  const stored = getSetting("printer_profile", "");
  if (!stored) {
    return {
      name: "Default",
      printerName: "",
      paperWidthMm: 80,
      silent: false,
      cutterFeedLines: 4
    };
  }

  try {
    return JSON.parse(stored);
  } catch (_error) {
    return {
      name: "Default",
      printerName: "",
      paperWidthMm: 80,
      silent: false,
      cutterFeedLines: 4
    };
  }
}

function savePrinterProfile(profile) {
  const normalized = {
    name: String(profile?.name || "Default"),
    printerName: String(profile?.printerName || ""),
    paperWidthMm: Number(profile?.paperWidthMm || 80),
    silent: Boolean(profile?.silent),
    cutterFeedLines: Number(profile?.cutterFeedLines ?? 4)
  };

  if (normalized.paperWidthMm < 50 || normalized.paperWidthMm > 120) {
    throw new Error("Paper width should be between 50mm and 120mm");
  }

  if (!Number.isInteger(normalized.cutterFeedLines) || normalized.cutterFeedLines < 0 || normalized.cutterFeedLines > 20) {
    throw new Error("Cutter feed lines should be between 0 and 20");
  }

  setSetting("printer_profile", JSON.stringify(normalized));
  return normalized;
}

function validateBackupFile({ fileName }) {
  if (!fileName) {
    throw new Error("fileName is required");
  }

  ensureBackupDir();
  const fullPath = path.join(backupDir, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error("Backup file not found");
  }

  const sourceDb = new Database(fullPath, { readonly: true });
  try {
    const sourceTableNames = sourceDb
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
        `
      )
      .all()
      .map((row) => row.name);

    const tableSet = new Set(sourceTableNames);
    const missingTables = requiredBackupTables.filter((name) => !tableSet.has(name));

    const quickCheckRows = sourceDb.prepare("PRAGMA quick_check").all();
    const quickCheckOk = quickCheckRows.every((row) => row.quick_check === "ok");

    const fkRows = sourceDb.prepare("PRAGMA foreign_key_check").all();

    const tableCounts = sourceTableNames.reduce((acc, tableName) => {
      const escaped = quoteIdentifier(tableName);
      const count = sourceDb.prepare(`SELECT COUNT(*) AS total FROM ${escaped}`).get().total;
      acc[tableName] = Number(count);
      return acc;
    }, {});

    const issues = [];
    if (!quickCheckOk) {
      issues.push("PRAGMA quick_check failed");
    }
    if (fkRows.length > 0) {
      issues.push(`Foreign key violations found: ${fkRows.length}`);
    }
    if (missingTables.length > 0) {
      issues.push(`Missing required tables: ${missingTables.join(", ")}`);
    }

    return {
      fileName,
      valid: issues.length === 0,
      issues,
      missingTables,
      tableCounts,
      quickCheck: quickCheckRows,
      foreignKeyViolations: fkRows.length
    };
  } finally {
    sourceDb.close();
  }
}

function dryRunRestore({ fileName }) {
  const integrity = validateBackupFile({ fileName });

  ensureBackupDir();
  const fullPath = path.join(backupDir, fileName);
  const sourceDb = new Database(fullPath, { readonly: true });

  try {
    const targetTables = db
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
        `
      )
      .all()
      .map((row) => row.name)
      .filter((name) => name !== "SchemaMigrations");

    const sourceTables = new Set(
      sourceDb
        .prepare(
          `
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
          `
        )
        .all()
        .map((row) => row.name)
    );

    const tablePlan = targetTables
      .filter((table) => sourceTables.has(table))
      .map((table) => {
        const escaped = quoteIdentifier(table);
        const currentCount = Number(db.prepare(`SELECT COUNT(*) AS total FROM ${escaped}`).get().total);
        const backupCount = Number(sourceDb.prepare(`SELECT COUNT(*) AS total FROM ${escaped}`).get().total);
        return {
          table,
          currentCount,
          backupCount,
          delta: backupCount - currentCount
        };
      });

    return {
      fileName,
      valid: integrity.valid,
      issues: integrity.issues,
      tablePlan,
      summary: {
        tablesAffected: tablePlan.length,
        currentRows: tablePlan.reduce((sum, row) => sum + row.currentCount, 0),
        backupRows: tablePlan.reduce((sum, row) => sum + row.backupCount, 0)
      }
    };
  } finally {
    sourceDb.close();
  }
}

module.exports = {
  createBackup,
  listBackupFiles,
  validateBackupFile,
  dryRunRestore,
  restoreBackup,
  getPrinterProfile,
  savePrinterProfile
};
