const { BrowserWindow, ipcMain } = require("electron");
const billingService = require("../services/billingService");
const { buildSampleTicket, renderReceipt80mm } = require("../services/receiptService");
const systemService = require("../services/systemService");
const { toRoleIpcResponse } = require("../middleware/accessPolicy");

const posOperator = (handler) => toRoleIpcResponse(["CASHIER"], handler, "Unknown POS error");

function registerPosHandlers() {
  ipcMain.handle("pos:get-menu", posOperator(() => billingService.getMenuSnapshot()));
  ipcMain.handle("pos:get-tables", posOperator(() => billingService.getActiveTables()));
  ipcMain.handle("pos:create-order", posOperator((payload) => billingService.createOrder(payload)));
  ipcMain.handle("pos:get-order", posOperator((payload) => billingService.getOrder(payload.orderId)));
  ipcMain.handle("pos:get-active-order", posOperator((payload) => billingService.getActiveOrder(payload)));
  ipcMain.handle("pos:add-item", posOperator((payload) => billingService.addItem(payload)));
  ipcMain.handle("pos:update-item-qty", posOperator((payload) => billingService.updateItemQuantity(payload)));
  ipcMain.handle("pos:remove-item", posOperator((payload) => billingService.removeItem(payload)));
  ipcMain.handle("pos:apply-discount", posOperator((payload) => billingService.applyDiscount(payload)));
  ipcMain.handle("pos:update-status", posOperator((payload) => billingService.updateOrderStatus(payload)));
  ipcMain.handle("pos:add-payment", posOperator((payload) => billingService.addPayment(payload)));
  ipcMain.handle("pos:merge-table-orders", posOperator((payload) => billingService.mergeTableOrders(payload)));
  ipcMain.handle(
    "pos:get-receipt-html",
    posOperator(({ orderId }) => {
      const order = billingService.getOrder(orderId);
      const profile = systemService.getPrinterProfile();
      return {
        orderId,
        orderNo: order.orderNo,
        html: renderReceipt80mm(order, profile)
      };
    })
  );
  ipcMain.handle(
    "pos:get-test-receipt-html",
    posOperator(({ profile = null } = {}) => {
      const printerProfile = profile || systemService.getPrinterProfile();
      const sampleOrder = buildSampleTicket();
      return {
        orderNo: sampleOrder.orderNo,
        html: renderReceipt80mm(sampleOrder, printerProfile)
      };
    })
  );
  ipcMain.handle(
    "pos:print-receipt",
    posOperator(async ({ orderId, profile = null }) => {
      const order = billingService.getOrder(orderId);
      const printerProfile = profile || systemService.getPrinterProfile();
      const html = renderReceipt80mm(order, printerProfile);

      await printHtmlReceipt(html, printerProfile);

      return {
        orderId,
        orderNo: order.orderNo,
        printedAt: new Date().toISOString()
      };
    })
  );
  ipcMain.handle(
    "pos:print-test-receipt",
    posOperator(async ({ profile = null } = {}) => {
      const printerProfile = profile || systemService.getPrinterProfile();
      const sampleOrder = buildSampleTicket();
      const html = renderReceipt80mm(sampleOrder, printerProfile);

      await printHtmlReceipt(html, printerProfile);

      return {
        printedAt: new Date().toISOString(),
        orderNo: sampleOrder.orderNo
      };
    })
  );
}

function printHtmlReceipt(htmlContent, profile) {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    printWindow.webContents.once("did-finish-load", () => {
      const widthMicrons = Math.max(50000, Math.min(120000, Number(profile?.paperWidthMm || 80) * 1000));
      printWindow.webContents.print(
        {
          silent: Boolean(profile?.silent),
          deviceName: profile?.printerName || undefined,
          printBackground: true,
          margins: {
            marginType: "none"
          },
          pageSize: {
            width: widthMicrons,
            height: 600000
          }
        },
        (success, failureReason) => {
          printWindow.close();
          if (!success) {
            reject(new Error(failureReason || "Receipt print failed"));
            return;
          }
          resolve();
        }
      );
    });

    printWindow.webContents.once("did-fail-load", () => {
      printWindow.close();
      reject(new Error("Failed to load receipt template"));
    });

    const dataUrl = `data:text/html;charset=UTF-8,${encodeURIComponent(htmlContent)}`;
    printWindow.loadURL(dataUrl).catch((error) => {
      printWindow.close();
      reject(error);
    });
  });
}

module.exports = {
  registerPosHandlers
};
