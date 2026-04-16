<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();
const router = useRouter();

const roleLabel = computed(() => auth.user?.role ?? "guest");

function onLogout() {
  auth.logout();
  router.push("/login");
}
</script>

<template>
  <header class="border-b border-slate-200 bg-white">
    <div class="mx-auto flex max-w-7xl items-center justify-between p-4">
      <div>
        <h1 class="text-lg font-semibold">Restaurant POS</h1>
        <p class="text-sm text-slate-500">Role: {{ roleLabel }}</p>
      </div>
      <nav class="flex items-center gap-2">
        <RouterLink class="rounded bg-slate-100 px-3 py-1 text-sm" to="/pos">POS</RouterLink>
        <RouterLink class="rounded bg-slate-100 px-3 py-1 text-sm" to="/menu">Menu</RouterLink>
        <RouterLink class="rounded bg-slate-100 px-3 py-1 text-sm" to="/reports">Reports</RouterLink>
        <RouterLink class="rounded bg-slate-100 px-3 py-1 text-sm" to="/history">History</RouterLink>
        <button class="rounded bg-red-600 px-3 py-1 text-sm text-white" @click="onLogout">Logout</button>
      </nav>
    </div>
  </header>
</template>
