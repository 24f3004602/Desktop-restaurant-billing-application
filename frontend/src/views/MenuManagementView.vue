<script setup lang="ts">
import type { AxiosError } from "axios";
import { onMounted } from "vue";
import { ref } from "vue";

import { useMenuStore } from "../stores/menu";
import type { StockAdjustment } from "../types/models";
import { useTablesStore } from "../stores/tables";
import { formatReceiptTimestamp } from "../utils/date";

const menuStore = useMenuStore();
const tablesStore = useTablesStore();

const newCategoryName = ref("");
const newItemName = ref("");
const newItemPrice = ref(0);
const newItemCategoryId = ref<number | null>(null);
const newItemGstPercent = ref(5);
const newItemTrackInventory = ref(false);
const newItemStockQuantity = ref(0);
const newItemLowStockThreshold = ref(5);
const newTableNumber = ref("");
const newTableSeats = ref(4);
const stockDeltaByItem = ref<Record<number, number>>({});
const stockReasonByItem = ref<Record<number, string>>({});
const stockNoteByItem = ref<Record<number, string>>({});
const showMovementHistoryByItem = ref<Record<number, boolean>>({});
const loadingMovementHistoryByItem = ref<Record<number, boolean>>({});
const movementHistoryErrorByItem = ref<Record<number, string>>({});
const movementFromDateByItem = ref<Record<number, string>>({});
const movementToDateByItem = ref<Record<number, string>>({});
const movementReasonFilterByItem = ref<Record<number, string>>({});
const actionMessage = ref("");

function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ error?: { message?: string }; detail?: string }>;
  return axiosError?.response?.data?.error?.message || axiosError?.response?.data?.detail || "Request failed.";
}

onMounted(async () => {
  await Promise.all([menuStore.fetchCategories(), menuStore.fetchItems(), tablesStore.fetchTables()]);
  if (menuStore.categories.length > 0) {
    newItemCategoryId.value = menuStore.categories[0].id;
  }
});

async function createCategory() {
  actionMessage.value = "";
  if (!newCategoryName.value.trim()) {
    return;
  }
  try {
    await menuStore.createCategory({ name: newCategoryName.value.trim(), display_order: 0, is_active: true });
  } catch (error) {
    actionMessage.value = getApiErrorMessage(error);
    return;
  }

  newCategoryName.value = "";
  if (!newItemCategoryId.value && menuStore.categories.length > 0) {
    newItemCategoryId.value = menuStore.categories[0].id;
  }
  actionMessage.value = "Category created.";
}

async function createItem() {
  actionMessage.value = "";
  if (!newItemName.value.trim() || !newItemCategoryId.value || newItemPrice.value <= 0) {
    return;
  }

  try {
    await menuStore.createMenuItem({
      category_id: newItemCategoryId.value,
      name: newItemName.value.trim(),
      description: null,
      price_cents: Math.round(newItemPrice.value * 100),
      gst_percent: newItemGstPercent.value,
      is_available: true,
      track_inventory: newItemTrackInventory.value,
      stock_quantity: newItemTrackInventory.value ? Math.max(0, Math.round(newItemStockQuantity.value)) : 0,
      low_stock_threshold: newItemTrackInventory.value ? Math.max(0, Math.round(newItemLowStockThreshold.value)) : 0,
    });
  } catch (error) {
    actionMessage.value = getApiErrorMessage(error);
    return;
  }

  newItemName.value = "";
  newItemPrice.value = 0;
  newItemGstPercent.value = 5;
  newItemTrackInventory.value = false;
  newItemStockQuantity.value = 0;
  newItemLowStockThreshold.value = 5;
  actionMessage.value = "Menu item created.";
}

async function adjustStock(itemId: number) {
  actionMessage.value = "";
  const delta = Math.round(stockDeltaByItem.value[itemId] ?? 0);
  const reason = (stockReasonByItem.value[itemId] || "manual_adjustment").trim();
  const note = (stockNoteByItem.value[itemId] || "").trim();

  if (!delta) {
    actionMessage.value = "Stock delta must be non-zero.";
    return;
  }
  if (!reason || reason.length < 2) {
    actionMessage.value = "Reason must be at least 2 characters.";
    return;
  }

  try {
    await menuStore.adjustStock(itemId, {
      delta_quantity: delta,
      reason,
      note: note || null,
    });
  } catch (error) {
    actionMessage.value = getApiErrorMessage(error);
    return;
  }

  stockDeltaByItem.value[itemId] = 0;
  stockReasonByItem.value[itemId] = "manual_adjustment";
  stockNoteByItem.value[itemId] = "";

  if (showMovementHistoryByItem.value[itemId]) {
    await loadMovementHistory(itemId, true);
  }

  actionMessage.value = "Stock adjusted.";
}

