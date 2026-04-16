<script setup lang="ts">
import { RouterView } from "vue-router";
import AppHeader from "./components/common/AppHeader.vue";
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />
    <main class="mx-auto max-w-7xl p-4">
      <RouterView />
    </main>
  </div>
</template>
