const reportsAPI = window.reportsAPI;
const authAPI = window.authAPI;
const ui = window.UIComponents || {};
let latestDashboard = null;
let currentPeriod = "TODAY";

const el = {
  reportDateInput: document.getElementById("reportDateInput"),
  loadReportsBtn: document.getElementById("loadReportsBtn"),
  exportAllBtn: document.getElementById("exportAllBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  printSummaryBtn: document.getElementById("printSummaryBtn"),
  themeToggle: document.getElementById("themeToggle"),
  goPosBtn: document.getElementById("goPosBtn"),
  goAdminBtn: document.getElementById("goAdminBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  statusMessage: document.getElementById("statusMessage"),

  kpiRevenue: document.getElementById("kpiRevenue"),
  kpiOrders: document.getElementById("kpiOrders"),
  kpiPaidOrders: document.getElementById("kpiPaidOrders"),
  kpiCancelledOrders: document.getElementById("kpiCancelledOrders"),

  cmpRevenue7: document.getElementById("cmpRevenue7"),
  cmpRevenue30: document.getElementById("cmpRevenue30"),
  cmpOrders7: document.getElementById("cmpOrders7"),
  cmpOrders30: document.getElementById("cmpOrders30"),
  dailyTrend30Chart: document.getElementById("dailyTrend30Chart"),

  hourlyChart: document.getElementById("hourlyChart"),
  paymentChart: document.getElementById("paymentChart"),
  topItemsTable: document.getElementById("topItemsTable"),
  leastItemsTable: document.getElementById("leastItemsTable"),
  categoryTable: document.getElementById("categoryTable"),
  cancelledTable: document.getElementById("cancelledTable"),
  dailySummaryTable: document.getElementById("dailySummaryTable"),

  summaryDate: document.getElementById("summaryDate"),
  summaryRevenue: document.getElementById("summaryRevenue"),
  summaryOrders: document.getElementById("summaryOrders"),
  summaryPaidOrders: document.getElementById("summaryPaidOrders"),
  summaryCancelledOrders: document.getElementById("summaryCancelledOrders"),
  summaryRev7: document.getElementById("summaryRev7"),
  summaryRev30: document.getElementById("summaryRev30"),
  summaryTopItems: document.getElementById("summaryTopItems"),
  summaryPayment: document.getElementById("summaryPayment"),

  periodButtons: Array.from(document.querySelectorAll(".period-btn"))
};

function authToken() {
  return localStorage.getItem("auth_token") || "";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value || 0);
}

function showStatus(message, isError = false) {
  el.statusMessage.textContent = message;
  el.statusMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function formatPct(value) {
  const n = Number(value || 0);
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename, headers, rows) {
  const content = [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportSectionCsv(section, options = {}) {
  const { silent = false } = options;
  if (!latestDashboard) {
    if (!silent) {
      showStatus("Load reports first before exporting.", true);
    }
    return;
  }

  const date = latestDashboard.date;
  const cfg = {
    comparative: {
      headers: ["Metric", "Window", "Current", "Previous", "Change %"],
      rows: (() => {
        const c = latestDashboard.comparativeTrends;
        return [
          ["Revenue", "7 Days", c.last7Days.revenue, c.previous7Days.revenue, Number(c.revenueChange7dPct || 0).toFixed(2)],
          ["Revenue", "30 Days", c.last30Days.revenue, c.previous30Days.revenue, Number(c.revenueChange30dPct || 0).toFixed(2)],
          ["Orders", "7 Days", c.last7Days.orders, c.previous7Days.orders, Number(c.orderChange7dPct || 0).toFixed(2)],
          ["Orders", "30 Days", c.last30Days.orders, c.previous30Days.orders, Number(c.orderChange30dPct || 0).toFixed(2)]
        ];
      })()
    },
    hourly: {
      headers: ["Hour", "Revenue", "Orders"],
      rows: latestDashboard.hourlySales.map((r) => [r.hour, r.revenue, r.orderCount])
    },
    payment: {
      headers: ["Method", "Amount", "Count"],
      rows: latestDashboard.paymentBreakdown.map((r) => [r.method, r.totalAmount, r.paymentCount])
    },
    top: {
      headers: ["Item", "Qty", "Revenue"],
      rows: latestDashboard.topSellingItems.map((r) => [r.name, r.qtySold, r.grossSales])
    },
    least: {
      headers: ["Item", "Qty", "Revenue"],
      rows: latestDashboard.leastSellingItems.map((r) => [r.name, r.qtySold, r.grossSales])
    },
    category: {
      headers: ["Category", "Qty", "Revenue"],
      rows: latestDashboard.categoryRevenue.map((r) => [r.name, r.qtySold, r.revenue])
    },
    cancelled: {
      headers: ["Order No", "Type", "Time", "Total"],
      rows: latestDashboard.cancelledOrders.map((r) => [r.orderNo, r.orderType, r.createdAt, r.total])
    },
    daily: {
      headers: ["Order No", "Type", "Status", "Items", "Total"],
      rows: latestDashboard.dailySalesSummary.map((r) => [r.orderNo, r.orderType, r.status, r.itemLines, r.total])
    }
  }[section];

  if (!cfg) {
    if (!silent) {
      showStatus("Unknown export section.", true);
    }
    return;
  }

  downloadCsv(`${section}-${date}.csv`, cfg.headers, cfg.rows || []);
  if (!silent) {
    showStatus(`Exported ${section} CSV for ${date}.`);
  }
}

function exportAllSectionsCsv() {
  if (!latestDashboard) {
    showStatus("Load reports first before exporting all sections.", true);
    return;
  }

  const sections = ["comparative", "hourly", "payment", "top", "least", "category", "cancelled", "daily"];
  sections.forEach((section, idx) => {
    setTimeout(() => {
      exportSectionCsv(section, { silent: true });
    }, idx * 140);
  });
  showStatus(`Queued ${sections.length} CSV exports for ${latestDashboard.date}.`);
}

function setPeriod(period) {
  currentPeriod = period;
  el.periodButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.period === period);
  });
}

async function exportSummaryPdf() {
  if (!latestDashboard) {
    showStatus("Load reports first before exporting PDF.", true);
    return;
  }

  const response = await reportsAPI.exportSummaryPdf({
    authToken: authToken(),
    date: latestDashboard.date,
    period: currentPeriod
  });

  if (!response.ok) {
    throw new Error(response.error || "Failed to export PDF");
  }

  if (response.data?.cancelled) {
    showStatus("PDF export cancelled.");
    return;
  }

  const filePath = response.data?.filePath || "selected location";
  showStatus(`PDF exported to ${filePath}.`);
}

async function ensureAuthenticated() {
  const token = authToken();
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

async function loadDashboard() {
  const payload = {
    date: el.reportDateInput.value,
    period: currentPeriod,
    authToken: authToken()
  };

  const response = await reportsAPI.getDashboard(payload);
  if (!response.ok) {
    throw new Error(response.error || "Failed to load reports");
  }

  renderDashboard(response.data);
  const range = response.data.range;
  showStatus(`Reports updated for ${response.data.periodLabel} (${range.startDate} to ${range.endDate}).`);
}

function renderKpi(kpi) {
  el.kpiRevenue.textContent = formatCurrency(kpi.totalRevenue);
  el.kpiOrders.textContent = String(kpi.totalOrders);
  el.kpiPaidOrders.textContent = String(kpi.paidOrders);
  el.kpiCancelledOrders.textContent = String(kpi.cancelledOrders);
}

function renderBarChart(container, rows, labelKey, valueKey, valueFormatter) {
  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="status-message">No data for selected date.</p>';
    return;
  }

  const maxValue = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);
  container.innerHTML = rows
    .map((row) => {
      const value = Number(row[valueKey] || 0);
      const pct = Math.max(3, Math.round((value / maxValue) * 100));
      return `
        <div class="bar-row">
          <span class="bar-label">${row[labelKey]}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-value">${valueFormatter(value)}</span>
        </div>
      `;
    })
    .join("");
}

