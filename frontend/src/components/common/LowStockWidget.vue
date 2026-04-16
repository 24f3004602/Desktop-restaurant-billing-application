<script setup lang="ts">
import type { AxiosError } from "axios";
import { computed, onMounted, ref } from "vue";

import { useMenuStore } from "../../stores/menu";

const menuStore = useMenuStore();
const loading = ref(false);
const errorMessage = ref("");

const trackedInventoryCount = computed(() => menuStore.items.filter((item) => item.track_inventory).length);
const lowStockItems = computed(() =>
  menuStore.items
    .filter((item) => item.track_inventory && item.stock_quantity <= item.low_stock_threshold)
    .sort((a, b) => a.stock_quantity - b.stock_quantity || a.name.localeCompare(b.name))
);
const outOfStockCount = computed(() => lowStockItems.value.filter((item) => item.stock_quantity <= 0).length);

function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ error?: { message?: string }; detail?: string }>;
  return axiosError?.response?.data?.error?.message || axiosError?.response?.data?.detail || "Failed to load inventory.";
}

async function refreshInventory() {
  loading.value = true;
  errorMessage.value = "";
  try {
    await menuStore.fetchItems();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (menuStore.items.length === 0) {
    await refreshInventory();
  }
});
</script>

<template>
  <section class="rounded-lg border border-amber-200 bg-amber-50/50 p-3 shadow-sm">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold text-amber-900">Low Stock Watchlist</h3>
        <p class="text-xs text-amber-800/90">
          Tracked items: {{ trackedInventoryCount }} | Low/Out: {{ lowStockItems.length }} | Out: {{ outOfStockCount }}
        </p>
      </div>
      <button
        class="rounded bg-amber-700 px-3 py-1 text-xs text-white disabled:cursor-not-allowed disabled:bg-amber-400"
        :disabled="loading"
        @click="refreshInventory"
      >
        {{ loading ? "Refreshing..." : "Refresh" }}
      </button>
    </div>

    <p v-if="errorMessage" class="mt-2 text-xs text-red-700">{{ errorMessage }}</p>

    <p v-else-if="loading && menuStore.items.length === 0" class="mt-2 text-xs text-slate-600">Loading inventory data...</p>

    <p v-else-if="lowStockItems.length === 0" class="mt-2 text-xs text-emerald-700">All tracked inventory items are above threshold.</p>

    <div v-else class="mt-2 overflow-x-auto rounded border border-amber-200 bg-white">
      <table class="min-w-full text-left text-xs">
        <thead>
          <tr class="border-b bg-amber-50">
            <th class="px-2 py-2">Item</th>
            <th class="px-2 py-2 text-right">Stock</th>
            <th class="px-2 py-2 text-right">Threshold</th>
            <th class="px-2 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in lowStockItems" :key="item.id" class="border-b last:border-b-0">
            <td class="px-2 py-2 font-medium">{{ item.name }}</td>
            <td class="px-2 py-2 text-right">{{ item.stock_quantity }}</td>
            <td class="px-2 py-2 text-right">{{ item.low_stock_threshold }}</td>
            <td class="px-2 py-2">
              <span
                class="rounded px-2 py-0.5 font-medium"
                :class="item.stock_quantity <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'"
              >
                {{ item.stock_quantity <= 0 ? "Out of stock" : "Low stock" }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
