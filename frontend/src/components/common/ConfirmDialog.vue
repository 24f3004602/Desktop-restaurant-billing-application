<script setup lang="ts">
const props = defineProps<{
  title: string;
  message: string;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();
</script>

<template>
  <div class="fixed inset-0 grid place-items-center bg-slate-900/40 p-4">
    <div class="w-full max-w-sm rounded-lg bg-white p-4 shadow">
      <h3 class="text-lg font-semibold">{{ props.title }}</h3>
      <p class="mt-2 text-sm text-slate-600">{{ props.message }}</p>
      <div class="mt-4 flex justify-end gap-2">
        <button class="rounded border px-3 py-1 text-sm" @click="emit('cancel')">Cancel</button>
        <button class="rounded bg-red-600 px-3 py-1 text-sm text-white" @click="emit('confirm')">Confirm</button>
      </div>
    </div>
  </div>
</template>
