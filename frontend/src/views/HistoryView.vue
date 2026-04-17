<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { useReportsStore } from "../stores/reports";
import { formatReceiptTimestamp } from "../utils/date";
import { formatCurrencyFromCents } from "../utils/currency";

const reports = useReportsStore();
const loading = computed(() => reports.isLoading);
const error = computed(() => reports.error);
const fromDate = ref("");
const toDate = ref("");

async function loadHistory() {
  try {
    await reports.fetchHistory({
      from_date: fromDate.value || undefined,
      to_date: toDate.value || undefined,
    });
  } catch {
    // The store already sets error state for UI rendering.
  }
}

async function clearFilters() {
  fromDate.value = "";
  toDate.value = "";
  await loadHistory();
}

onMounted(async () => {
  await loadHistory();
});
</script>

<template>
  <section class="rounded-lg border bg-white p-4 shadow">
    <h2 class="text-lg font-semibold">Order History</h2>
    <p class="mt-1 text-xs text-slate-500">Showing up to the latest 500 orders.</p>

    <div class="mt-3 flex flex-wrap items-end gap-2">
      <label class="text-xs text-slate-600">
        From
        <input v-model="fromDate" type="date" class="mt-1 rounded border px-2 py-1 text-sm" />
      </label>
      <label class="text-xs text-slate-600">
        To
        <input v-model="toDate" type="date" class="mt-1 rounded border px-2 py-1 text-sm" />
      </label>
      <button class="rounded bg-slate-900 px-3 py-2 text-sm text-white" @click="loadHistory">Apply Filters</button>
      <button class="rounded bg-slate-100 px-3 py-2 text-sm text-slate-700" @click="clearFilters">Clear</button>
    </div>

    <div v-if="loading" class="mt-4 flex items-center gap-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" aria-hidden="true"></span>
      <span>Loading order history...</span>
    </div>

    <div v-else-if="error" class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {{ error }}
    </div>

    <div v-else class="mt-4 overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead>
          <tr class="border-b">
            <th class="py-2">Order No</th>
            <th class="py-2">Status</th>
            <th class="py-2">Type</th>
            <th class="py-2">Table</th>
            <th class="py-2">Opened</th>
            <th class="py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!reports.history.length" class="border-b">
            <td colspan="6" class="py-4 text-center text-sm text-slate-500">No orders found.</td>
          </tr>
          <tr v-for="row in reports.history" :key="row.order_id" class="border-b">
            <td class="py-2">{{ row.order_no }}</td>
            <td class="py-2">{{ row.status }}</td>
            <td class="py-2">{{ row.order_type }}</td>
            <td class="py-2">{{ row.table_id ?? "-" }}</td>
            <td class="py-2">{{ formatReceiptTimestamp(row.opened_at) }}</td>
            <td class="py-2">{{ formatCurrencyFromCents(row.grand_total_cents ?? 0) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
