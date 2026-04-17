<script setup lang="ts">
import { useOrdersStore } from "../../stores/orders";

const orders = useOrdersStore();

async function sendKot() {
  if (!orders.activeOrder) {
    return;
  }
  await orders.sendKot(orders.activeOrder.id);
}
</script>

<template>
  <section class="rounded-lg border bg-white p-3 shadow">
    <h3 class="mb-2 text-sm font-semibold">Kitchen Order Ticket</h3>
    <button
      data-hotkey="send-kot"
      class="w-full rounded px-3 py-2 text-sm text-white"
      :class="orders.activeOrder ? 'bg-amber-600' : 'cursor-not-allowed bg-slate-400'"
      :disabled="!orders.activeOrder"
      @click="sendKot"
    >
      Send KOT [F8]
    </button>
  </section>
</template>
