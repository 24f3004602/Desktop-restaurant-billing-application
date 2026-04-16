let autoUpdater = null;
try {
  ({ autoUpdater } = require("electron-updater"));
} catch (_error) {
  autoUpdater = null;
}

function setupAutoUpdater(logger = console) {
  if (!autoUpdater) {
    logger.warn("[updater] electron-updater not available, skipping updater setup");
    return {
      enabled: false,
      checkForUpdates: async () => ({ ok: false, reason: "not-installed" }),
    };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => logger.info("[updater] checking for updates"));
  autoUpdater.on("update-available", (info) => logger.info("[updater] update available", info?.version || ""));
  autoUpdater.on("update-not-available", () => logger.info("[updater] no update available"));
  autoUpdater.on("error", (error) => logger.error("[updater] error", error));
  autoUpdater.on("update-downloaded", () => logger.info("[updater] update downloaded"));

  return {
    enabled: true,
    checkForUpdates: async () => {
      const result = await autoUpdater.checkForUpdates();
      return {
        ok: true,
        updateInfo: result?.updateInfo || null,
      };
    },
  };
}

module.exports = {
  setupAutoUpdater,
};
