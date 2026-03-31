const state = {
  categories: [],
  menuItems: [],
  tables: [],
  activeCategoryId: null,
  searchText: "",
  order: null,
  itemModal: {
    item: null,
    variantId: null,
    addOnIds: new Set()
  }
};

const el = {
  categoryList: document.getElementById("categoryList"),
  categoryCount: document.getElementById("categoryCount"),
  itemGrid: document.getElementById("itemGrid"),
  itemsMeta: document.getElementById("itemsMeta"),
  billItems: document.getElementById("billItems"),
  subtotalValue: document.getElementById("subtotalValue"),
  discountValue: document.getElementById("discountValue"),
  totalValue: document.getElementById("totalValue"),
  draftState: document.getElementById("draftState"),
  searchInput: document.getElementById("searchInput"),
  orderTypeSelect: document.getElementById("orderTypeSelect"),
  tableSelect: document.getElementById("tableSelect"),
  orderTypeLabel: document.getElementById("orderTypeLabel"),
  orderRef: document.getElementById("orderRef"),
  themeToggle: document.getElementById("themeToggle"),
  statusMessage: document.getElementById("statusMessage"),
  openAdminBtn: document.getElementById("openAdminBtn"),
  openReceiptBtn: document.getElementById("openReceiptBtn"),
  openReportsBtn: document.getElementById("openReportsBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  itemConfigModal: document.getElementById("itemConfigModal"),
  modalItemTitle: document.getElementById("modalItemTitle"),
  variantOptions: document.getElementById("variantOptions"),
  addonOptions: document.getElementById("addonOptions"),
  closeItemModalBtn: document.getElementById("closeItemModalBtn"),
  confirmItemBtn: document.getElementById("confirmItemBtn"),

  paymentModal: document.getElementById("paymentModal"),
  paymentRemaining: document.getElementById("paymentRemaining"),
  paymentMethodSelect: document.getElementById("paymentMethodSelect"),
  paymentAmountInput: document.getElementById("paymentAmountInput"),
  paymentReferenceInput: document.getElementById("paymentReferenceInput"),
  paymentHistory: document.getElementById("paymentHistory"),
  addPaymentLineBtn: document.getElementById("addPaymentLineBtn"),
  confirmPaymentBtn: document.getElementById("confirmPaymentBtn"),
  closePaymentModalBtn: document.getElementById("closePaymentModalBtn")
};

const api = window.posAPI;
const authAPI = window.authAPI;
const ui = window.UIComponents || {};

function getAuthToken() {
  return localStorage.getItem("auth_token") || "";
}

async function ensureAuthenticated() {
  const token = getAuthToken();
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

async function callApi(method, payload) {
  if (!api || typeof api[method] !== "function") {
    throw new Error("Electron preload API unavailable. Launch with npm start.");
  }

  const response = await api[method]({ ...(payload || {}), authToken: getAuthToken() });
  if (!response.ok) {
    throw new Error(response.error || "Operation failed");
  }

  return response.data;
}

function getFilteredItems() {
  const text = state.searchText.trim().toLowerCase();
  return state.menuItems.filter((item) => {
    const categoryMatch = item.categoryId === state.activeCategoryId;
    const searchMatch = text.length === 0 || item.name.toLowerCase().includes(text);
    return categoryMatch && searchMatch;
  });
}

function renderCategories() {
  el.categoryCount.textContent = String(state.categories.length);
  el.categoryList.innerHTML = state.categories
    .map(
      (category) => `
        <button
          type="button"
          class="category-btn ${category.id === state.activeCategoryId ? "active" : ""}"
          data-category-id="${category.id}"
        >
          ${category.name}
        </button>
      `
    )
    .join("");
}

function renderItems() {
  const items = getFilteredItems();
  el.itemsMeta.textContent = `${items.length} items shown`;

  if (items.length === 0) {
    el.itemGrid.innerHTML = '<p class="muted">No matching items found.</p>';
    return;
  }

  el.itemGrid.innerHTML = items
    .map((item) => {
      const minPrice = Math.min(...item.variants.map((variant) => Number(variant.price)));
      return `
        <button class="item-card" type="button" data-item-id="${item.id}">
          <p class="item-name">${item.name}</p>
          <span class="item-meta">Variants: ${item.variants.length} | Add-ons: ${item.addOns.length}</span>
          <span class="item-price">From ${formatCurrency(minPrice)}</span>
        </button>
      `;
    })
    .join("");
}

function renderOrderContext() {
  if (!state.order) {
    return;
  }

  el.orderTypeLabel.textContent = state.order.orderType === "DINE_IN" ? "Dine-in" : "Takeaway";
  el.orderRef.textContent = state.order.orderNo;
}

function renderBill() {
  if (!state.order || state.order.items.length === 0) {
    el.billItems.innerHTML = '<div class="bill-empty">No items added yet.</div>';
  } else {
    el.billItems.innerHTML = state.order.items
      .map(
        (row) => `
          <div class="bill-item" data-cart-id="${row.orderItemId}">
            <div class="bill-item-top">
              <strong>${row.itemName} (${row.variantName})</strong>
              <span>${formatCurrency(row.lineTotal)}</span>
            </div>
            ${row.addOns
              .map((addOn) => `<div class="bill-item-addon">+ ${addOn.name} (${formatCurrency(addOn.price)})</div>`)
              .join("")}
            <div class="qty-controls">
              <button type="button" data-action="decrease" data-cart-id="${row.orderItemId}">-</button>
              <strong>${row.qty}</strong>
              <button type="button" data-action="increase" data-cart-id="${row.orderItemId}">+</button>
              <button type="button" data-action="remove" data-cart-id="${row.orderItemId}">x</button>
            </div>
          </div>
        `
      )
      .join("");
  }

  const totals = state.order
    ? state.order.totals
    : {
        subtotal: 0,
        discount: 0,
        total: 0
      };

  el.subtotalValue.textContent = formatCurrency(totals.subtotal);
  el.discountValue.textContent = formatCurrency(totals.discount);
  el.totalValue.textContent = formatCurrency(totals.total);
  el.draftState.textContent = state.order ? state.order.status : "DRAFT";
}

function renderTableOptions() {
  const tableOptions = state.tables
    .map((table) => `<option value="${table.tableCode}">${table.displayName}</option>`)
    .join("");

  el.tableSelect.innerHTML = tableOptions || '<option value="">No tables</option>';

  if (state.tables.length > 0) {
    el.tableSelect.value = state.tables[0].tableCode;
  }
}

function setOrder(orderData) {
  state.order = orderData;
  renderOrderContext();
  renderBill();
  renderPaymentHistory();
}

function getSelectedContext() {
  const orderType = el.orderTypeSelect.value;
  const tableRef = orderType === "DINE_IN" ? el.tableSelect.value : null;
  return { orderType, tableRef };
}

function toggleTableMode() {
  const isTakeaway = el.orderTypeSelect.value === "TAKEAWAY";
  el.tableSelect.disabled = isTakeaway;
}

async function loadMenu() {
  const menuData = await callApi("getMenu");
  state.categories = menuData.categories;
  state.menuItems = menuData.menuItems;
  state.activeCategoryId = state.categories[0]?.id || null;
  renderCategories();
  renderItems();
}

async function loadTables() {
  state.tables = await callApi("getTables");
  renderTableOptions();
  toggleTableMode();
}

async function ensureActiveOrder() {
  const context = getSelectedContext();
  const active = await callApi("getActiveOrder", context);

  if (active) {
    setOrder(active);
    return;
  }

  const created = await callApi("createOrder", context);
  setOrder(created);
}

function openItemModal(item) {
  state.itemModal.item = item;
  state.itemModal.variantId = (item.variants.find((variant) => Number(variant.isDefault) === 1) || item.variants[0])?.id || null;
  state.itemModal.addOnIds = new Set();

  el.modalItemTitle.textContent = `Configure ${item.name}`;
  renderItemModalChoices();
  if (ui.setModalVisibility) {
    ui.setModalVisibility(el.itemConfigModal, true);
  } else {
    el.itemConfigModal.classList.remove("hidden");
    el.itemConfigModal.setAttribute("aria-hidden", "false");
  }
}

function closeItemModal() {
  if (ui.setModalVisibility) {
    ui.setModalVisibility(el.itemConfigModal, false);
  } else {
    el.itemConfigModal.classList.add("hidden");
    el.itemConfigModal.setAttribute("aria-hidden", "true");
  }
}

function renderItemModalChoices() {
  const item = state.itemModal.item;
  if (!item) return;

  el.variantOptions.innerHTML = item.variants
    .map(
      (variant) => `
        <button
          type="button"
          class="choice-row ${state.itemModal.variantId === variant.id ? "active" : ""}"
          data-variant-id="${variant.id}"
        >
          <span>${variant.name}</span>
          <strong>${formatCurrency(variant.price)}</strong>
        </button>
      `
    )
    .join("");

  if (item.addOns.length === 0) {
    el.addonOptions.innerHTML = '<p class="muted">No add-ons for this item.</p>';
    return;
  }

  el.addonOptions.innerHTML = item.addOns
    .map(
      (addOn) => `
        <button
          type="button"
          class="choice-row ${state.itemModal.addOnIds.has(addOn.id) ? "active" : ""}"
          data-addon-id="${addOn.id}"
        >
          <span>${addOn.name}</span>
          <strong>${formatCurrency(addOn.price)}</strong>
        </button>
      `
    )
    .join("");
}

async function confirmAddItemFromModal() {
  const item = state.itemModal.item;
  if (!item || !state.order) {
    closeItemModal();
    return;
  }

  if (!state.itemModal.variantId) {
    showStatus("Select a variant first", true);
    return;
  }

  const updatedOrder = await callApi("addItem", {
    orderId: state.order.id,
    variantId: state.itemModal.variantId,
    qty: 1,
    addOnIds: [...state.itemModal.addOnIds]
  });

  setOrder(updatedOrder);
  closeItemModal();
  showStatus("Item added to bill");
}

async function updateItem(orderItemId, action) {
  if (!state.order) return;

  const item = state.order.items.find((entry) => entry.orderItemId === orderItemId);
  if (!item) return;

  if (action === "remove") {
    const updatedOrder = await callApi("removeItem", { orderId: state.order.id, orderItemId });
    setOrder(updatedOrder);
    showStatus("Item removed");
    return;
  }

  const nextQty = action === "increase" ? item.qty + 1 : Math.max(1, item.qty - 1);
  const updatedOrder = await callApi("updateItemQuantity", {
    orderId: state.order.id,
    orderItemId,
    qty: nextQty
  });

  setOrder(updatedOrder);
}

async function applyDiscount(code) {
  if (!state.order) return;

  const payload = {
    orderId: state.order.id,
    discountType: "NONE",
    discountValue: 0
  };

  if (code === "PERCENT_10") {
    payload.discountType = "PERCENT";
    payload.discountValue = 10;
  }

  if (code === "FIXED_50") {
    payload.discountType = "FIXED";
    payload.discountValue = 50;
  }

  const updatedOrder = await callApi("applyDiscount", payload);
  setOrder(updatedOrder);
}

async function updateOrderStatus(nextStatus, reason = null) {
  if (!state.order) return;
  const updatedOrder = await callApi("updateStatus", {
    orderId: state.order.id,
    nextStatus,
    reason
  });
  setOrder(updatedOrder);
}

function openPaymentModal() {
  if (!state.order) return;

  renderPaymentHistory();
  el.paymentAmountInput.value = String(Number(state.order.totals.balance || 0).toFixed(2));
  el.paymentReferenceInput.value = "";
  if (ui.setModalVisibility) {
    ui.setModalVisibility(el.paymentModal, true);
  } else {
    el.paymentModal.classList.remove("hidden");
    el.paymentModal.setAttribute("aria-hidden", "false");
  }
}

function closePaymentModal() {
  if (ui.setModalVisibility) {
    ui.setModalVisibility(el.paymentModal, false);
  } else {
    el.paymentModal.classList.add("hidden");
    el.paymentModal.setAttribute("aria-hidden", "true");
  }
}

function renderPaymentHistory() {
  if (!state.order) {
    el.paymentRemaining.textContent = "";
    el.paymentHistory.innerHTML = "";
    return;
  }

  const balance = Number(state.order.totals.balance || 0);
  el.paymentRemaining.textContent = `Remaining: ${formatCurrency(balance)}`;

  if (state.order.payments.length === 0) {
    el.paymentHistory.innerHTML = '<p class="muted">No payments added yet.</p>';
    return;
  }

  el.paymentHistory.innerHTML = state.order.payments
    .map(
      (payment) => `
        <div class="payment-line">
          <span>${payment.method}${payment.referenceNo ? ` (${payment.referenceNo})` : ""}</span>
          <strong>${formatCurrency(payment.amount)}</strong>
        </div>
      `
    )
    .join("");
}

async function addPaymentLine() {
  if (!state.order) return;

  const method = el.paymentMethodSelect.value;
  const amount = Number(el.paymentAmountInput.value);
  const referenceNo = el.paymentReferenceInput.value.trim() || null;
  const remaining = Number(state.order.totals.balance || 0);

  if (!amount || amount <= 0) {
    throw new Error("Enter a valid payment amount");
  }

  if (amount - remaining > 0.009) {
    throw new Error("Amount cannot exceed remaining balance");
  }

  const updatedOrder = await callApi("addPayment", {
    orderId: state.order.id,
    method,
    amount,
    referenceNo
  });

  setOrder(updatedOrder);
  const nextRemaining = Number(updatedOrder.totals.balance || 0);
  el.paymentAmountInput.value = String(nextRemaining.toFixed(2));
  el.paymentReferenceInput.value = "";
}

async function completePayment() {
  if (!state.order) return;

  if (Number(state.order.totals.balance || 0) > 0.009) {
    throw new Error("Complete payment before marking as paid");
  }

  await updateOrderStatus("PAID");
  closePaymentModal();
  showStatus("Payment completed");
  await ensureActiveOrder();
}

function bindEvents() {
  el.categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category-id]");
    if (!button) return;

    state.activeCategoryId = Number(button.dataset.categoryId);
    renderCategories();
    renderItems();
  });

  el.itemGrid.addEventListener("click", (event) => {
    const card = event.target.closest("button[data-item-id]");
    if (!card) return;

    const item = state.menuItems.find((row) => row.id === Number(card.dataset.itemId));
    if (!item) return;

    openItemModal(item);
  });

  el.variantOptions.addEventListener("click", (event) => {
    const row = event.target.closest("button[data-variant-id]");
    if (!row) return;
    state.itemModal.variantId = Number(row.dataset.variantId);
    renderItemModalChoices();
  });

  el.addonOptions.addEventListener("click", (event) => {
    const row = event.target.closest("button[data-addon-id]");
    if (!row) return;

    const addOnId = Number(row.dataset.addonId);
    if (state.itemModal.addOnIds.has(addOnId)) {
      state.itemModal.addOnIds.delete(addOnId);
    } else {
      state.itemModal.addOnIds.add(addOnId);
    }
    renderItemModalChoices();
  });

  el.closeItemModalBtn.addEventListener("click", closeItemModal);
  el.confirmItemBtn.addEventListener("click", () => {
    confirmAddItemFromModal().catch((error) => showStatus(error.message, true));
  });

  el.billItems.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]");
    if (!target) return;
    updateItem(Number(target.dataset.cartId), target.dataset.action).catch((error) => showStatus(error.message, true));
  });

  document.querySelector(".discount-row").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-discount]");
    if (!button) return;
    applyDiscount(button.dataset.discount).catch((error) => showStatus(error.message, true));
  });

  el.searchInput.addEventListener("input", (event) => {
    state.searchText = event.target.value;
    renderItems();
  });

  el.orderTypeSelect.addEventListener("change", () => {
    toggleTableMode();
    ensureActiveOrder().catch((error) => showStatus(error.message, true));
  });

  el.tableSelect.addEventListener("change", () => {
    ensureActiveOrder().catch((error) => showStatus(error.message, true));
  });

  document.getElementById("saveDraftBtn").addEventListener("click", async () => {
    try {
      await updateOrderStatus("DRAFT");
      showStatus("Draft saved");
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  document.getElementById("mergeBtn").addEventListener("click", async () => {
    try {
      if (!state.order || !state.order.tableRef || state.order.orderType !== "DINE_IN") {
        showStatus("Merge is available for dine-in table orders only.", true);
        return;
      }
      const mergedOrder = await callApi("mergeTableOrders", { tableRef: state.order.tableRef });
      if (mergedOrder) {
        setOrder(mergedOrder);
        showStatus("Table orders merged");
      }
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  document.getElementById("prepareBtn").addEventListener("click", () => {
    updateOrderStatus("PREPARING")
      .then(() => showStatus("Order moved to PREPARING"))
      .catch((error) => showStatus(error.message, true));
  });

  document.getElementById("servedBtn").addEventListener("click", () => {
    updateOrderStatus("SERVED")
      .then(() => showStatus("Order moved to SERVED"))
      .catch((error) => showStatus(error.message, true));
  });

  document.getElementById("payBtn").addEventListener("click", () => {
    openPaymentModal();
  });

  el.addPaymentLineBtn.addEventListener("click", () => {
    addPaymentLine().catch((error) => showStatus(error.message, true));
  });

  el.confirmPaymentBtn.addEventListener("click", () => {
    completePayment().catch((error) => showStatus(error.message, true));
  });

  el.closePaymentModalBtn.addEventListener("click", closePaymentModal);

  document.getElementById("cancelBtn").addEventListener("click", async () => {
    try {
      const reason = window.prompt("Reason for cancellation", "Cancelled by admin") || "Cancelled by admin";
      await updateOrderStatus("CANCELLED", reason);
      showStatus("Order cancelled");
      await ensureActiveOrder();
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  document.getElementById("reprintBtn").addEventListener("click", async () => {
    try {
      if (!state.order) {
        showStatus("No active order to print", true);
        return;
      }
      await callApi("printReceipt", { orderId: state.order.id });
      showStatus(`Receipt sent to printer for ${state.order.orderNo}`);
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  el.themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const nextTheme = html.dataset.theme === "light" ? "dark" : "light";
    html.dataset.theme = nextTheme;
    localStorage.setItem("pos-theme", nextTheme);
  });

  el.openAdminBtn.addEventListener("click", () => {
    window.location.href = "./admin.html";
  });

  el.openReceiptBtn.addEventListener("click", () => {
    window.location.href = "./receipt.html";
  });

  el.openReportsBtn.addEventListener("click", () => {
    window.location.href = "./reports.html";
  });

  el.logoutBtn.addEventListener("click", async () => {
    try {
      await authAPI.logout({ token: getAuthToken() });
    } finally {
      localStorage.removeItem("auth_token");
      window.location.href = "./login.html";
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/") {
      event.preventDefault();
      el.searchInput.focus();
    }

    if (event.key === "F2") {
      event.preventDefault();
      document.getElementById("saveDraftBtn").click();
    }

    if (event.key === "F4") {
      event.preventDefault();
      document.getElementById("payBtn").click();
    }

    if (event.key === "Escape") {
      closeItemModal();
      closePaymentModal();
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
      return Promise.all([loadMenu(), loadTables()]);
    })
    .then(() => ensureActiveOrder())
    .then(() => {
      showStatus("POS ready");
    })
    .catch((error) => {
      showStatus(error.message, true);
    });
}

init();
