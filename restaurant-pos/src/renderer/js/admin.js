const api = window.adminAPI;
const authAPI = window.authAPI;
const ui = window.UIComponents || {};

const state = {
  categories: [],
  addOns: [],
  menuItems: [],
  tables: [],
  tablePolicy: {
    fixedCount: true,
    allowCreate: false,
    allowDelete: false,
    currentCount: 0
  }
};

const el = {
  themeToggle: document.getElementById("themeToggle"),
  openReceiptBtn: document.getElementById("openReceiptBtn"),
  openReportsBtn: document.getElementById("openReportsBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  goPosBtn: document.getElementById("goPosBtn"),
  statusMessage: document.getElementById("statusMessage"),

  categoryForm: document.getElementById("categoryForm"),
  categoryNameInput: document.getElementById("categoryNameInput"),
  categoryList: document.getElementById("categoryList"),

  addonForm: document.getElementById("addonForm"),
  addonNameInput: document.getElementById("addonNameInput"),
  addonPriceInput: document.getElementById("addonPriceInput"),
  addonList: document.getElementById("addonList"),

  menuForm: document.getElementById("menuForm"),
  menuItemIdInput: document.getElementById("menuItemIdInput"),
  menuNameInput: document.getElementById("menuNameInput"),
  menuSkuInput: document.getElementById("menuSkuInput"),
  menuCategoryInput: document.getElementById("menuCategoryInput"),
  menuAvailableInput: document.getElementById("menuAvailableInput"),
  menuVariantsInput: document.getElementById("menuVariantsInput"),
  menuAddOnIdsInput: document.getElementById("menuAddOnIdsInput"),
  resetMenuFormBtn: document.getElementById("resetMenuFormBtn"),
  menuList: document.getElementById("menuList"),

  tableForm: document.getElementById("tableForm"),
  tableIdInput: document.getElementById("tableIdInput"),
  tableCodeInput: document.getElementById("tableCodeInput"),
  tableNameInput: document.getElementById("tableNameInput"),
  tableCapacityInput: document.getElementById("tableCapacityInput"),
  tableActiveInput: document.getElementById("tableActiveInput"),
  resetTableFormBtn: document.getElementById("resetTableFormBtn"),
  tableList: document.getElementById("tableList"),
  tablePolicyHint: document.getElementById("tablePolicyHint")
};

function showStatus(message, isError = false) {
  el.statusMessage.textContent = message;
  el.statusMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
}

async function callApi(method, payload) {
  if (!api || typeof api[method] !== "function") {
    throw new Error("Admin API unavailable. Start app with npm start.");
  }

  const response = await api[method]({ ...(payload || {}), authToken: localStorage.getItem("auth_token") || "" });
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

function parseVariants(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name, rawPrice] = line.split("|");
      return {
        name: (name || "").trim(),
        price: Number((rawPrice || "").trim()),
        isDefault: index === 0
      };
    });
}

function parseAddOnIds(text) {
  return text
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));
}

function resetMenuForm() {
  el.menuItemIdInput.value = "";
  el.menuNameInput.value = "";
  el.menuSkuInput.value = "";
  el.menuAvailableInput.value = "1";
  el.menuVariantsInput.value = "";
  el.menuAddOnIdsInput.value = "";
}

function resetTableForm() {
  el.tableIdInput.value = "";
  el.tableCodeInput.value = "";
  el.tableNameInput.value = "";
  el.tableCapacityInput.value = "4";
  el.tableActiveInput.value = "1";
}

function applyTablePolicyUI() {
  const policy = state.tablePolicy || {};
  const fixedHint = policy.fixedCount
    ? `Fixed-table policy active: ${policy.currentCount} configured tables. Create/Delete are locked.`
    : "Table count is configurable.";

  el.tablePolicyHint.textContent = fixedHint;
  el.tableCodeInput.disabled = Boolean(policy.fixedCount && !el.tableIdInput.value);
  el.tableNameInput.disabled = Boolean(policy.fixedCount && !el.tableIdInput.value);
  el.tableCapacityInput.disabled = Boolean(policy.fixedCount && !el.tableIdInput.value);
  el.tableActiveInput.disabled = false;
}

function renderCategorySelect() {
  el.menuCategoryInput.innerHTML = state.categories
    .map((category) => `<option value="${category.id}">${category.name}</option>`)
    .join("");
}

function renderCategories() {
  renderCategorySelect();
  if (state.categories.length === 0) {
    el.categoryList.innerHTML = '<p>No categories yet.</p>';
    return;
  }

  const rows = state.categories.map((category) => {
    const saveButton = ui.button
      ? ui.button({ label: "Save", className: "btn btn-light", attrs: `data-category-save=\"${category.id}\"` })
      : `<button class="btn btn-light" type="button" data-category-save="${category.id}">Save</button>`;
    const deleteButton = ui.button
      ? ui.button({ label: "Delete", className: "btn btn-danger", attrs: `data-category-delete=\"${category.id}\"` })
      : `<button class="btn btn-danger" type="button" data-category-delete="${category.id}">Delete</button>`;

    return `
      <div class="list-row">
        <div>
          <input type="text" value="${category.name}" data-category-name-id="${category.id}" />
          <small>${Number(category.isActive) ? "Active" : "Inactive"}</small>
        </div>
        <div class="row-actions">${saveButton}${deleteButton}</div>
      </div>
    `;
  });

  if (ui.renderCardRows) {
    ui.renderCardRows(el.categoryList, rows, "No categories yet.");
  } else {
    el.categoryList.innerHTML = rows.join("");
  }
}

