<script setup lang="ts">
import type { AxiosError } from "axios";
import { onMounted } from "vue";
import { ref } from "vue";

import { useMenuStore } from "../../stores/menu";
import { useOrdersStore } from "../../stores/orders";

const menuStore = useMenuStore();
const ordersStore = useOrdersStore();
const actionMessage = ref("");

function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ error?: { message?: string }; detail?: string }>;
  return axiosError?.response?.data?.error?.message || axiosError?.response?.data?.detail || "Request failed.";
}

onMounted(() => {
  menuStore.fetchItems();
});

async function addItem(menuItemId: number) {
  actionMessage.value = "";
  if (!ordersStore.activeOrder) {
    return;
  }

  try {
    await ordersStore.addItem(ordersStore.activeOrder.id, {
      menu_item_id: menuItemId,
      quantity: 1,
      special_note: null,
    });
  } catch (error) {
    actionMessage.value = getApiErrorMessage(error);
  }
}
</script>

<template>
  <section class="rounded-lg border bg-white p-3 shadow">
    <h3 class="mb-3 text-sm font-semibold">Menu Items</h3>
    <p v-if="!ordersStore.activeOrder" class="mb-3 text-xs text-amber-700">Create an order before adding items.</p>
    <p v-if="actionMessage" class="mb-3 text-xs text-red-600">{{ actionMessage }}</p>
    <div class="space-y-2">
      <div v-for="item in menuStore.items" :key="item.id" class="rounded border p-2 text-sm">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="font-medium">{{ item.name }}</p>
            <p class="text-xs text-slate-500">Rs {{ (item.price_cents / 100).toFixed(2) }}</p>
            <p v-if="item.track_inventory" class="text-xs" :class="item.is_low_stock ? 'text-amber-700' : 'text-slate-500'">
              Stock: {{ item.stock_quantity }}
            </p>
          </div>
          <button
            class="rounded px-2 py-1 text-xs text-white"
            :class="ordersStore.activeOrder && item.is_available ? 'bg-emerald-600' : 'bg-slate-400 cursor-not-allowed'"
            :disabled="!ordersStore.activeOrder || !item.is_available"
            @click="addItem(item.id)"
          >
            {{ item.is_available ? "Add" : "Out" }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
