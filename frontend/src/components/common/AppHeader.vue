<script setup lang="ts">
import type { AxiosError } from "axios";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();
const router = useRouter();

const roleLabel = computed(() => auth.user?.role ?? "guest");
const showPasswordDialog = ref(false);
const changingPassword = ref(false);
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const passwordMessage = ref("");

function resetPasswordForm() {
  currentPassword.value = "";
  newPassword.value = "";
  confirmPassword.value = "";
  passwordMessage.value = "";
}

function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ error?: { message?: string }; detail?: string }>;
  return axiosError?.response?.data?.error?.message || axiosError?.response?.data?.detail || "Unable to change password.";
}

function openPasswordDialog() {
  resetPasswordForm();
  showPasswordDialog.value = true;
}

function closePasswordDialog() {
  showPasswordDialog.value = false;
}

async function changePassword() {
  passwordMessage.value = "";
  if (!currentPassword.value || !newPassword.value) {
    passwordMessage.value = "Current and new password are required.";
    return;
  }
  if (newPassword.value.length < 8) {
    passwordMessage.value = "New password must be at least 8 characters.";
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordMessage.value = "New password and confirmation do not match.";
    return;
  }

  changingPassword.value = true;
  try {
    await auth.changePassword(currentPassword.value, newPassword.value);
    passwordMessage.value = "Password changed successfully.";
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
  } catch (error) {
    passwordMessage.value = getApiErrorMessage(error);
  } finally {
    changingPassword.value = false;
  }
}

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
        <RouterLink v-if="auth.role === 'admin'" class="rounded bg-slate-100 px-3 py-1 text-sm" to="/menu">Menu</RouterLink>
        <RouterLink v-if="auth.role === 'admin'" class="rounded bg-slate-100 px-3 py-1 text-sm" to="/staff">Staff</RouterLink>
        <RouterLink class="rounded bg-slate-100 px-3 py-1 text-sm" to="/reports">Reports</RouterLink>
        <RouterLink class="rounded bg-slate-100 px-3 py-1 text-sm" to="/history">History</RouterLink>
        <button class="rounded bg-slate-100 px-3 py-1 text-sm" @click="openPasswordDialog">Change Password</button>
        <button class="rounded bg-red-600 px-3 py-1 text-sm text-white" @click="onLogout">Logout</button>
      </nav>
    </div>

    <div v-if="showPasswordDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section class="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
        <h3 class="text-base font-semibold">Change Password</h3>
        <div class="mt-3 space-y-2">
          <input
            v-model="currentPassword"
            type="password"
            class="w-full rounded border px-3 py-2 text-sm"
            placeholder="Current password"
          />
          <input
            v-model="newPassword"
            type="password"
            class="w-full rounded border px-3 py-2 text-sm"
            placeholder="New password"
          />
          <input
            v-model="confirmPassword"
            type="password"
            class="w-full rounded border px-3 py-2 text-sm"
            placeholder="Confirm new password"
          />
        </div>
        <p v-if="passwordMessage" class="mt-2 text-xs text-slate-700">{{ passwordMessage }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button class="rounded bg-slate-100 px-3 py-2 text-sm" @click="closePasswordDialog">Cancel</button>
          <button class="rounded bg-slate-900 px-3 py-2 text-sm text-white" :disabled="changingPassword" @click="changePassword">
            {{ changingPassword ? "Updating..." : "Update Password" }}
          </button>
        </div>
      </section>
    </div>
  </header>
</template>
