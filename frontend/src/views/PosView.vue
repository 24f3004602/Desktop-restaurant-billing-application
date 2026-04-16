<script setup lang="ts">
import { ref } from "vue";

import BillingPanel from "../components/pos/BillingPanel.vue";
import KotPanel from "../components/pos/KotPanel.vue";
import MenuList from "../components/pos/MenuList.vue";
import OrderCart from "../components/pos/OrderCart.vue";
import PrinterPanel from "../components/pos/PrinterPanel.vue";
import TableGrid from "../components/pos/TableGrid.vue";
import { useOrderStatus } from "../composables/useOrderStatus";
import { useOrdersStore } from "../stores/orders";
import { useTablesStore } from "../stores/tables";

const ordersStore = useOrdersStore();
const tablesStore = useTablesStore();
const { activeOrderStatus } = useOrderStatus();

const orderType = ref<"dine_in" | "takeaway">("dine_in");
const orderNotes = ref("");
const statusMessage = ref("");

async function createOrder() {
  statusMessage.value = "";
  try {
    const tableId = orderType.value === "dine_in" ? tablesStore.selectedTableId : null;
    if (orderType.value === "dine_in" && !tableId) {
      statusMessage.value = "Select a table for dine-in order.";
      return;
    }

    await ordersStore.createOrder({
      table_id: tableId,
      order_type: orderType.value,
      notes: orderNotes.value || null,
    });

    statusMessage.value = `Order ${ordersStore.activeOrder?.order_no || "created"} ready.`;
    orderNotes.value = "";
  } catch (error) {
    statusMessage.value = "Failed to create order.";
    console.error(error);
  }
}
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-lg border bg-white p-3 shadow">
      <div class="grid gap-2 md:grid-cols-6">
        <label class="text-sm md:col-span-2">
          <span class="mb-1 block text-slate-600">Order Type</span>
          <select v-model="orderType" class="w-full rounded border px-2 py-2">
            <option value="dine_in">Dine-In</option>
            <option value="takeaway">Takeaway</option>
          </select>
        </label>
        <label class="text-sm md:col-span-3">
          <span class="mb-1 block text-slate-600">Notes</span>
          <input v-model="orderNotes" class="w-full rounded border px-2 py-2" placeholder="Special instructions" />
        </label>
        <div class="md:col-span-1 md:flex md:items-end">
          <button class="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white" @click="createOrder">
            New Order
          </button>
        </div>
      </div>
      <p class="mt-2 text-xs text-slate-500" v-if="ordersStore.activeOrder">
        Active: {{ ordersStore.activeOrder.order_no }} ({{ activeOrderStatus }})
      </p>
      <p class="mt-1 text-xs text-amber-700" v-if="statusMessage">{{ statusMessage }}</p>
    </section>

    <div class="grid gap-4 lg:grid-cols-12">
    <section class="lg:col-span-3"><TableGrid /></section>
    <section class="lg:col-span-4"><MenuList /></section>
    <section class="lg:col-span-3"><OrderCart /></section>
    <section class="lg:col-span-2 space-y-4">
      <KotPanel />
      <BillingPanel />
      <PrinterPanel />
    </section>
    </div>
  </div>
</template>
