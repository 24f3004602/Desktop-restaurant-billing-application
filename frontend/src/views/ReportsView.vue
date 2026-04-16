<script setup lang="ts">
import Chart from "chart.js/auto";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import LowStockWidget from "../components/common/LowStockWidget.vue";
import { useReportsStore } from "../stores/reports";
import { formatReceiptTimestamp } from "../utils/date";
import { formatCurrencyFromCents } from "../utils/currency";

const reports = useReportsStore();
const fromDate = ref(new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10));
const toDate = ref(new Date().toISOString().slice(0, 10));
const searchTerm = ref("");
const statusMessage = ref("");
const chartCanvas = ref<HTMLCanvasElement | null>(null);
let salesChart: Chart | null = null;

const filteredHistory = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  if (!term) {
    return reports.history;
  }
  return reports.history.filter((row) => {
    return (
      row.order_no.toLowerCase().includes(term) ||
      row.status.toLowerCase().includes(term) ||
      row.order_type.toLowerCase().includes(term) ||
      String(row.table_id ?? "").includes(term)
    );
  });
});

async function renderChart() {
  await nextTick();
  if (!chartCanvas.value) {
    return;
  }

  if (salesChart) {
    salesChart.destroy();
  }

  salesChart = new Chart(chartCanvas.value, {
    type: "line",
    data: {
      labels: reports.salesByDay.map((row) => row.date),
      datasets: [
        {
          label: "Sales (Rs)",
          data: reports.salesByDay.map((row) => Number((row.total_sales_cents / 100).toFixed(2))),
          borderColor: "#0f766e",
          backgroundColor: "rgba(15, 118, 110, 0.15)",
          fill: true,
          tension: 0.28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `Rs ${value}`,
          },
        },
      },
    },
  });
}

async function loadReports() {
  statusMessage.value = "";
  try {
    await Promise.all([
      reports.fetchDaily(toDate.value),
      reports.fetchSalesByDay({ from: fromDate.value, to: toDate.value }),
      reports.fetchHistory({ from: fromDate.value, to: toDate.value }),
    ]);
    await renderChart();
  } catch (_error) {
    statusMessage.value = reports.error || "Failed to load reports.";
  }
}

onMounted(async () => {
  await loadReports();
});

onBeforeUnmount(() => {
  if (salesChart) {
    salesChart.destroy();
  }
});
</script>

<template>
  <section class="space-y-4 rounded-lg border bg-white p-4 shadow">
    <div class="flex flex-wrap items-end gap-2">
      <div>
        <p class="text-xs text-slate-500">From</p>
        <input v-model="fromDate" type="date" class="rounded border px-2 py-1 text-sm" />
      </div>
      <div>
        <p class="text-xs text-slate-500">To</p>
        <input v-model="toDate" type="date" class="rounded border px-2 py-1 text-sm" />
      </div>
      <button class="rounded bg-slate-900 px-3 py-2 text-sm text-white" @click="loadReports">Refresh</button>
    </div>

    <p v-if="reports.isLoading" class="text-sm text-slate-500">Loading reports...</p>
    <p v-if="statusMessage" class="text-sm text-red-600">{{ statusMessage }}</p>

    <LowStockWidget />

    <div v-if="reports.daily" class="grid gap-2 md:grid-cols-4">
      <article class="rounded border p-3">
        <p class="text-xs text-slate-500">Date</p>
        <p class="text-sm font-semibold">{{ reports.daily.date }}</p>
      </article>
      <article class="rounded border p-3">
        <p class="text-xs text-slate-500">Orders</p>
        <p class="text-sm font-semibold">{{ reports.daily.total_orders }}</p>
      </article>
      <article class="rounded border p-3">
        <p class="text-xs text-slate-500">Sales</p>
        <p class="text-sm font-semibold">{{ formatCurrencyFromCents(reports.daily.total_sales_cents) }}</p>
      </article>
      <article class="rounded border p-3">
        <p class="text-xs text-slate-500">Tax / Discount</p>
        <p class="text-sm font-semibold">
          {{ formatCurrencyFromCents(reports.daily.total_tax_cents) }} / {{ formatCurrencyFromCents(reports.daily.total_discount_cents) }}
        </p>
      </article>
    </div>

    <div class="rounded border p-3">
      <h3 class="text-sm font-semibold">Sales by Day</h3>
      <div class="mt-2 h-72 w-full">
        <canvas ref="chartCanvas" />
      </div>
    </div>

    <div class="rounded border p-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">Order History</h3>
        <input v-model="searchTerm" class="rounded border px-2 py-1 text-sm" placeholder="Search order/status/table" />
      </div>

      <div class="mt-3 overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b">
              <th class="py-2">Order</th>
              <th class="py-2">Status</th>
              <th class="py-2">Type</th>
              <th class="py-2">Table</th>
              <th class="py-2">Opened</th>
              <th class="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredHistory" :key="row.order_id" class="border-b">
              <td class="py-2">{{ row.order_no }}</td>
              <td class="py-2">{{ row.status }}</td>
              <td class="py-2">{{ row.order_type }}</td>
              <td class="py-2">{{ row.table_id ?? "-" }}</td>
              <td class="py-2">{{ formatReceiptTimestamp(row.opened_at) }}</td>
              <td class="py-2 text-right">{{ formatCurrencyFromCents(row.grand_total_cents ?? 0) }}</td>
            </tr>
            <tr v-if="filteredHistory.length === 0">
              <td colspan="6" class="py-3 text-center text-slate-500">No matching history rows.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
