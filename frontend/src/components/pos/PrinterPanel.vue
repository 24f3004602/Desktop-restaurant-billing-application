<script setup lang="ts">
import { onMounted, ref } from "vue";

import { usePrinter } from "../../composables/usePrinter";

const { printers, loading, error, loadPrinters, printHtml } = usePrinter();
const status = ref("");

async function printTest() {
  status.value = "";
  try {
    await printHtml("<html><body><h3>POS Printer Test</h3><p>Print path is working.</p></body></html>");
    status.value = "Test receipt sent";
  } catch (err) {
    status.value = err instanceof Error ? err.message : "Print failed";
  }
}

onMounted(() => {
  loadPrinters();
});
</script>

<template>
  <section class="rounded-lg border bg-white p-3 shadow">
    <h3 class="mb-2 text-sm font-semibold">Printer</h3>
    <p v-if="loading" class="text-xs text-slate-500">Loading printers...</p>
    <p v-else-if="error" class="text-xs text-amber-700">{{ error }}</p>
    <div v-else class="space-y-1 text-xs">
      <p v-for="printer in printers" :key="printer.name">{{ printer.displayName }}</p>
      <p v-if="printers.length === 0" class="text-slate-500">No printers found.</p>
    </div>
    <button class="mt-3 w-full rounded bg-slate-900 px-3 py-2 text-sm text-white" @click="printTest">Print Test</button>
    <p v-if="status" class="mt-2 text-xs text-slate-600">{{ status }}</p>
  </section>
</template>
