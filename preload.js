const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appAPI", {
  getConfig: () => ipcRenderer.invoke("system:get-app-config"),
  checkForUpdates: () => ipcRenderer.invoke("system:check-for-updates"),
  getReceiptSettings: () => ipcRenderer.invoke("system:get-receipt-settings"),
  saveReceiptSettings: (payload) => ipcRenderer.invoke("system:save-receipt-settings", payload)
});

contextBridge.exposeInMainWorld("printerAPI", {
  list: () => ipcRenderer.invoke("printer:list"),
  printHtml: (payload) => ipcRenderer.invoke("printer:print-html", payload),
  savePdf: (payload) => ipcRenderer.invoke("printer:save-pdf", payload)
});
