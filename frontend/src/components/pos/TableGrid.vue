<script setup lang="ts">
import { onMounted } from "vue";

import { useTablesStore } from "../../stores/tables";

const tablesStore = useTablesStore();

onMounted(() => {
  tablesStore.fetchTables();
});

function onSelectTable(tableId: number) {
  if (tablesStore.selectedTableId === tableId) {
    tablesStore.selectTable(null);
    return;
  }
  tablesStore.selectTable(tableId);
}
</script>

<template>
  <section class="rounded-lg border bg-white p-3 shadow">
    <h3 class="mb-3 text-sm font-semibold">Tables</h3>
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="table in tablesStore.tables"
        :key="table.id"
        class="rounded border px-2 py-2 text-xs"
        :class="[
          table.status === 'free' ? 'bg-emerald-50' : table.status === 'occupied' ? 'bg-amber-50' : 'bg-slate-100',
          tablesStore.selectedTableId === table.id ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'
        ]"
        @click="onSelectTable(table.id)"
      >
        <p>{{ table.table_number }}</p>
        <p class="text-[11px] text-slate-500">{{ table.seats }} seats</p>
        <span class="ml-1 text-slate-500">{{ table.status }}</span>
      </button>
    </div>
  </section>
</template>
