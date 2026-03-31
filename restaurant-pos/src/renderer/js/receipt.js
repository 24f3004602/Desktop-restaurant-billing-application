const posAPI = window.posAPI;
const systemAPI = window.systemAPI;
const authAPI = window.authAPI;

const state = {
  printerProfile: null,
  printers: [],
  backups: [],
  loadedOrderId: null,
  loadedOrderNo: null,
  loadedReceiptHtml: ""
};

const el = {
  themeToggle: document.getElementById("themeToggle"),
  printerTestBtn: document.getElementById("printerTestBtn"),
  openReportsBtn: document.getElementById("openReportsBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  goPosBtn: document.getElementById("goPosBtn"),
  goAdminBtn: document.getElementById("goAdminBtn"),
  statusMessage: document.getElementById("statusMessage"),

  profileForm: document.getElementById("profileForm"),
  profileNameInput: document.getElementById("profileNameInput"),
  printerSelect: document.getElementById("printerSelect"),
  paperWidthInput: document.getElementById("paperWidthInput"),
  cutterFeedLinesInput: document.getElementById("cutterFeedLinesInput"),
  silentPrintInput: document.getElementById("silentPrintInput"),
  refreshPrintersBtn: document.getElementById("refreshPrintersBtn"),

  orderIdInput: document.getElementById("orderIdInput"),
  loadReceiptBtn: document.getElementById("loadReceiptBtn"),
  printReceiptBtn: document.getElementById("printReceiptBtn"),
  previewMeta: document.getElementById("previewMeta"),
  receiptFrame: document.getElementById("receiptFrame"),

  createBackupBtn: document.getElementById("createBackupBtn"),
  refreshBackupsBtn: document.getElementById("refreshBackupsBtn"),
  backupList: document.getElementById("backupList"),
  dryRunOutput: document.getElementById("dryRunOutput")
};

function showStatus(message, isError = false) {
  el.statusMessage.textContent = message;
  el.statusMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
}

async function callApi(apiObj, method, payload) {
  if (!apiObj || typeof apiObj[method] !== "function") {
    throw new Error(`${method} API unavailable`);
  }

  const response = await apiObj[method]({ ...(payload || {}), authToken: localStorage.getItem("auth_token") || "" });
  if (!response.ok) {
    throw new Error(response.error || "Operation failed");
  }

  return response.data;
}

async function ensureAuthenticated() {
  const token = localStorage.getItem("auth_token") || "";
  if (!token) {
    window.location.href = "./login.html";
    throw new Error("Not authenticated");
  }
  const response = await authAPI.getSession({ token });
  if (!response.ok) {
    localStorage.removeItem("auth_token");
    window.location.href = "./login.html";
    throw new Error(response.error || "Session invalid");
  }
}

function renderPrinters() {
  if (state.printers.length === 0) {
    el.printerSelect.innerHTML = '<option value="">No printers found</option>';
    return;
  }

  el.printerSelect.innerHTML = [
    '<option value="">System default</option>',
    ...state.printers.map((printer) => `<option value="${printer.name}">${printer.displayName || printer.name}</option>`)
  ].join("");

  if (state.printerProfile?.printerName) {
    el.printerSelect.value = state.printerProfile.printerName;
  }
}

function renderProfile() {
  const profile = state.printerProfile || {
    name: "Default",
    printerName: "",
    paperWidthMm: 80,
    silent: false,
    cutterFeedLines: 4
  };

  el.profileNameInput.value = profile.name;
  el.paperWidthInput.value = String(profile.paperWidthMm || 80);
  el.cutterFeedLinesInput.value = String(Number.isInteger(profile.cutterFeedLines) ? profile.cutterFeedLines : 4);
  el.silentPrintInput.checked = Boolean(profile.silent);
  renderPrinters();
}

function renderBackups() {
  if (state.backups.length === 0) {
    el.backupList.innerHTML = '<p>No backups yet.</p>';
    return;
  }

  el.backupList.innerHTML = state.backups
    .map(
      (backup) => `
        <div class="list-row">
          <div>
            <strong>${backup.fileName}</strong>
            <small>${Math.round(backup.size / 1024)} KB | ${backup.updatedAt}</small>
          </div>
          <div>
            <button class="btn btn-light" type="button" data-validate-backup="${backup.fileName}">Validate</button>
            <button class="btn btn-light" type="button" data-dry-run-backup="${backup.fileName}">Dry Run</button>
            <button class="btn btn-danger" type="button" data-restore-backup="${backup.fileName}">Restore</button>
          </div>
        </div>
      `
    )
    .join("");
}

async function loadPrinters() {
  state.printers = await callApi(systemAPI, "listPrinters");
  renderPrinters();
}

async function loadProfile() {
  state.printerProfile = await callApi(systemAPI, "getPrinterProfile");
  renderProfile();
}

async function loadBackups() {
  state.backups = await callApi(systemAPI, "listBackups");
  renderBackups();
}

async function saveProfile() {
  const payload = {
    name: el.profileNameInput.value,
    printerName: el.printerSelect.value,
    paperWidthMm: Number(el.paperWidthInput.value),
    cutterFeedLines: Number(el.cutterFeedLinesInput.value),
    silent: el.silentPrintInput.checked
  };

  state.printerProfile = await callApi(systemAPI, "savePrinterProfile", payload);
  renderProfile();
  showStatus("Printer profile saved");
}

async function loadReceiptPreview() {
  const orderId = Number(el.orderIdInput.value);
  if (!orderId || orderId <= 0) {
    throw new Error("Enter a valid order ID");
  }

  const data = await callApi(posAPI, "getReceiptHtml", { orderId });
  state.loadedOrderId = data.orderId;
  state.loadedOrderNo = data.orderNo;
  state.loadedReceiptHtml = data.html;

  el.receiptFrame.srcdoc = data.html;
  el.previewMeta.textContent = `Loaded ${data.orderNo} (Order ID: ${data.orderId})`;
}

async function printCurrentReceipt() {
  if (!state.loadedOrderId) {
    throw new Error("Load a receipt preview first");
  }

  await callApi(posAPI, "printReceipt", {
    orderId: state.loadedOrderId,
    profile: state.printerProfile
  });

  showStatus(`Print sent for ${state.loadedOrderNo}`);
}

function bindEvents() {
  el.themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const nextTheme = html.dataset.theme === "light" ? "dark" : "light";
    html.dataset.theme = nextTheme;
    localStorage.setItem("pos-theme", nextTheme);
  });

  el.goPosBtn.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  el.printerTestBtn.addEventListener("click", () => {
    window.location.href = "./printer-test.html";
  });

  el.openReportsBtn.addEventListener("click", () => {
    window.location.href = "./reports.html";
  });

  el.logoutBtn.addEventListener("click", async () => {
    try {
      await authAPI.logout({ token: localStorage.getItem("auth_token") || "" });
    } finally {
      localStorage.removeItem("auth_token");
      window.location.href = "./login.html";
    }
  });

  el.goAdminBtn.addEventListener("click", () => {
    window.location.href = "./admin.html";
  });

  el.profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveProfile().catch((error) => showStatus(error.message, true));
  });

  el.refreshPrintersBtn.addEventListener("click", () => {
    loadPrinters().catch((error) => showStatus(error.message, true));
  });

  el.loadReceiptBtn.addEventListener("click", () => {
    loadReceiptPreview().catch((error) => showStatus(error.message, true));
  });

  el.printReceiptBtn.addEventListener("click", () => {
    printCurrentReceipt().catch((error) => showStatus(error.message, true));
  });

  el.createBackupBtn.addEventListener("click", async () => {
    try {
      const result = await callApi(systemAPI, "createBackup");
      state.backups = result.backups || [];
      renderBackups();
      showStatus(`Backup created: ${result.fileName}`);
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  el.refreshBackupsBtn.addEventListener("click", () => {
    loadBackups().catch((error) => showStatus(error.message, true));
  });

  el.backupList.addEventListener("click", async (event) => {
    const validateBtn = event.target.closest("button[data-validate-backup]");
    const dryRunBtn = event.target.closest("button[data-dry-run-backup]");
    const restoreBtn = event.target.closest("button[data-restore-backup]");

    if (validateBtn) {
      const fileName = validateBtn.dataset.validateBackup;
      if (!fileName) return;

      try {
        const result = await callApi(systemAPI, "validateBackup", { fileName });
        el.dryRunOutput.textContent = JSON.stringify(result, null, 2);
        showStatus(result.valid ? `Backup ${fileName} is valid` : `Backup ${fileName} has issues`, !result.valid);
      } catch (error) {
        showStatus(error.message, true);
      }
      return;
    }

    if (dryRunBtn) {
      const fileName = dryRunBtn.dataset.dryRunBackup;
      if (!fileName) return;

      try {
        const result = await callApi(systemAPI, "dryRunRestore", { fileName });
        el.dryRunOutput.textContent = JSON.stringify(result, null, 2);
        showStatus(`Dry run ready for ${fileName}`);
      } catch (error) {
        showStatus(error.message, true);
      }
      return;
    }

    if (!restoreBtn) return;

    const fileName = restoreBtn.dataset.restoreBackup;
    if (!fileName) return;

    if (!window.confirm(`Restore backup \"${fileName}\" now? Current database data will be replaced.`)) {
      return;
    }

    try {
      await callApi(systemAPI, "restoreBackup", { fileName });
      await Promise.all([loadBackups(), loadProfile()]);
      showStatus(`Database restored from ${fileName}`);
    } catch (error) {
      showStatus(error.message, true);
    }
  });
}

function init() {
  const savedTheme = localStorage.getItem("pos-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    document.documentElement.dataset.theme = savedTheme;
  }

  ensureAuthenticated()
    .then(() => {
      bindEvents();
      return Promise.all([loadProfile(), loadPrinters(), loadBackups()]);
    })
    .then(() => showStatus("Receipt settings ready"))
    .catch((error) => showStatus(error.message, true));
}

init();
