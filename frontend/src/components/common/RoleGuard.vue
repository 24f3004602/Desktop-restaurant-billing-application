<script setup lang="ts">
import { computed } from "vue";

import { useAuthStore } from "../../stores/auth";
import type { Role } from "../../types/models";

const props = defineProps<{
  roles: Role[];
}>();

const auth = useAuthStore();
const allowed = computed(() => {
  const role = auth.role;
  if (!role) {
    return false;
  }
  return props.roles.includes(role);
});
</script>

<template>
  <slot v-if="allowed" />
</template>
