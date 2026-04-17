<script setup lang="ts">
import { computed } from "vue";
import { RouterView } from "vue-router";

import AppHeader from "./components/common/AppHeader.vue";
import { useNotificationsStore } from "./stores/notifications";

const notifications = useNotificationsStore();
const toasts = computed(() => notifications.items);

function toastClass(type: "success" | "error" | "info" | "warning") {
  if (type === "success") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }
  if (type === "error") {
    return "border-red-300 bg-red-50 text-red-800";
  }
  if (type === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }
  return "border-slate-300 bg-white text-slate-700";
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />
    <main class="mx-auto max-w-7xl p-4">
      <RouterView />
    </main>

    <section class="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2">
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <article
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto rounded border px-3 py-2 text-sm shadow"
          :class="toastClass(toast.type)"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="font-medium">{{ toast.message }}</p>
            <button class="rounded px-1 text-xs" @click="notifications.remove(toast.id)">Close</button>
          </div>
        </article>
      </TransitionGroup>
    </section>
  </div>
</template>
