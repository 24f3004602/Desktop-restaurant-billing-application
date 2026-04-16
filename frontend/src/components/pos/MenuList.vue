<script setup lang="ts">
import { onMounted } from "vue";

import { useMenuStore } from "../../stores/menu";
import { useOrdersStore } from "../../stores/orders";

const menuStore = useMenuStore();
const ordersStore = useOrdersStore();

onMounted(() => {
  menuStore.fetchItems();
});

async function addItem(menuItemId: number) {
  if (!ordersStore.activeOrder) {
    return;
  }

  await ordersStore.addItem(ordersStore.activeOrder.id, {
    menu_item_id: menuItemId,
    quantity: 1,
    special_note: null,
  });
}
</script>

<template>
  <section class="rounded-lg border bg-white p-3 shadow">
    <h3 class="mb-3 text-sm font-semibold">Menu Items</h3>
    <p v-if="!ordersStore.activeOrder" class="mb-3 text-xs text-amber-700">Create an order before adding items.</p>
    <div class="space-y-2">
      <div v-for="item in menuStore.items" :key="item.id" class="rounded border p-2 text-sm">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="font-medium">{{ item.name }}</p>
            <p class="text-xs text-slate-500">Rs {{ (item.price_cents / 100).toFixed(2) }}</p>
          </div>
          <button
            class="rounded px-2 py-1 text-xs text-white"
            :class="ordersStore.activeOrder ? 'bg-emerald-600' : 'bg-slate-400 cursor-not-allowed'"
            :disabled="!ordersStore.activeOrder"
            @click="addItem(item.id)"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