function formatDelta(quantity: number): string {
  return quantity > 0 ? `+${quantity}` : `${quantity}`;
}

function formatReason(reason: string): string {
  return reason
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getMovementRows(itemId: number): StockAdjustment[] {
  return menuStore.stockMovementsByItem[itemId] || [];
}

function getMovementReasonOptions(itemId: number): string[] {
  return Array.from(new Set(getMovementRows(itemId).map((movement) => movement.reason))).sort((a, b) => a.localeCompare(b));
}

function getFilteredMovementRows(itemId: number): StockAdjustment[] {
  const movements = getMovementRows(itemId);
  const fromDate = movementFromDateByItem.value[itemId] || "";
  const toDate = movementToDateByItem.value[itemId] || "";
  const reason = movementReasonFilterByItem.value[itemId] || "";

  const fromTimestamp = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
  const toTimestamp = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

  return movements.filter((movement) => {
    if (reason && movement.reason !== reason) {
      return false;
    }

    if (fromTimestamp === null && toTimestamp === null) {
      return true;
    }

    const movementTimestamp = new Date(movement.created_at).getTime();
    if (Number.isNaN(movementTimestamp)) {
      return false;
    }
    if (fromTimestamp !== null && movementTimestamp < fromTimestamp) {
      return false;
    }
    if (toTimestamp !== null && movementTimestamp > toTimestamp) {
      return false;
    }
    return true;
  });
}

function clearMovementFilters(itemId: number): void {
  movementFromDateByItem.value[itemId] = "";
  movementToDateByItem.value[itemId] = "";
  movementReasonFilterByItem.value[itemId] = "";
}

async function loadMovementHistory(itemId: number, forceRefresh = false) {
  if (loadingMovementHistoryByItem.value[itemId]) {
    return;
  }

  if (!forceRefresh && menuStore.stockMovementsByItem[itemId]) {
    return;
  }

  loadingMovementHistoryByItem.value[itemId] = true;
  movementHistoryErrorByItem.value[itemId] = "";
  try {
    await menuStore.fetchStockAdjustments(itemId);
  } catch (error) {
    movementHistoryErrorByItem.value[itemId] = getApiErrorMessage(error);
  } finally {
    loadingMovementHistoryByItem.value[itemId] = false;
  }
}

async function toggleMovementHistory(itemId: number) {
  const nextVisible = !showMovementHistoryByItem.value[itemId];
  showMovementHistoryByItem.value[itemId] = nextVisible;
  if (nextVisible) {
    await loadMovementHistory(itemId);
  }
}

async function createTable() {
  actionMessage.value = "";
  if (!newTableNumber.value.trim() || newTableSeats.value <= 0) {
    return;
  }

  try {
    await tablesStore.createTable({
      table_number: newTableNumber.value.trim(),
      seats: Math.round(newTableSeats.value),
      status: "free",
      is_active: true,
    });
  } catch (error) {
    actionMessage.value = getApiErrorMessage(error);
    return;
  }

  newTableNumber.value = "";
  newTableSeats.value = 4;
  actionMessage.value = "Table created.";
}
</script>

<template>
  <section class="rounded-lg border bg-white p-4 shadow">
    <h2 class="text-lg font-semibold">Menu Management</h2>
    <p class="mt-1 text-sm text-slate-500">Manage categories, pricing, and availability.</p>

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <div class="rounded border p-3">
        <h3 class="mb-2 text-sm font-semibold">Create Category</h3>
        <div class="flex gap-2">
          <input v-model="newCategoryName" class="w-full rounded border px-3 py-2 text-sm" placeholder="Category name" />
          <button class="rounded bg-slate-900 px-3 py-2 text-sm text-white" @click="createCategory">Add</button>
        </div>
      </div>

      <div class="rounded border p-3">
        <h3 class="mb-2 text-sm font-semibold">Create Menu Item</h3>
        <div class="grid gap-2">
          <input v-model="newItemName" class="rounded border px-3 py-2 text-sm" placeholder="Item name" />
          <select v-model="newItemCategoryId" class="rounded border px-3 py-2 text-sm">
            <option v-for="category in menuStore.categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <input v-model.number="newItemPrice" type="number" min="0" class="rounded border px-3 py-2 text-sm" placeholder="Price (Rs)" />
          <select v-model.number="newItemGstPercent" class="rounded border px-3 py-2 text-sm">
            <option :value="0">GST 0%</option>
            <option :value="5">GST 5%</option>
            <option :value="12">GST 12%</option>
            <option :value="18">GST 18%</option>
          </select>
          <label class="flex items-center gap-2 text-xs text-slate-600">
            <input v-model="newItemTrackInventory" type="checkbox" />
            Track inventory
          </label>
          <template v-if="newItemTrackInventory">
            <input
              v-model.number="newItemStockQuantity"
              type="number"
              min="0"
              class="rounded border px-3 py-2 text-sm"
              placeholder="Initial stock"
            />
            <input
              v-model.number="newItemLowStockThreshold"
              type="number"
              min="0"
              class="rounded border px-3 py-2 text-sm"
              placeholder="Low stock threshold"
            />
          </template>
          <button class="rounded bg-slate-900 px-3 py-2 text-sm text-white" @click="createItem">Create Item</button>
        </div>
      </div>

      <div class="rounded border p-3">
        <h3 class="mb-2 text-sm font-semibold">Add Table</h3>
        <div class="grid gap-2">
          <input v-model="newTableNumber" class="rounded border px-3 py-2 text-sm" placeholder="Table number (e.g. T12)" />
          <input
            v-model.number="newTableSeats"
            type="number"
            min="1"
            class="rounded border px-3 py-2 text-sm"
            placeholder="Seats"
          />
          <button class="rounded bg-slate-900 px-3 py-2 text-sm text-white" @click="createTable">Create Table</button>
        </div>
      </div>
    </div>

    <p v-if="actionMessage" class="mt-3 text-xs text-emerald-700">{{ actionMessage }}</p>

    <div class="mt-4 grid gap-3">
      <div v-for="item in menuStore.items" :key="item.id" class="flex items-center justify-between rounded border p-3">
        <div class="min-w-0 flex-1">
          <p class="font-medium">{{ item.name }}</p>
          <p class="text-xs text-slate-500">Rs {{ (item.price_cents / 100).toFixed(2) }}</p>
          <p v-if="item.track_inventory" class="text-xs text-slate-500">
            Stock: {{ item.stock_quantity }} | Low at {{ item.low_stock_threshold }}
          </p>
          <p v-if="item.track_inventory && item.is_low_stock" class="text-xs font-medium text-amber-700">Low stock</p>
          <p v-if="!item.track_inventory" class="text-xs text-slate-500">Inventory tracking off</p>
          <div v-if="item.track_inventory" class="mt-2 grid gap-2 md:grid-cols-3">
            <input
              v-model.number="stockDeltaByItem[item.id]"
              type="number"
              class="rounded border px-2 py-1 text-xs"
              placeholder="+/- quantity"
            />
            <input
              v-model="stockReasonByItem[item.id]"
              class="rounded border px-2 py-1 text-xs"
              placeholder="Reason"
            />
            <div class="flex gap-2">
              <input
                v-model="stockNoteByItem[item.id]"
                class="w-full rounded border px-2 py-1 text-xs"
                placeholder="Note (optional)"
              />
              <button class="rounded bg-slate-700 px-2 py-1 text-xs text-white" @click="adjustStock(item.id)">Adjust</button>
            </div>
          </div>

          <div v-if="item.track_inventory" class="mt-2 flex flex-wrap items-center gap-2">
            <button class="rounded bg-slate-100 px-2 py-1 text-xs" @click="toggleMovementHistory(item.id)">
              {{ showMovementHistoryByItem[item.id] ? "Hide" : "Show" }} Timeline
            </button>
            <button
              v-if="showMovementHistoryByItem[item.id]"
              class="rounded bg-slate-100 px-2 py-1 text-xs"
              :disabled="loadingMovementHistoryByItem[item.id]"
              @click="loadMovementHistory(item.id, true)"
            >
              {{ loadingMovementHistoryByItem[item.id] ? "Refreshing..." : "Refresh" }}
            </button>
          </div>

          <div v-if="item.track_inventory && showMovementHistoryByItem[item.id]" class="mt-2 overflow-x-auto rounded border">
            <p v-if="movementHistoryErrorByItem[item.id]" class="p-2 text-xs text-red-700">
              {{ movementHistoryErrorByItem[item.id] }}
            </p>
            <p v-else-if="loadingMovementHistoryByItem[item.id]" class="p-2 text-xs text-slate-500">Loading movement timeline...</p>
            <div v-else class="space-y-2 p-2">
              <div class="grid gap-2 md:grid-cols-5">
                <label class="text-[11px] text-slate-600">
                  <span class="mb-1 block">From</span>
                  <input v-model="movementFromDateByItem[item.id]" type="date" class="w-full rounded border px-2 py-1 text-xs" />
                </label>
                <label class="text-[11px] text-slate-600">
                  <span class="mb-1 block">To</span>
                  <input v-model="movementToDateByItem[item.id]" type="date" class="w-full rounded border px-2 py-1 text-xs" />
                </label>
                <label class="text-[11px] text-slate-600 md:col-span-2">
                  <span class="mb-1 block">Reason</span>
                  <select v-model="movementReasonFilterByItem[item.id]" class="w-full rounded border px-2 py-1 text-xs">
                    <option value="">All reasons</option>
                    <option v-for="reason in getMovementReasonOptions(item.id)" :key="reason" :value="reason">
                      {{ formatReason(reason) }}
                    </option>
                  </select>
                </label>
                <div class="flex items-end">
                  <button class="w-full rounded bg-slate-100 px-2 py-1 text-xs" @click="clearMovementFilters(item.id)">Clear Filters</button>
                </div>
              </div>

              <p class="text-[11px] text-slate-500">
                Showing {{ getFilteredMovementRows(item.id).length }} of {{ getMovementRows(item.id).length }} entries
              </p>

              <table class="min-w-full text-left text-xs">
                <thead>
                  <tr class="border-b bg-slate-50">
                    <th class="px-2 py-2">Time</th>
                    <th class="px-2 py-2 text-right">Change</th>
                    <th class="px-2 py-2 text-right">After</th>
                    <th class="px-2 py-2">Reason</th>
                    <th class="px-2 py-2">Note</th>
                    <th class="px-2 py-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="movement in getFilteredMovementRows(item.id)"
                    :key="movement.id"
                    class="border-b last:border-b-0"
                  >
                    <td class="px-2 py-2">{{ formatReceiptTimestamp(movement.created_at) }}</td>
                    <td
                      class="px-2 py-2 text-right font-medium"
                      :class="movement.change_quantity > 0 ? 'text-emerald-700' : 'text-red-700'"
                    >
                      {{ formatDelta(movement.change_quantity) }}
                    </td>
                    <td class="px-2 py-2 text-right">{{ movement.quantity_after }}</td>
                    <td class="px-2 py-2">{{ formatReason(movement.reason) }}</td>
                    <td class="px-2 py-2">{{ movement.note || "-" }}</td>
                    <td class="px-2 py-2">{{ movement.created_by ? `User #${movement.created_by}` : "System" }}</td>
                  </tr>
                  <tr v-if="getFilteredMovementRows(item.id).length === 0">
                    <td colspan="6" class="px-2 py-3 text-center text-slate-500">
                      {{ getMovementRows(item.id).length === 0 ? "No movement entries yet." : "No entries match current filters." }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="ml-3">
          <button
            class="rounded px-3 py-1 text-sm text-white"
            :class="item.is_available ? 'bg-emerald-600' : 'bg-slate-500'"
            @click="menuStore.toggleAvailability(item.id, !item.is_available)"
          >
            {{ item.is_available ? "Available" : "Unavailable" }}
          </button>
        </div>
      </div>
    </div>

    <div class="mt-4 grid gap-2 md:grid-cols-3">
      <div v-for="table in tablesStore.tables" :key="table.id" class="rounded border p-3 text-sm">
        <p class="font-medium">{{ table.table_number }}</p>
        <p class="text-xs text-slate-500">{{ table.seats }} seats</p>
        <p class="text-xs text-slate-500">Status: {{ table.status }}</p>
      </div>
    </div>
  </section>
</template>
