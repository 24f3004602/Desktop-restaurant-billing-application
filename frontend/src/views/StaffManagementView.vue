<script setup lang="ts">
import type { AxiosError } from "axios";
import { onMounted, reactive, ref } from "vue";

import { useUsersStore } from "../stores/users";
import type { Role } from "../types/models";

const usersStore = useUsersStore();
const statusMessage = ref("");

const newUser = reactive({
  username: "",
  fullName: "",
  role: "waiter" as Role,
  password: "",
});

const userDrafts = ref<Record<number, { fullName: string; role: Role; isActive: boolean; password: string }>>({});

function syncDrafts() {
  const nextDrafts: Record<number, { fullName: string; role: Role; isActive: boolean; password: string }> = {};
  for (const user of usersStore.users) {
    nextDrafts[user.id] = {
      fullName: user.full_name || "",
      role: user.role,
      isActive: user.is_active,
      password: "",
    };
  }
  userDrafts.value = nextDrafts;
}

function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ error?: { message?: string }; detail?: string }>;
  return axiosError?.response?.data?.error?.message || axiosError?.response?.data?.detail || "Request failed.";
}

async function loadUsers() {
  statusMessage.value = "";
  try {
    await usersStore.fetchUsers();
    syncDrafts();
  } catch (error) {
    statusMessage.value = getApiErrorMessage(error);
  }
}

async function createUser() {
  statusMessage.value = "";
  if (!newUser.username.trim() || !newUser.password) {
    statusMessage.value = "Username and password are required.";
    return;
  }

  try {
    await usersStore.createUser({
      username: newUser.username.trim(),
      full_name: newUser.fullName.trim() || null,
      role: newUser.role,
      password: newUser.password,
    });

    newUser.username = "";
    newUser.fullName = "";
    newUser.role = "waiter";
    newUser.password = "";
    statusMessage.value = "Staff account created.";
    syncDrafts();
  } catch (error) {
    statusMessage.value = getApiErrorMessage(error);
  }
}

async function saveUser(userId: number) {
  statusMessage.value = "";
  const draft = userDrafts.value[userId];
  if (!draft) {
    return;
  }

  try {
    await usersStore.updateUser(userId, {
      full_name: draft.fullName.trim() || null,
      role: draft.role,
      is_active: draft.isActive,
      password: draft.password || undefined,
    });
    draft.password = "";
    statusMessage.value = "Staff account updated.";
    syncDrafts();
  } catch (error) {
    statusMessage.value = getApiErrorMessage(error);
  }
}

onMounted(async () => {
  await loadUsers();
});
</script>

<template>
  <section class="space-y-4 rounded-lg border bg-white p-4 shadow">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Staff Management</h2>
      <button class="rounded bg-slate-100 px-3 py-2 text-sm" @click="loadUsers">Refresh</button>
    </div>

    <p v-if="usersStore.loading" class="text-sm text-slate-500">Loading staff...</p>
    <p v-if="statusMessage" class="text-sm text-amber-700">{{ statusMessage }}</p>

    <section class="rounded border p-3">
      <h3 class="mb-2 text-sm font-semibold">Add Staff</h3>
      <div class="grid gap-2 md:grid-cols-4">
        <input v-model="newUser.username" class="rounded border px-3 py-2 text-sm" placeholder="Username" />
        <input v-model="newUser.fullName" class="rounded border px-3 py-2 text-sm" placeholder="Full name" />
        <select v-model="newUser.role" class="rounded border px-3 py-2 text-sm">
          <option value="admin">Admin</option>
          <option value="cashier">Cashier</option>
          <option value="waiter">Waiter</option>
        </select>
        <input v-model="newUser.password" type="password" class="rounded border px-3 py-2 text-sm" placeholder="Password" />
      </div>
      <button class="mt-2 rounded bg-slate-900 px-3 py-2 text-sm text-white" :disabled="usersStore.saving" @click="createUser">
        {{ usersStore.saving ? "Saving..." : "Create Staff" }}
      </button>
    </section>

    <section class="rounded border p-3">
      <h3 class="mb-2 text-sm font-semibold">Manage Staff</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b">
              <th class="py-2">Username</th>
              <th class="py-2">Full Name</th>
              <th class="py-2">Role</th>
              <th class="py-2">Active</th>
              <th class="py-2">Reset Password</th>
              <th class="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in usersStore.users" :key="user.id" class="border-b">
              <td class="py-2">{{ user.username }}</td>
              <td class="py-2">
                <input
                  v-if="userDrafts[user.id]"
                  v-model="userDrafts[user.id].fullName"
                  class="rounded border px-2 py-1 text-sm"
                  placeholder="Full name"
                />
              </td>
              <td class="py-2">
                <select v-if="userDrafts[user.id]" v-model="userDrafts[user.id].role" class="rounded border px-2 py-1 text-sm">
                  <option value="admin">Admin</option>
                  <option value="cashier">Cashier</option>
                  <option value="waiter">Waiter</option>
                </select>
              </td>
              <td class="py-2">
                <label v-if="userDrafts[user.id]" class="inline-flex items-center gap-2">
                  <input v-model="userDrafts[user.id].isActive" type="checkbox" />
                  <span>{{ userDrafts[user.id].isActive ? "Active" : "Disabled" }}</span>
                </label>
              </td>
              <td class="py-2">
                <input
                  v-if="userDrafts[user.id]"
                  v-model="userDrafts[user.id].password"
                  type="password"
                  class="rounded border px-2 py-1 text-sm"
                  placeholder="Leave blank"
                />
              </td>
              <td class="py-2">
                <button class="rounded bg-slate-900 px-3 py-1 text-xs text-white" :disabled="usersStore.saving" @click="saveUser(user.id)">
                  {{ usersStore.saving ? "Saving..." : "Save" }}
                </button>
              </td>
            </tr>
            <tr v-if="usersStore.users.length === 0">
              <td colspan="6" class="py-3 text-center text-slate-500">No staff accounts found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