function renderAddOns() {
  if (state.addOns.length === 0) {
    el.addonList.innerHTML = '<p>No add-ons yet.</p>';
    return;
  }

  el.addonList.innerHTML = state.addOns
    .map((addOn) => `<div class="list-row"><strong>#${addOn.id} ${addOn.name}</strong><small>${addOn.price}</small></div>`)
    .join("");
}

function renderMenuItems() {
  if (state.menuItems.length === 0) {
    el.menuList.innerHTML = '<p>No menu items yet.</p>';
    return;
  }

  const rows = state.menuItems
    .map(
      (item) => `
        <div class="list-row">
          <div>
            <strong>${item.name}</strong>
            <small>${item.categoryName} | ${Number(item.isAvailable) ? "In Stock" : "Out Of Stock"} | Variants: ${item.variants
              .map((variant) => `${variant.name}-${variant.price}`)
              .join(", ")}</small>
          </div>
          <div class="row-actions">
            <button class="btn btn-light" type="button" data-menu-edit="${item.id}">Edit</button>
            <button class="btn btn-light" type="button" data-menu-toggle="${item.id}">Toggle</button>
            <button class="btn btn-danger" type="button" data-menu-delete="${item.id}">Delete</button>
          </div>
        </div>
      `
    )
    ;

  if (ui.renderCardRows) {
    ui.renderCardRows(el.menuList, rows, "No menu items yet.");
  } else {
    el.menuList.innerHTML = rows.join("");
  }
}

function renderTables() {
  if (state.tables.length === 0) {
    el.tableList.innerHTML = '<p>No tables found.</p>';
    return;
  }

  const policy = state.tablePolicy || {};
  const showDelete = !policy.fixedCount && policy.allowDelete;

  const rows = state.tables
    .map(
      (table) => `
        <div class="list-row">
          <div>
            <strong>${table.displayName} (${table.tableCode})</strong>
            <small>Capacity ${table.capacity} | ${Number(table.isActive) ? "Active" : "Inactive"}</small>
          </div>
          <div class="row-actions">
            <button class="btn btn-light" type="button" data-table-edit="${table.id}">Edit</button>
            ${showDelete ? `<button class="btn btn-danger" type="button" data-table-delete="${table.id}">Delete</button>` : ""}
          </div>
        </div>
      `
    )
    ;

  if (ui.renderCardRows) {
    ui.renderCardRows(el.tableList, rows, "No tables found.");
  } else {
    el.tableList.innerHTML = rows.join("");
  }

  applyTablePolicyUI();
}

