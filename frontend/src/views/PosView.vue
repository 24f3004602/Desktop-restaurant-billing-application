<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { endpoints } from "../api/endpoints";
import { apiClient } from "../api/http";
import { useBillingStore } from "../stores/billing";
import { useMenuStore } from "../stores/menu";
import { useNotificationsStore } from "../stores/notifications";
import { useOrdersStore } from "../stores/orders";
import { useTablesStore } from "../stores/tables";
import type { RestaurantTable } from "../types/models";
import { getApiErrorMessage } from "../utils/api";
import { formatCurrencyFromCents } from "../utils/currency";

type ScreenMode = "tables" | "billing";
type OrderMode = "dine_in" | "delivery" | "pickup";
type PaymentMode = "cash" | "card" | "due" | "other";
type TableTone = "blank" | "running" | "printed" | "paid";

interface OrderHistoryRow {
  order_id: number;
  order_no: string;
  status: string;
  order_type: string;
  table_id: number | null;
  opened_at: string;
  grand_total_cents: number | null;
}

interface TableCard extends RestaurantTable {
  tone: TableTone;
  elapsed: string;
  runningTotalCents: number;
  latestOrderNo: string | null;
}

const route = useRoute();
const router = useRouter();

const menuStore = useMenuStore();
const tablesStore = useTablesStore();
const ordersStore = useOrdersStore();
const billingStore = useBillingStore();
const notifications = useNotificationsStore();

const screen = ref<ScreenMode>("tables");
const orderMode = ref<OrderMode>("dine_in");
const selectedCategoryId = ref<number | "favorites" | null>(null);
const searchTerm = ref("");
const discountRupees = ref(0);
const selectedPaymentMethod = ref<PaymentMode>("cash");
const loadingTableView = ref(false);
const tableHistory = ref<OrderHistoryRow[]>([]);
const tableHistoryError = ref("");
const tickingNow = ref(Date.now());

let elapsedTimer: number | null = null;

watch(
  () => route.query.view,
  (view) => {
    screen.value = view === "billing" ? "billing" : "tables";
  },
  { immediate: true }
);

function setScreen(next: ScreenMode) {
  screen.value = next;
  void router.replace({
    path: "/pos",
    query: {
      ...route.query,
      view: next,
    },
  });
}

const latestOrderByTable = computed(() => {
  const map = new Map<number, OrderHistoryRow>();
  for (const row of tableHistory.value) {
    if (row.table_id === null || map.has(row.table_id)) {
      continue;
    }
    map.set(row.table_id, row);
  }
  return map;
});