function renderTable(container, columns, rows) {
  if (ui.renderDataTable) {
    ui.renderDataTable(container, columns, rows, "No data for selected date.");
    return;
  }

  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="status-message">No data for selected date.</p>';
    return;
  }

  const head = columns.map((col) => `<th>${col.label}</th>`).join("");
  const body = rows
    .map((row) => {
      const tds = columns
        .map((col) => {
          const value = typeof col.render === "function" ? col.render(row[col.key], row) : row[col.key];
          return `<td>${value ?? ""}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  container.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderComparative(comparative, dailyTrend30) {
  const c = comparative || {
    last7Days: { revenue: 0, orders: 0 },
    previous7Days: { revenue: 0, orders: 0 },
    last30Days: { revenue: 0, orders: 0 },
    previous30Days: { revenue: 0, orders: 0 },
    revenueChange7dPct: 0,
    revenueChange30dPct: 0,
    orderChange7dPct: 0,
    orderChange30dPct: 0
  };

  el.cmpRevenue7.textContent = `7D: ${formatCurrency(c.last7Days.revenue)} (${formatPct(c.revenueChange7dPct)})`;
  el.cmpRevenue30.textContent = `30D: ${formatCurrency(c.last30Days.revenue)} (${formatPct(c.revenueChange30dPct)})`;
  el.cmpOrders7.textContent = `7D: ${c.last7Days.orders} (${formatPct(c.orderChange7dPct)})`;
  el.cmpOrders30.textContent = `30D: ${c.last30Days.orders} (${formatPct(c.orderChange30dPct)})`;

  renderBarChart(el.dailyTrend30Chart, dailyTrend30 || [], "day", "revenue", (value) => formatCurrency(value));
}

function renderPrintableSummary(data) {
  const c = data.comparativeTrends || {};
  el.summaryDate.textContent = data.date;
  el.summaryRevenue.textContent = formatCurrency(data.kpi.totalRevenue);
  el.summaryOrders.textContent = String(data.kpi.totalOrders);
  el.summaryPaidOrders.textContent = String(data.kpi.paidOrders);
  el.summaryCancelledOrders.textContent = String(data.kpi.cancelledOrders);

  const rev7 = c.last7Days?.revenue || 0;
  const rev30 = c.last30Days?.revenue || 0;
  el.summaryRev7.textContent = `${formatCurrency(rev7)} (${formatPct(c.revenueChange7dPct || 0)})`;
  el.summaryRev30.textContent = `${formatCurrency(rev30)} (${formatPct(c.revenueChange30dPct || 0)})`;

  const topItems = data.topSellingItems.slice(0, 3);
  el.summaryTopItems.innerHTML = topItems.length
    ? topItems.map((item) => `<li>${item.name} - ${item.qtySold} pcs (${formatCurrency(item.grossSales)})</li>`).join("")
    : "<li>No top items for selected date.</li>";

  el.summaryPayment.innerHTML = data.paymentBreakdown.length
    ? data.paymentBreakdown
      .map((p) => `<li>${p.method}: ${formatCurrency(p.totalAmount)} (${p.paymentCount})</li>`)
      .join("")
    : "<li>No payment records for selected date.</li>";
}

function renderDashboard(data) {
  latestDashboard = data;
  renderKpi(data.kpi);
  renderComparative(data.comparativeTrends, data.dailyTrend30);

  renderBarChart(el.hourlyChart, data.hourlySales, "hour", "revenue", (value) => formatCurrency(value));
  renderBarChart(el.paymentChart, data.paymentBreakdown, "method", "totalAmount", (value) => formatCurrency(value));

  renderTable(
    el.topItemsTable,
    [
      { key: "name", label: "Item" },
      { key: "qtySold", label: "Qty" },
      { key: "grossSales", label: "Revenue", render: (value) => formatCurrency(value) }
    ],
    data.topSellingItems
  );

  renderTable(
    el.leastItemsTable,
    [
      { key: "name", label: "Item" },
      { key: "qtySold", label: "Qty" },
      { key: "grossSales", label: "Revenue", render: (value) => formatCurrency(value) }
    ],
    data.leastSellingItems
  );

  renderTable(
    el.categoryTable,
    [
      { key: "name", label: "Category" },
      { key: "qtySold", label: "Qty" },
      { key: "revenue", label: "Revenue", render: (value) => formatCurrency(value) }
    ],
    data.categoryRevenue
  );

  renderTable(
    el.cancelledTable,
    [
      { key: "orderNo", label: "Order No" },
      { key: "orderType", label: "Type" },
      { key: "createdAt", label: "Time" },
      { key: "total", label: "Total", render: (value) => formatCurrency(value) }
    ],
    data.cancelledOrders
  );

  renderTable(
    el.dailySummaryTable,
    [
      { key: "orderNo", label: "Order No" },
      { key: "orderType", label: "Type" },
      { key: "status", label: "Status" },
      { key: "itemLines", label: "Items" },
      { key: "total", label: "Total", render: (value) => formatCurrency(value) }
    ],
    data.dailySalesSummary
  );

  renderPrintableSummary(data);
}

function bindEvents() {
  el.loadReportsBtn.addEventListener("click", () => {
    loadDashboard().catch((error) => showStatus(error.message, true));
  });

  el.printSummaryBtn.addEventListener("click", () => {
    if (!latestDashboard) {
      showStatus("Load reports first before printing.", true);
      return;
    }
    window.print();
  });

  el.exportAllBtn.addEventListener("click", () => {
    exportAllSectionsCsv();
  });

  el.exportPdfBtn.addEventListener("click", () => {
    exportSummaryPdf().catch((error) => showStatus(error.message, true));
  });

  el.themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const nextTheme = html.dataset.theme === "light" ? "dark" : "light";
    html.dataset.theme = nextTheme;
    localStorage.setItem("pos-theme", nextTheme);
  });

  el.goPosBtn.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  el.goAdminBtn.addEventListener("click", () => {
    window.location.href = "./admin.html";
  });

  el.logoutBtn.addEventListener("click", async () => {
    try {
      await authAPI.logout({ token: authToken() });
    } finally {
      localStorage.removeItem("auth_token");
      window.location.href = "./login.html";
    }
  });

  document.querySelectorAll(".export-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.exportSection;
      exportSectionCsv(section);
    });
  });

  el.periodButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setPeriod(btn.dataset.period || "TODAY");
      loadDashboard().catch((error) => showStatus(error.message, true));
    });
  });
}

function init() {
  const savedTheme = localStorage.getItem("pos-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    document.documentElement.dataset.theme = savedTheme;
  }

  setPeriod("TODAY");
  el.reportDateInput.value = new Date().toISOString().slice(0, 10);
  bindEvents();

  ensureAuthenticated()
    .then(() => loadDashboard())
    .catch((error) => showStatus(error.message, true));
}

init();
