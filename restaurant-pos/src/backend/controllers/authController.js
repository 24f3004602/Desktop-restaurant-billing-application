const { ipcMain } = require("electron");
const authService = require("../services/authService");

function toIpcResponse(handler) {
  return async (_event, payload) => {
    try {
      const data = await handler(payload || {});
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown auth error"
      };
    }
  };
}

function registerAuthHandlers() {
  ipcMain.handle("auth:is-configured", toIpcResponse(() => ({ configured: authService.isConfigured() })));
  ipcMain.handle("auth:setup-admin", toIpcResponse((payload) => authService.createInitialAdmin(payload)));
  ipcMain.handle("auth:login", toIpcResponse((payload) => authService.login(payload)));
  ipcMain.handle("auth:get-session", toIpcResponse((payload) => authService.getSession(payload)));
  ipcMain.handle("auth:logout", toIpcResponse((payload) => authService.logout(payload)));
}

module.exports = {
  registerAuthHandlers
};