function elapsedSince(openedAt: string): string {
  const now = tickingNow.value;
  const startedAt = new Date(openedAt).getTime();
  if (Number.isNaN(startedAt)) {
    return "-";
  }
  const diffMinutes = Math.max(0, Math.floor((now - startedAt) / 60000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function resolveTableTone(table: RestaurantTable, latestOrder: OrderHistoryRow | undefined): TableTone {
  if (latestOrder?.status === "paid") {
    return "paid";
  }
  if (table.status === "billed" || latestOrder?.status === "billed") {
    return "printed";
  }
  if (table.status === "occupied" || latestOrder?.status === "open" || latestOrder?.status === "kot_sent") {
    return "running";
  }
  return "blank";
}

const tableCards = computed<TableCard[]>(() =>
  tablesStore.tables.map((table) => {
    const latestOrder = latestOrderByTable.value.get(table.id);
    const tone = resolveTableTone(table, latestOrder);
    return {
      ...table,
      tone,
      elapsed: tone === "blank" ? "" : latestOrder ? elapsedSince(latestOrder.opened_at) : "-",
      runningTotalCents: latestOrder?.grand_total_cents ?? 0,
      latestOrderNo: latestOrder?.order_no ?? null,
    };
  })
);

const groupedTables = computed(() => ({
  blank: tableCards.value.filter((table) => table.tone === "blank"),
  running: tableCards.value.filter((table) => table.tone === "running"),
  printed: tableCards.value.filter((table) => table.tone === "printed"),
  paid: tableCards.value.filter((table) => table.tone === "paid"),
}));

const categoryOptions = computed(() => [
  { id: "favorites" as const, name: "Favorites" },
  ...menuStore.categories.map((category) => ({ id: category.id, name: category.name })),
]);

const filteredItems = computed(() => {
  if (selectedCategoryId.value === null) {
    return [];
  }

  const search = searchTerm.value.trim().toLowerCase();
  const baseItems =
    selectedCategoryId.value === "favorites"
      ? menuStore.items.filter((item) => item.is_available).slice(0, 18)
      : menuStore.items.filter((item) => item.category_id === selectedCategoryId.value);

  if (!search) {
    return baseItems;
  }

  return baseItems.filter((item) => item.name.toLowerCase().includes(search));
});

const selectedTableLabel = computed(() => tablesStore.selectedTable?.table_number || "-");
const subtotalCents = computed(() =>
  (ordersStore.activeOrder?.items || []).reduce((sum, item) => sum + item.line_total_cents, 0)
);
const discountCents = computed(() => Math.max(0, Math.round(discountRupees.value * 100)));
const taxCents = computed(() => billingStore.bill?.tax_cents ?? 0);
const totalCents = computed(() => {
  if (billingStore.bill) {
    return billingStore.bill.grand_total_cents;
  }
  return Math.max(0, subtotalCents.value - discountCents.value + taxCents.value);
});

function tableToneClass(tone: TableTone): string {
  if (tone === "running") {
    return "border-amber-300 bg-amber-100 text-amber-900";
  }
  if (tone === "printed") {
    return "border-emerald-300 bg-emerald-100 text-emerald-900";
  }
  if (tone === "paid") {
    return "border-violet-300 bg-violet-100 text-violet-900";
  }
  return "border-slate-600 bg-slate-700 text-slate-100";
}

function paymentPillClass(mode: PaymentMode): string {
  if (selectedPaymentMethod.value === mode) {
    return "border-[#c0392b] bg-[#c0392b] text-white";
  }
  return "border-slate-300 bg-white text-slate-700";
}

function selectCategory(categoryId: number | "favorites") {
  if (selectedCategoryId.value === categoryId) {
    selectedCategoryId.value = null;
    return;
  }
  selectedCategoryId.value = categoryId;
}

function setOrderMode(mode: OrderMode) {
  if (mode === orderMode.value) {
    return;
  }

  if (ordersStore.activeOrder && ordersStore.activeOrder.items.length > 0) {
    notifications.push({ message: "Order type cannot be changed after items are added.", type: "warning" });
    return;
  }

  orderMode.value = mode;
  if (mode !== "dine_in") {
    tablesStore.selectTable(null);
  }
}

async function refreshTableViewData() {
  loadingTableView.value = true;
  tableHistoryError.value = "";
  try {
    await Promise.all([
      tablesStore.fetchTables(),
      apiClient.get<OrderHistoryRow[]>(`${endpoints.reports}/orders/history`).then((response) => {
        tableHistory.value = response.data;
      }),
    ]);
  } catch (error) {
    tableHistoryError.value = getApiErrorMessage(error, "Failed to load table view.");
  } finally {
    loadingTableView.value = false;
  }
}

function openBillingForTable(tableId: number) {
  tablesStore.selectTable(tableId);
  orderMode.value = "dine_in";

  if (ordersStore.activeOrder && ordersStore.activeOrder.table_id !== tableId) {
    ordersStore.clearActiveOrder();
    billingStore.clearBilling();
  }

  setScreen("billing");
}

async function ensureActiveOrder() {
  if (ordersStore.activeOrder) {
    return ordersStore.activeOrder;
  }

  const apiOrderType = orderMode.value === "dine_in" ? "dine_in" : "takeaway";
  const tableId = apiOrderType === "dine_in" ? tablesStore.selectedTableId : null;
  if (apiOrderType === "dine_in" && !tableId) {
    throw new Error("Select a table first.");
  }

  const order = await ordersStore.createOrder({
    table_id: tableId,
    order_type: apiOrderType,
    notes: null,
  });
  await tablesStore.fetchTables();
  return order;
}

async function addItem(itemId: number) {
  try {
    const order = await ensureActiveOrder();
    await ordersStore.addItem(order.id, {
      menu_item_id: itemId,
      quantity: 1,
      special_note: null,
    });
  } catch (error) {
    notifications.push({ message: getApiErrorMessage(error), type: "error" });
  }
}

async function increaseQuantity(itemId: number, quantity: number) {
  if (!ordersStore.activeOrder) {
    return;
  }
  await ordersStore.updateItem(ordersStore.activeOrder.id, itemId, { quantity: quantity + 1 });
}

async function decreaseQuantity(itemId: number, quantity: number) {
  if (!ordersStore.activeOrder) {
    return;
  }

  const nextQuantity = quantity - 1;
  if (nextQuantity <= 0) {
    await removeItem(itemId);
    return;
  }
  await ordersStore.updateItem(ordersStore.activeOrder.id, itemId, { quantity: nextQuantity });
}

async function removeItem(itemId: number) {
  if (!ordersStore.activeOrder) {
    return;
  }
  await ordersStore.removeItem(ordersStore.activeOrder.id, itemId);
}

async function saveOrder() {
  try {
    const order = await ensureActiveOrder();
    notifications.push({ message: `Order ${order.order_no} saved.`, type: "success" });
    await refreshTableViewData();
  } catch (error) {
    notifications.push({ message: getApiErrorMessage(error), type: "error" });
  }
}

async function sendKot() {
  if (!ordersStore.activeOrder || ordersStore.activeOrder.items.length === 0) {
    notifications.push({ message: "Add items before sending KOT.", type: "warning" });
    return;
  }
  try {
    await ordersStore.sendKot(ordersStore.activeOrder.id);
    notifications.push({ message: "KOT sent.", type: "success" });
    await refreshTableViewData();
  } catch (error) {
    notifications.push({ message: getApiErrorMessage(error), type: "error" });
  }
}

function buildQuickPrintHtml(): string {
  const itemsHtml = (ordersStore.activeOrder?.items || [])
    .map((item) => `<tr><td>${item.menu_item_name}</td><td>${item.quantity}</td><td>Rs ${(item.line_total_cents / 100).toFixed(2)}</td></tr>`)
    .join("");

  return `<!doctype html>
  <html>
    <body style="font-family:Segoe UI,Arial,sans-serif;padding:18px;">
      <h3 style="margin:0 0 8px;">Order ${ordersStore.activeOrder?.order_no || "-"}</h3>
      <p style="margin:0 0 8px;">Table ${selectedTableLabel.value}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Amount</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p style="font-weight:700;margin-top:10px;">Total: ${formatCurrencyFromCents(totalCents.value)}</p>
    </body>
  </html>`;
}

async function saveAndPrint() {
  if (!ordersStore.activeOrder || ordersStore.activeOrder.items.length === 0) {
    notifications.push({ message: "Add items before Save & Print.", type: "warning" });
    return;
  }

  try {
    await saveOrder();

    if (!billingStore.bill) {
      await billingStore.generateBill(ordersStore.activeOrder.id, discountCents.value);
    }

    if (!window.printerAPI?.printHtml) {
      notifications.push({ message: "Printer bridge unavailable. Bill saved without print.", type: "warning" });
      return;
    }

    const response = await window.printerAPI.printHtml({ html: buildQuickPrintHtml(), silent: true });
    if (!response?.ok) {
      throw new Error(response?.error || "Print failed");
    }

    notifications.push({ message: "Order saved and print sent.", type: "success" });
    await refreshTableViewData();
  } catch (error) {
    notifications.push({ message: getApiErrorMessage(error), type: "error" });
  }
}

onMounted(async () => {
  await Promise.all([
    menuStore.fetchCategories(),
    menuStore.fetchItems(),
    refreshTableViewData(),
  ]);

  elapsedTimer = window.setInterval(() => {
    tickingNow.value = Date.now();
  }, 60000);
});

onBeforeUnmount(() => {
  if (elapsedTimer !== null) {
    window.clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
});
</script>

<template>
  <div class="space-y-4">
    <section v-if="screen === 'tables'" class="rounded-2xl bg-slate-900 p-4 text-white shadow-lg">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Table View</h2>
          <p class="text-xs text-slate-300">Select any table to open billing.</p>
        </div>
        <button class="rounded border border-slate-600 bg-slate-800 px-3 py-1 text-xs" :disabled="loadingTableView" @click="refreshTableViewData">
          {{ loadingTableView ? "Refreshing..." : "Refresh" }}
        </button>
      </div>

      <p v-if="tableHistoryError" class="mb-3 rounded border border-red-400 bg-red-500/20 p-2 text-xs text-red-100">
        {{ tableHistoryError }}
      </p>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section class="rounded-xl bg-slate-800/70 p-3">
          <h3 class="mb-2 text-sm font-semibold">Blank</h3>
          <div class="space-y-2">
            <button
              v-for="table in groupedTables.blank"
              :key="`blank-${table.id}`"
              class="w-full rounded-lg border px-3 py-2 text-left"
              :class="tableToneClass(table.tone)"
              @click="openBillingForTable(table.id)"
            >
              <p class="text-sm font-semibold">Table {{ table.table_number }}</p>
              <p class="text-[11px] opacity-80">No active order</p>
            </button>
            <p v-if="groupedTables.blank.length === 0" class="text-xs text-slate-400">No blank tables.</p>
          </div>
        </section>

        <section class="rounded-xl bg-slate-800/70 p-3">
          <h3 class="mb-2 text-sm font-semibold">Running KOT</h3>
          <div class="space-y-2">
            <button
              v-for="table in groupedTables.running"
              :key="`running-${table.id}`"
              class="w-full rounded-lg border px-3 py-2 text-left"
              :class="tableToneClass(table.tone)"
              @click="openBillingForTable(table.id)"
            >
              <p class="text-sm font-semibold">Table {{ table.table_number }}</p>
              <p class="text-[11px]">Elapsed: {{ table.elapsed || "-" }}</p>
              <p class="text-[11px]">Running: {{ formatCurrencyFromCents(table.runningTotalCents) }}</p>
            </button>
            <p v-if="groupedTables.running.length === 0" class="text-xs text-slate-400">No running tables.</p>
          </div>
        </section>

        <section class="rounded-xl bg-slate-800/70 p-3">
          <h3 class="mb-2 text-sm font-semibold">Printed</h3>
          <div class="space-y-2">
            <button
              v-for="table in groupedTables.printed"
              :key="`printed-${table.id}`"
              class="w-full rounded-lg border px-3 py-2 text-left"
              :class="tableToneClass(table.tone)"
              @click="openBillingForTable(table.id)"
            >
              <p class="text-sm font-semibold">Table {{ table.table_number }}</p>
              <p class="text-[11px]">Elapsed: {{ table.elapsed || "-" }}</p>
              <p class="text-[11px]">Running: {{ formatCurrencyFromCents(table.runningTotalCents) }}</p>
            </button>
            <p v-if="groupedTables.printed.length === 0" class="text-xs text-slate-400">No printed tables.</p>
          </div>
        </section>

        <section class="rounded-xl bg-slate-800/70 p-3">
          <h3 class="mb-2 text-sm font-semibold">Paid</h3>
          <div class="space-y-2">
            <button
              v-for="table in groupedTables.paid"
              :key="`paid-${table.id}`"
              class="w-full rounded-lg border px-3 py-2 text-left"
              :class="tableToneClass(table.tone)"
              @click="openBillingForTable(table.id)"
            >
              <p class="text-sm font-semibold">Table {{ table.table_number }}</p>
              <p class="text-[11px]">Last: {{ table.latestOrderNo || "-" }}</p>
              <p class="text-[11px]">Total: {{ formatCurrencyFromCents(table.runningTotalCents) }}</p>
            </button>
            <p v-if="groupedTables.paid.length === 0" class="text-xs text-slate-400">No paid tables.</p>
          </div>
        </section>
      </div>
    </section>

    <section v-else class="rounded-2xl bg-slate-100 p-3 shadow-lg">
      <div class="mb-3 flex items-center justify-between rounded-lg bg-white p-2">
        <div>
          <h2 class="text-base font-semibold text-slate-900">Billing Screen</h2>
          <p class="text-xs text-slate-500">Table {{ selectedTableLabel }} | {{ ordersStore.activeOrder?.order_no || "No order yet" }}</p>
        </div>
        <button class="rounded bg-[#c0392b] px-3 py-2 text-xs text-white" @click="setScreen('tables')">Table View</button>
      </div>

      <div class="grid gap-3 lg:grid-cols-[110px,minmax(0,1fr),220px]">
        <aside class="max-h-[76vh] overflow-auto rounded-lg bg-white p-2">
          <p class="mb-2 text-[11px] font-semibold text-slate-500">Categories</p>
          <div class="space-y-1">
            <button
              v-for="category in categoryOptions"
              :key="String(category.id)"
              class="w-full border-l-4 px-2 py-2 text-left text-xs"
              :class="selectedCategoryId === category.id ? 'border-[#c0392b] bg-red-50 text-[#c0392b]' : 'border-transparent text-slate-700 hover:bg-slate-50'"
              @click="selectCategory(category.id)"
            >
              {{ category.name }}
            </button>
          </div>
        </aside>

        <section class="rounded-lg bg-white p-3">
          <input
            v-model="searchTerm"
            class="mb-3 w-full rounded border px-3 py-2 text-sm"
            placeholder="Search item"
            :disabled="selectedCategoryId === null"
          />

          <div v-if="selectedCategoryId === null" class="rounded border border-dashed p-4 text-center text-sm text-slate-500">
            Select a category from the left to view items.
          </div>

          <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="item in filteredItems"
              :key="item.id"
              class="rounded border p-3 text-left hover:border-[#c0392b]"
              :disabled="!item.is_available"
              @click="addItem(item.id)"
            >
              <p class="text-sm font-semibold text-slate-900">{{ item.name }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ formatCurrencyFromCents(item.price_cents) }}</p>
              <p v-if="!item.is_available" class="mt-1 text-[11px] text-slate-400">Unavailable</p>
            </button>
            <p v-if="filteredItems.length === 0" class="col-span-2 rounded border p-3 text-center text-xs text-slate-500">
              No items found for this category.
            </p>
          </div>
        </section>

        <aside class="rounded-lg bg-white p-3">
          <div class="grid grid-cols-3 gap-1 text-[11px]">
            <button
              class="rounded px-2 py-1"
              :class="orderMode === 'dine_in' ? 'bg-[#c0392b] text-white' : 'bg-slate-100 text-slate-700'"
              @click="setOrderMode('dine_in')"
            >
              Dine In
            </button>
            <button
              class="rounded px-2 py-1"
              :class="orderMode === 'delivery' ? 'bg-[#c0392b] text-white' : 'bg-slate-100 text-slate-700'"
              @click="setOrderMode('delivery')"
            >
              Delivery
            </button>
            <button
              class="rounded px-2 py-1"
              :class="orderMode === 'pickup' ? 'bg-[#c0392b] text-white' : 'bg-slate-100 text-slate-700'"
              @click="setOrderMode('pickup')"
            >
              Pick Up
            </button>
          </div>

          <div class="mt-3 max-h-56 overflow-auto rounded border p-2">
            <p v-if="!ordersStore.activeOrder || ordersStore.activeOrder.items.length === 0" class="text-xs text-slate-500">
              No items in the order.
            </p>
            <div v-for="item in ordersStore.activeOrder?.items || []" :key="item.id" class="mb-2 rounded border p-2">
              <p class="text-xs font-medium">{{ item.menu_item_name }}</p>
              <p class="text-[11px] text-slate-500">{{ formatCurrencyFromCents(item.line_total_cents) }}</p>
              <div class="mt-1 flex items-center gap-1">
                <button class="rounded bg-slate-200 px-2" @click="decreaseQuantity(item.id, item.quantity)">-</button>
                <span class="min-w-6 text-center text-xs">{{ item.quantity }}</span>
                <button class="rounded bg-slate-200 px-2" @click="increaseQuantity(item.id, item.quantity)">+</button>
                <button class="ml-auto rounded bg-red-100 px-2 text-[11px] text-red-700" @click="removeItem(item.id)">x</button>
              </div>
            </div>
          </div>

          <div class="mt-3 space-y-1 text-xs">
            <div class="flex justify-between"><span>Subtotal</span><span>{{ formatCurrencyFromCents(subtotalCents) }}</span></div>
            <label class="flex items-center justify-between gap-2">
              <span>Discount</span>
              <input v-model.number="discountRupees" type="number" min="0" class="w-20 rounded border px-1 py-0.5 text-right text-xs" />
            </label>
            <div class="flex justify-between"><span>Tax</span><span>{{ formatCurrencyFromCents(taxCents) }}</span></div>
            <div class="flex justify-between border-t pt-1 text-sm font-semibold"><span>Total</span><span>{{ formatCurrencyFromCents(totalCents) }}</span></div>
          </div>

          <div class="mt-3 flex flex-wrap gap-1">
            <button class="rounded border px-2 py-1 text-[11px]" :class="paymentPillClass('cash')" @click="selectedPaymentMethod = 'cash'">Cash</button>
            <button class="rounded border px-2 py-1 text-[11px]" :class="paymentPillClass('card')" @click="selectedPaymentMethod = 'card'">Card</button>
            <button class="rounded border px-2 py-1 text-[11px]" :class="paymentPillClass('due')" @click="selectedPaymentMethod = 'due'">Due</button>
            <button class="rounded border px-2 py-1 text-[11px]" :class="paymentPillClass('other')" @click="selectedPaymentMethod = 'other'">Other</button>
          </div>

          <div class="mt-3 grid gap-2">
            <button class="rounded bg-slate-800 px-3 py-2 text-xs text-white" @click="saveOrder">Save</button>
            <button class="rounded bg-amber-600 px-3 py-2 text-xs text-white" @click="sendKot">KOT</button>
            <button class="rounded bg-[#c0392b] px-3 py-2 text-xs text-white" @click="saveAndPrint">Save &amp; Print</button>
          </div>
        </aside>
      </div>
    </section>
  </div>
</template>
