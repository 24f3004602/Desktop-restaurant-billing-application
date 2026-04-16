<script setup lang="ts">
import { onMounted } from "vue";

import { useReportsStore } from "../stores/reports";
import { formatReceiptTimestamp } from "../utils/date";
import { formatCurrencyFromCents } from "../utils/currency";

const reports = useReportsStore();

onMounted(async () => {
  await reports.fetchHistory();
});
</script>

<template>
  <section class="rounded-lg border bg-white p-4 shadow">
    <h2 class="text-lg font-semibold">Order History</h2>
    <div class="mt-4 overflow-x-auto">
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
