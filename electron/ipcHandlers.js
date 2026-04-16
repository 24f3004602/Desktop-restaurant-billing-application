const { app, ipcMain } = require("electron");

const { listPrinters, printReceiptHtml, saveReceiptPdf } = require("./printer");

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
