const fs = require("fs/promises");
const path = require("path");
const { app, dialog, ipcMain } = require("electron");
const reportsService = require("../services/reportsService");
const { authorize, toRoleIpcResponse } = require("../middleware/accessPolicy");

const adminOrManager = (handler) => toRoleIpcResponse(["MANAGER"], handler, "Unknown reports error");

function registerReportsHandlers() {
  ipcMain.handle("reports:get-dashboard", adminOrManager((payload) => reportsService.getDashboard(payload)));
  ipcMain.handle("reports:export-summary-pdf", async (event, payload) => {
    try {
      authorize(["MANAGER"], payload || {});
      const date = String(payload?.date || new Date().toISOString().slice(0, 10));
      const defaultPath = path.join(app.getPath("documents"), `management-summary-${date}.pdf`);
      const result = await dialog.showSaveDialog({
        title: "Export Management Summary PDF",
        defaultPath,
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });

      if (result.canceled || !result.filePath) {
        return { ok: true, data: { cancelled: true } };
      }

      const pdfData = await event.sender.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        pageSize: "A4"
      });

      await fs.writeFile(result.filePath, pdfData);
      return { ok: true, data: { cancelled: false, filePath: result.filePath } };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown reports export error"
      };
    }
  });
}

module.exports = {
  registerReportsHandlers
};
