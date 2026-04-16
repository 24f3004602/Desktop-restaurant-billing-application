<script setup lang="ts">
import { useCart } from "../../composables/useCart";
import { formatCurrencyFromCents } from "../../utils/currency";

const { orders, totalCents, increase, decrease, remove } = useCart();
</script>

<template>
  <section class="rounded-lg border bg-white p-3 shadow">
    <h3 class="mb-3 text-sm font-semibold">Current Order</h3>
    <div v-if="orders.activeOrder?.items?.length" class="space-y-2">
      <div v-for="item in orders.activeOrder.items" :key="item.id" class="rounded border p-2 text-sm">
        <p>Item #{{ item.menu_item_id }} x {{ item.quantity }}</p>
        <p class="text-xs text-slate-500">{{ formatCurrencyFromCents(item.line_total_cents) }}</p>
        <div class="mt-2 flex gap-1">
          <button class="rounded bg-slate-200 px-2 py-1 text-xs" @click="decrease(item.id, item.quantity)">-</button>
          <button class="rounded bg-slate-200 px-2 py-1 text-xs" @click="increase(item.id, item.quantity)">+</button>
          <button class="rounded bg-red-600 px-2 py-1 text-xs text-white" @click="remove(item.id)">Remove</button>
        </div>
      </div>
      <p class="pt-2 text-sm font-semibold">Total: {{ formatCurrencyFromCents(totalCents) }}</p>
    </div>
    <p v-else class="text-sm text-slate-500">No active order.</p>
  </section>
</template>
