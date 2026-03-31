const posAPI = window.posAPI;
const systemAPI = window.systemAPI;
const authAPI = window.authAPI;

const state = {
  profile: null
};

const el = {
  themeToggle: document.getElementById("themeToggle"),
  goReceiptBtn: document.getElementById("goReceiptBtn"),
  openReportsBtn: document.getElementById("openReportsBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  goPosBtn: document.getElementById("goPosBtn"),
  statusMessage: document.getElementById("statusMessage"),
  testProfileForm: document.getElementById("testProfileForm"),
  paperWidthInput: document.getElementById("paperWidthInput"),
  cutterFeedLinesInput: document.getElementById("cutterFeedLinesInput"),
  silentPrintInput: document.getElementById("silentPrintInput"),
  reloadPreviewBtn: document.getElementById("reloadPreviewBtn"),
  previewFrame: document.getElementById("previewFrame")
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

function getProfileFromForm() {
  return {
    name: state.profile?.name || "Default",
    printerName: state.profile?.printerName || "",
    paperWidthMm: Number(el.paperWidthInput.value || 80),
    cutterFeedLines: Number(el.cutterFeedLinesInput.value || 4),
    silent: el.silentPrintInput.checked
  };
}

async function loadProfile() {
  state.profile = await callApi(systemAPI, "getPrinterProfile");
  el.paperWidthInput.value = String(state.profile.paperWidthMm || 80);
  el.cutterFeedLinesInput.value = String(Number.isInteger(state.profile.cutterFeedLines) ? state.profile.cutterFeedLines : 4);
  el.silentPrintInput.checked = Boolean(state.profile.silent);
}

async function loadPreview() {
  const profile = getProfileFromForm();
  const data = await callApi(posAPI, "getTestReceiptHtml", { profile });
  el.previewFrame.srcdoc = data.html;
}

async function printSample() {
  const profile = getProfileFromForm();
  await callApi(posAPI, "printTestReceipt", { profile });
  showStatus("Sample ticket sent to printer");
}

function bindEvents() {
  el.themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const nextTheme = html.dataset.theme === "light" ? "dark" : "light";
    html.dataset.theme = nextTheme;
    localStorage.setItem("pos-theme", nextTheme);
  });

  el.goReceiptBtn.addEventListener("click", () => {
    window.location.href = "./receipt.html";
  });

  el.openReportsBtn.addEventListener("click", () => {
    window.location.href = "./reports.html";
  });

  el.goPosBtn.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  el.logoutBtn.addEventListener("click", async () => {
    try {
      await authAPI.logout({ token: localStorage.getItem("auth_token") || "" });
    } finally {
      localStorage.removeItem("auth_token");
      window.location.href = "./login.html";
    }
  });

  el.reloadPreviewBtn.addEventListener("click", () => {
    loadPreview().catch((error) => showStatus(error.message, true));
  });

  el.testProfileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    printSample().catch((error) => showStatus(error.message, true));
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
      return loadProfile();
    })
    .then(() => loadPreview())
    .then(() => showStatus("Printer test ready"))
    .catch((error) => showStatus(error.message, true));
}

init();
