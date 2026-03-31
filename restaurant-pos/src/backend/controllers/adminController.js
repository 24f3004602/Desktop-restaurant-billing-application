const { ipcMain } = require("electron");
const adminService = require("../services/adminService");
const { toRoleIpcResponse } = require("../middleware/accessPolicy");

const adminOnly = (handler) => toRoleIpcResponse(["ADMIN"], handler, "Unknown admin error");

function registerAdminHandlers() {
  ipcMain.handle("admin:list-categories", adminOnly(() => adminService.listCategories()));
  ipcMain.handle("admin:create-category", adminOnly((payload) => adminService.createCategory(payload)));
  ipcMain.handle("admin:update-category", adminOnly((payload) => adminService.updateCategory(payload)));
  ipcMain.handle("admin:delete-category", adminOnly((payload) => adminService.deleteCategory(payload)));

  ipcMain.handle("admin:list-addons", adminOnly(() => adminService.listAddOns()));
  ipcMain.handle("admin:create-addon", adminOnly((payload) => adminService.createAddOn(payload)));

  ipcMain.handle("admin:list-menu-items", adminOnly(() => adminService.listMenuItems()));
  ipcMain.handle("admin:create-menu-item", adminOnly((payload) => adminService.createMenuItem(payload)));
  ipcMain.handle("admin:update-menu-item", adminOnly((payload) => adminService.updateMenuItem(payload)));
  ipcMain.handle("admin:delete-menu-item", adminOnly((payload) => adminService.deleteMenuItem(payload)));
  ipcMain.handle(
    "admin:toggle-menu-availability",
    adminOnly((payload) => adminService.toggleMenuAvailability(payload))
  );

  ipcMain.handle("admin:list-tables", adminOnly(() => adminService.listTables()));
  ipcMain.handle("admin:get-table-policy", adminOnly(() => adminService.getTablePolicy()));
  ipcMain.handle("admin:create-table", adminOnly((payload) => adminService.createTable(payload)));
  ipcMain.handle("admin:update-table", adminOnly((payload) => adminService.updateTable(payload)));
  ipcMain.handle("admin:delete-table", adminOnly((payload) => adminService.deleteTable(payload)));
}

module.exports = {
  registerAdminHandlers
};
