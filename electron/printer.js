const path = require("path");
const fs = require("fs/promises");
const { BrowserWindow, dialog } = require("electron");

async function listPrinters(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return [];
  }

  const printers = await mainWindow.webContents.getPrintersAsync();
  return printers.map((printer) => ({
    name: printer.name,
    displayName: printer.displayName || printer.name,
    status: printer.status,
    isDefault: Boolean(printer.isDefault),
  }));
}

async function printReceiptHtml(html, options = {}) {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html || "")}`);

    const result = await new Promise((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: Boolean(options.silent),
          deviceName: options.deviceName || undefined,
          printBackground: true,
        },
        (success, failureReason) => {
          if (!success) {
            reject(new Error(failureReason || "Printing failed"));
            return;
          }
          resolve({ ok: true });
        }
      );
    });

    return result;
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.close();
    }
  }
}

async function saveReceiptPdf(html, options = {}) {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html || "")}`);

    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    });

    let outputPath = options.filePath;
    if (!outputPath) {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "Save Receipt PDF",
        defaultPath: path.join(process.cwd(), `receipt-${Date.now()}.pdf`),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (canceled || !filePath) {
        return { canceled: true };
      }
      outputPath = filePath;
    }

    await fs.writeFile(outputPath, pdfBuffer);
    return { canceled: false, filePath: outputPath };
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.close();
    }
  }
}

module.exports = {
  listPrinters,
  printReceiptHtml,
  saveReceiptPdf,
};