async function refreshAll() {
  const [categories, addOns, menuItems, tables, tablePolicy] = await Promise.all([
    callApi("listCategories"),
    callApi("listAddOns"),
    callApi("listMenuItems"),
    callApi("listTables"),
    callApi("getTablePolicy")
  ]);

  state.categories = categories;
  state.addOns = addOns;
  state.menuItems = menuItems;
  state.tables = tables;
  state.tablePolicy = tablePolicy;

  renderCategories();
  renderAddOns();
  renderMenuItems();
  renderTables();
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

  el.openReceiptBtn.addEventListener("click", () => {
    window.location.href = "./receipt.html";
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

  el.categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      state.categories = await callApi("createCategory", { name: el.categoryNameInput.value });
      el.categoryNameInput.value = "";
      renderCategories();
      showStatus("Category created");
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  el.categoryList.addEventListener("click", async (event) => {
    const saveBtn = event.target.closest("button[data-category-save]");
    const deleteBtn = event.target.closest("button[data-category-delete]");

    try {
      if (saveBtn) {
        const category = state.categories.find((entry) => entry.id === Number(saveBtn.dataset.categorySave));
        if (!category) return;
        const input = el.categoryList.querySelector(`input[data-category-name-id="${category.id}"]`);
        const newName = input ? input.value.trim() : "";
        if (!newName) {
          showStatus("Category name cannot be empty", true);
          return;
        }
        state.categories = await callApi("updateCategory", {
          id: category.id,
          name: newName,
          isActive: Number(category.isActive) === 1
        });
        renderCategories();
        showStatus("Category updated");
      }

      if (deleteBtn) {
        const categoryId = Number(deleteBtn.dataset.categoryDelete);
        const category = state.categories.find((entry) => entry.id === categoryId);
        if (!window.confirm(`Delete category \"${category?.name || categoryId}\"? This action cannot be undone.`)) {
          return;
        }
        state.categories = await callApi("deleteCategory", { id: categoryId });
        renderCategories();
        showStatus("Category deleted");
      }
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  el.addonForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      state.addOns = await callApi("createAddOn", {
        name: el.addonNameInput.value,
        price: Number(el.addonPriceInput.value)
      });
      el.addonNameInput.value = "";
      el.addonPriceInput.value = "";
      renderAddOns();
      showStatus("Add-on created");
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  el.menuForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      id: el.menuItemIdInput.value ? Number(el.menuItemIdInput.value) : undefined,
      name: el.menuNameInput.value,
      sku: el.menuSkuInput.value || null,
      categoryId: Number(el.menuCategoryInput.value),
      isAvailable: el.menuAvailableInput.value === "1",
      variants: parseVariants(el.menuVariantsInput.value),
      addOnIds: parseAddOnIds(el.menuAddOnIdsInput.value)
    };

    try {
      state.menuItems = payload.id
        ? await callApi("updateMenuItem", payload)
        : await callApi("createMenuItem", payload);
      resetMenuForm();
      renderMenuItems();
      showStatus("Menu item saved");
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  el.resetMenuFormBtn.addEventListener("click", resetMenuForm);

  el.menuList.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("button[data-menu-edit]");
    const deleteBtn = event.target.closest("button[data-menu-delete]");
    const toggleBtn = event.target.closest("button[data-menu-toggle]");

    try {
      if (editBtn) {
        const item = state.menuItems.find((entry) => entry.id === Number(editBtn.dataset.menuEdit));
        if (!item) return;

        el.menuItemIdInput.value = String(item.id);
        el.menuNameInput.value = item.name;
        el.menuSkuInput.value = item.sku || "";
        el.menuCategoryInput.value = String(item.categoryId);
        el.menuAvailableInput.value = Number(item.isAvailable) ? "1" : "0";
        el.menuVariantsInput.value = item.variants.map((variant) => `${variant.name}|${variant.price}`).join("\n");
        el.menuAddOnIdsInput.value = item.addOns.map((addOn) => addOn.id).join(",");
        showStatus("Menu item loaded for edit");
      }

      if (deleteBtn) {
        const menuId = Number(deleteBtn.dataset.menuDelete);
        const item = state.menuItems.find((entry) => entry.id === menuId);
        if (!window.confirm(`Delete menu item \"${item?.name || menuId}\"? This action cannot be undone.`)) {
          return;
        }
        state.menuItems = await callApi("deleteMenuItem", { id: menuId });
        renderMenuItems();
        showStatus("Menu item deleted");
      }

      if (toggleBtn) {
        const item = state.menuItems.find((entry) => entry.id === Number(toggleBtn.dataset.menuToggle));
        if (!item) return;
        state.menuItems = await callApi("toggleMenuAvailability", {
          id: item.id,
          isAvailable: !Number(item.isAvailable)
        });
        renderMenuItems();
        showStatus("Menu item availability updated");
      }
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  el.tableForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      id: el.tableIdInput.value ? Number(el.tableIdInput.value) : undefined,
      tableCode: el.tableCodeInput.value,
      displayName: el.tableNameInput.value,
      capacity: Number(el.tableCapacityInput.value),
      isActive: el.tableActiveInput.value === "1"
    };

    try {
      if (!payload.id && state.tablePolicy.fixedCount && !state.tablePolicy.allowCreate) {
        showStatus("New table creation is locked by fixed-table policy.", true);
        return;
      }

      state.tables = payload.id
        ? await callApi("updateTable", payload)
        : await callApi("createTable", payload);
      resetTableForm();
      await refreshAll();
      renderTables();
      showStatus("Table saved");
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  el.resetTableFormBtn.addEventListener("click", resetTableForm);

  el.tableList.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("button[data-table-edit]");
    const deleteBtn = event.target.closest("button[data-table-delete]");

    try {
      if (editBtn) {
        const table = state.tables.find((entry) => entry.id === Number(editBtn.dataset.tableEdit));
        if (!table) return;

        el.tableIdInput.value = String(table.id);
        el.tableCodeInput.value = table.tableCode;
        el.tableNameInput.value = table.displayName;
        el.tableCapacityInput.value = String(table.capacity);
        el.tableActiveInput.value = Number(table.isActive) ? "1" : "0";
        showStatus("Table loaded for edit");
        applyTablePolicyUI();
      }

      if (deleteBtn) {
        if (state.tablePolicy.fixedCount && !state.tablePolicy.allowDelete) {
          showStatus("Table deletion is locked by fixed-table policy.", true);
          return;
        }
        const tableId = Number(deleteBtn.dataset.tableDelete);
        const table = state.tables.find((entry) => entry.id === tableId);
        if (!window.confirm(`Delete table \"${table?.displayName || tableId}\"? This action cannot be undone.`)) {
          return;
        }
        state.tables = await callApi("deleteTable", { id: tableId });
        await refreshAll();
        renderTables();
        showStatus("Table deleted");
      }
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
      return refreshAll();
    })
    .then(() => showStatus("Admin module ready"))
    .catch((error) => showStatus(error.message, true));
}

init();
