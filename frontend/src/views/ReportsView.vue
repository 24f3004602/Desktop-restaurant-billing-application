<script setup lang="ts">
import { onMounted } from "vue";

import { useReportsStore } from "../stores/reports";
import { formatCurrencyFromCents } from "../utils/currency";

const reports = useReportsStore();

onMounted(async () => {
  await reports.fetchDaily();
});
</script>

<template>
  <section class="rounded-lg border bg-white p-4 shadow">
    <h2 class="text-lg font-semibold">Daily Sales Report</h2>
    <div v-if="reports.daily" class="mt-4 grid gap-2 text-sm">
      <p>Date: {{ reports.daily.date }}</p>
      <p>Total Orders: {{ reports.daily.total_orders }}</p>
      <p>Total Sales: {{ formatCurrencyFromCents(reports.daily.total_sales_cents) }}</p>
      <p>Total Tax: {{ formatCurrencyFromCents(reports.daily.total_tax_cents) }}</p>
      <p>Total Discount: {{ formatCurrencyFromCents(reports.daily.total_discount_cents) }}</p>
    </div>
  </section>
</template>
