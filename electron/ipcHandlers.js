const { app, ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const { listPrinters, printReceiptHtml, saveReceiptPdf } = require("./printer");

const RECEIPT_SETTINGS_FILE = "receipt-settings.json";
const DEFAULT_RECEIPT_SETTINGS = {
  name: "Restaurant POS",
  address: "",
  phone: "",
  gstin: "",
  footer: "Thank you for dining with us.",
};

function receiptSettingsPath() {
  return path.join(app.getPath("userData"), RECEIPT_SETTINGS_FILE);
}

function normalizeReceiptSettings(input = {}) {
  return {
    name: String(input.name || DEFAULT_RECEIPT_SETTINGS.name).trim() || DEFAULT_RECEIPT_SETTINGS.name,
    address: String(input.address || "").trim(),
    phone: String(input.phone || "").trim(),
    gstin: String(input.gstin || "").trim(),
    footer: String(input.footer || DEFAULT_RECEIPT_SETTINGS.footer).trim() || DEFAULT_RECEIPT_SETTINGS.footer,
  };
}

async function readReceiptSettings() {
  try {
    const content = await fs.readFile(receiptSettingsPath(), "utf8");
    return normalizeReceiptSettings(JSON.parse(content));
  } catch (_error) {
    return { ...DEFAULT_RECEIPT_SETTINGS };
  }
}

async function writeReceiptSettings(payload) {
  const normalized = normalizeReceiptSettings(payload || {});
  const filePath = receiptSettingsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

function registerIpcHandlers({ getMainWindow, checkForUpdates }) {
  ipcMain.handle("system:get-app-config", async () => {
    return {
      ok: true,
      data: {
        appVersion: app.getVersion(),
        platform: process.platform,
      },
    };
  });

  ipcMain.handle("system:check-for-updates", async () => {
    if (typeof checkForUpdates !== "function") {
      return { ok: false, error: "Updater unavailable" };
    }

    try {
      const result = await checkForUpdates();
      return { ok: true, data: result };
    } catch (error) {
      return { ok: false, error: error?.message || "Failed to check for updates" };
    }
  });

  ipcMain.handle("system:get-receipt-settings", async () => {
    try {
      const settings = await readReceiptSettings();
      return { ok: true, data: settings };
    } catch (error) {
      return { ok: false, error: error?.message || "Unable to load receipt settings" };
    }
  });

  ipcMain.handle("system:save-receipt-settings", async (_event, payload) => {
    try {
      const saved = await writeReceiptSettings(payload);
      return { ok: true, data: saved };
    } catch (error) {
      return { ok: false, error: error?.message || "Unable to save receipt settings" };
    }
  });

  ipcMain.handle("printer:list", async () => {
    try {
      const printers = await listPrinters(getMainWindow());
      return { ok: true, data: printers };
    } catch (error) {
      return { ok: false, error: error?.message || "Unable to list printers" };
    }
  });

  ipcMain.handle("printer:print-html", async (_event, payload) => {
    try {
      await printReceiptHtml(payload?.html || "", {
        silent: payload?.silent,
        deviceName: payload?.deviceName,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || "Print failed" };
    }
  });

  ipcMain.handle("printer:save-pdf", async (_event, payload) => {
    try {
      const result = await saveReceiptPdf(payload?.html || "", {
        filePath: payload?.filePath,
      });
      return { ok: true, data: result };
    } catch (error) {
      return { ok: false, error: error?.message || "Failed to save PDF" };
    }
  });
}

module.exports = {
  registerIpcHandlers,
};
