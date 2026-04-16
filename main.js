const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, dialog } = require("electron");
const { startBackend, stopBackend } = require("./electron/backendProcess");
const { registerIpcHandlers } = require("./electron/ipcHandlers");
const { setupAutoUpdater } = require("./electron/autoUpdater");

let mainWindow = null;

function appendCrashLog(message, error = null) {
  try {
    const logsDir = path.join(app.getPath("userData"), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const line = [new Date().toISOString(), message, error ? String(error.stack || error.message || error) : ""].join(" | ");
    fs.appendFileSync(path.join(logsDir, "main.log"), `${line}\n`, "utf8");
  } catch (_error) {
    // Fail-safe: avoid recursive crashes while logging.
  }
}

function registerCrashHandlers() {
  process.on("uncaughtException", (error) => {
    appendCrashLog("uncaughtException", error);
  });

  process.on("unhandledRejection", (reason) => {
    appendCrashLog("unhandledRejection", reason instanceof Error ? reason : new Error(String(reason)));
  });

  app.on("render-process-gone", (_event, webContents, details) => {
    appendCrashLog(`render-process-gone:${details.reason}`, new Error(`exitCode=${details.exitCode} url=${webContents.getURL()}`));
  });

  app.on("child-process-gone", (_event, details) => {
    appendCrashLog(`child-process-gone:${details.type}:${details.reason}`, new Error(`exitCode=${details.exitCode}`));
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1220,
    minHeight: 760,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    }
  });

  const devServerUrl = process.env.ELECTRON_START_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    return;
  }

  const builtIndex = path.join(__dirname, "frontend", "dist", "index.html");
  if (!fs.existsSync(builtIndex)) {
    dialog.showErrorBox("Frontend Build Missing", "Vue frontend build not found. Run `npm run build` or `npm run dev`.");
    app.quit();
    return;
  }

  mainWindow.loadFile(builtIndex);
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const existing = BrowserWindow.getAllWindows()[0];
    if (!existing) {
      return;
    }

    if (existing.isMinimized()) {
      existing.restore();
    }
    existing.focus();
  });
}

app.whenReady()
  .then(async () => {
    registerCrashHandlers();
    await startBackend();
    const updater = setupAutoUpdater(console);
    createWindow();

    registerIpcHandlers({
      getMainWindow: () => mainWindow,
      checkForUpdates: updater.checkForUpdates,
    });

    if (updater.enabled) {
      updater.checkForUpdates().catch((error) => {
        appendCrashLog("updater-check-failed", error);
      });
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error) => {
    appendCrashLog("startup-failure", error);
    dialog.showErrorBox("Startup Error", `Application failed to start.\n\n${error.message}`);
    app.quit();
  });

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});
