<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useAuthStore } from "../../stores/auth";
import { getApiErrorMessage } from "../../utils/api";

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
    passwordMessage.value = getApiErrorMessage(error, "Unable to change password.");
  } finally {
    changingPassword.value = false;
  }
}

function onLogout() {
  auth.logout();
  router.push("/login");
}

function openTableView() {
  router.push({ path: "/pos", query: { view: "tables" } });
}
</script>

<template>
  <header class="border-b border-slate-800 bg-slate-900 text-white">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 p-4">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-[#c0392b] text-sm font-bold">RB</div>
        <div>
          <h1 class="text-lg font-semibold">Restaurant POS</h1>
          <p class="text-xs text-slate-300">Role: {{ roleLabel }}</p>
        </div>
      </div>

      <nav class="flex flex-wrap items-center gap-2">
        <button class="rounded bg-[#c0392b] px-3 py-1.5 text-sm font-medium text-white" @click="openTableView">Table View</button>
        <RouterLink class="rounded bg-slate-800 px-3 py-1.5 text-sm" to="/pos">Billing</RouterLink>
        <RouterLink v-if="auth.role === 'admin'" class="rounded bg-slate-800 px-3 py-1.5 text-sm" to="/menu">Menu</RouterLink>
        <RouterLink v-if="auth.role === 'admin'" class="rounded bg-slate-800 px-3 py-1.5 text-sm" to="/staff">Staff</RouterLink>
        <RouterLink v-if="auth.role === 'admin'" class="rounded bg-slate-800 px-3 py-1.5 text-sm" to="/settings">Settings</RouterLink>
        <RouterLink class="rounded bg-slate-800 px-3 py-1.5 text-sm" to="/reports">Reports</RouterLink>
        <RouterLink class="rounded bg-slate-800 px-3 py-1.5 text-sm" to="/history">History</RouterLink>

        <button class="rounded bg-slate-800 p-2" title="Change Password" @click="openPasswordDialog">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 14.8 7.1 17.2 8 11.7 4 7.8 9.5 7z" />
          </svg>
        </button>
        <button class="rounded bg-[#c0392b] p-2" title="Logout" @click="onLogout">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H4" />
            <path d="M20 4v16" />
          </svg>
        </button>
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
