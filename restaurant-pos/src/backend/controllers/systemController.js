const { ipcMain } = require("electron");
const systemService = require("../services/systemService");
const { authorize, toRoleIpcResponse } = require("../middleware/accessPolicy");

const adminOnly = (handler) => toRoleIpcResponse(["ADMIN"], handler, "Unknown system error");

function registerSystemHandlers() {
  ipcMain.handle("system:get-printer-profile", adminOnly(() => systemService.getPrinterProfile()));
  ipcMain.handle(
    "system:save-printer-profile",
    adminOnly((payload) => systemService.savePrinterProfile(payload))
  );
  ipcMain.handle("system:list-backups", adminOnly(() => systemService.listBackupFiles()));
  ipcMain.handle("system:create-backup", adminOnly(() => systemService.createBackup()));
  ipcMain.handle("system:validate-backup", adminOnly((payload) => systemService.validateBackupFile(payload)));
  ipcMain.handle("system:dry-run-restore", adminOnly((payload) => systemService.dryRunRestore(payload)));
  ipcMain.handle("system:restore-backup", adminOnly((payload) => systemService.restoreBackup(payload)));
  ipcMain.handle("system:list-printers", async (event, payload) => {
    try {
      authorize(["ADMIN"], payload || {});
      const webContents = event?.sender;
      if (!webContents || typeof webContents.getPrintersAsync !== "function") {
        return { ok: true, data: [] };
      }
      const printers = await webContents.getPrintersAsync();
      return { ok: true, data: printers };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to list printers"
      };
    }
  });
}

module.exports = {
  registerSystemHandlers
};
