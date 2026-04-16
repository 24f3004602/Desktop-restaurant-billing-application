<script setup lang="ts">
import type { AxiosError } from "axios";
import { ref } from "vue";
import { useRouter } from "vue-router";

import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

const username = ref("admin");
const password = ref("admin123");
const errorMessage = ref("");

function getErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ error?: { message?: string }; detail?: string }>;
  return axiosError?.response?.data?.error?.message || axiosError?.response?.data?.detail || "Login failed. Check credentials.";
}

async function onSubmit() {
  errorMessage.value = "";
  try {
    await auth.login(username.value, password.value);
    router.push("/pos");
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
    console.error(error);
  }
}
</script>

<template>
  <section class="mx-auto mt-10 max-w-md rounded-lg border bg-white p-6 shadow">
    <h2 class="text-xl font-semibold">Staff Login</h2>
    <p class="mt-1 text-sm text-slate-500">Sign in as admin, cashier, or waiter.</p>

    <form class="mt-4 space-y-3" @submit.prevent="onSubmit">
      <input v-model="username" class="w-full rounded border px-3 py-2" placeholder="Username" />
      <input v-model="password" type="password" class="w-full rounded border px-3 py-2" placeholder="Password" />
      <button class="w-full rounded bg-slate-900 px-3 py-2 text-white" :disabled="auth.loading">Login</button>
      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
    </form>
  </section>
</template>
