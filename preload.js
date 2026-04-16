const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posAPI", {
  getMenu: (payload) => ipcRenderer.invoke("pos:get-menu", payload),
  getTables: (payload) => ipcRenderer.invoke("pos:get-tables", payload),
  createOrder: (payload) => ipcRenderer.invoke("pos:create-order", payload),
  getOrder: (payload) => ipcRenderer.invoke("pos:get-order", payload),
  getActiveOrder: (payload) => ipcRenderer.invoke("pos:get-active-order", payload),
  addItem: (payload) => ipcRenderer.invoke("pos:add-item", payload),
  updateItemQuantity: (payload) => ipcRenderer.invoke("pos:update-item-qty", payload),
  removeItem: (payload) => ipcRenderer.invoke("pos:remove-item", payload),
  applyDiscount: (payload) => ipcRenderer.invoke("pos:apply-discount", payload),
  updateStatus: (payload) => ipcRenderer.invoke("pos:update-status", payload),
  addPayment: (payload) => ipcRenderer.invoke("pos:add-payment", payload),
  mergeTableOrders: (payload) => ipcRenderer.invoke("pos:merge-table-orders", payload),
  printReceipt: (payload) => ipcRenderer.invoke("pos:print-receipt", payload),
  getReceiptHtml: (payload) => ipcRenderer.invoke("pos:get-receipt-html", payload),
  getTestReceiptHtml: (payload) => ipcRenderer.invoke("pos:get-test-receipt-html", payload),
  printTestReceipt: (payload) => ipcRenderer.invoke("pos:print-test-receipt", payload)
});

contextBridge.exposeInMainWorld("adminAPI", {
  listCategories: (payload) => ipcRenderer.invoke("admin:list-categories", payload),
  createCategory: (payload) => ipcRenderer.invoke("admin:create-category", payload),
  updateCategory: (payload) => ipcRenderer.invoke("admin:update-category", payload),
  deleteCategory: (payload) => ipcRenderer.invoke("admin:delete-category", payload),

  listAddOns: (payload) => ipcRenderer.invoke("admin:list-addons", payload),
  createAddOn: (payload) => ipcRenderer.invoke("admin:create-addon", payload),

  listMenuItems: (payload) => ipcRenderer.invoke("admin:list-menu-items", payload),
  createMenuItem: (payload) => ipcRenderer.invoke("admin:create-menu-item", payload),
  updateMenuItem: (payload) => ipcRenderer.invoke("admin:update-menu-item", payload),
  deleteMenuItem: (payload) => ipcRenderer.invoke("admin:delete-menu-item", payload),
  toggleMenuAvailability: (payload) => ipcRenderer.invoke("admin:toggle-menu-availability", payload),

  listTables: (payload) => ipcRenderer.invoke("admin:list-tables", payload),
  getTablePolicy: (payload) => ipcRenderer.invoke("admin:get-table-policy", payload),
  createTable: (payload) => ipcRenderer.invoke("admin:create-table", payload),
  updateTable: (payload) => ipcRenderer.invoke("admin:update-table", payload),
  deleteTable: (payload) => ipcRenderer.invoke("admin:delete-table", payload)
});

contextBridge.exposeInMainWorld("systemAPI", {
  getPrinterProfile: (payload) => ipcRenderer.invoke("system:get-printer-profile", payload),
  savePrinterProfile: (payload) => ipcRenderer.invoke("system:save-printer-profile", payload),
  listPrinters: (payload) => ipcRenderer.invoke("system:list-printers", payload),
  listBackups: (payload) => ipcRenderer.invoke("system:list-backups", payload),
  createBackup: (payload) => ipcRenderer.invoke("system:create-backup", payload),
  validateBackup: (payload) => ipcRenderer.invoke("system:validate-backup", payload),
  dryRunRestore: (payload) => ipcRenderer.invoke("system:dry-run-restore", payload),
  restoreBackup: (payload) => ipcRenderer.invoke("system:restore-backup", payload)
});

contextBridge.exposeInMainWorld("reportsAPI", {
  getDashboard: (payload) => ipcRenderer.invoke("reports:get-dashboard", payload),
  exportSummaryPdf: (payload) => ipcRenderer.invoke("reports:export-summary-pdf", payload)
});

contextBridge.exposeInMainWorld("appAPI", {
  getConfig: () => ipcRenderer.invoke("system:get-app-config"),
  checkForUpdates: () => ipcRenderer.invoke("system:check-for-updates")
});

contextBridge.exposeInMainWorld("printerAPI", {
  list: () => ipcRenderer.invoke("printer:list"),
  printHtml: (payload) => ipcRenderer.invoke("printer:print-html", payload),
  savePdf: (payload) => ipcRenderer.invoke("printer:save-pdf", payload)
});
