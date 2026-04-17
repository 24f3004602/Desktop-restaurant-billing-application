<script setup lang="ts">
import { onMounted, reactive } from "vue";

import { useNotificationsStore } from "../stores/notifications";
import { useSettingsStore } from "../stores/settings";
import type { ReceiptSettings } from "../stores/settings";

const settingsStore = useSettingsStore();
const notifications = useNotificationsStore();

const form = reactive<ReceiptSettings>({
  name: "",
  address: "",
  phone: "",
  gstin: "",
  footer: "",
});

function syncFormFromStore() {
  form.name = settingsStore.receipt.name;
  form.address = settingsStore.receipt.address;
  form.phone = settingsStore.receipt.phone;
  form.gstin = settingsStore.receipt.gstin;
  form.footer = settingsStore.receipt.footer;
}

async function loadSettings() {
  await settingsStore.loadReceiptSettings();
  syncFormFromStore();
}

async function saveSettings() {
  try {
    await settingsStore.saveReceiptSettings({
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      gstin: form.gstin.trim(),
      footer: form.footer.trim(),
    });
    notifications.push({ message: "Receipt settings saved.", type: "success" });
  } catch {
    notifications.push({ message: settingsStore.error || "Failed to save receipt settings.", type: "error" });
  }
}

onMounted(async () => {
  await loadSettings();
});
</script>

<template>
  <section class="rounded-lg border bg-white p-4 shadow">
    <div class="mb-3 flex items-center justify-between gap-2">
      <div>
        <h2 class="text-lg font-semibold">Receipt Branding Settings</h2>
        <p class="text-sm text-slate-500">Update receipt header/footer details without rebuilding the app.</p>
      </div>
      <button class="rounded bg-slate-100 px-3 py-2 text-sm" :disabled="settingsStore.loading" @click="loadSettings">
        {{ settingsStore.loading ? "Refreshing..." : "Refresh" }}
      </button>
    </div>

    <p v-if="settingsStore.error" class="mb-3 text-sm text-red-600">{{ settingsStore.error }}</p>

    <div class="grid gap-3 md:grid-cols-2">
      <label class="text-sm text-slate-700">
        Restaurant Name
        <input v-model="form.name" class="mt-1 w-full rounded border px-3 py-2 text-sm" />
      </label>

      <label class="text-sm text-slate-700">
        Phone
        <input v-model="form.phone" class="mt-1 w-full rounded border px-3 py-2 text-sm" />
      </label>

      <label class="text-sm text-slate-700 md:col-span-2">
        Address
        <input v-model="form.address" class="mt-1 w-full rounded border px-3 py-2 text-sm" />
      </label>

      <label class="text-sm text-slate-700">
        GSTIN
        <input v-model="form.gstin" class="mt-1 w-full rounded border px-3 py-2 text-sm" />
      </label>

      <label class="text-sm text-slate-700 md:col-span-2">
        Receipt Footer
        <textarea v-model="form.footer" class="mt-1 min-h-20 w-full rounded border px-3 py-2 text-sm" />
      </label>
    </div>

    <div class="mt-4 flex items-center gap-2">
      <button
        class="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        :disabled="settingsStore.saving"
        @click="saveSettings"
      >
        {{ settingsStore.saving ? "Saving..." : "Save Settings" }}
      </button>
      <button class="rounded bg-slate-100 px-3 py-2 text-sm" @click="syncFormFromStore">Reset Unsaved</button>
    </div>
  </section>
</template>
