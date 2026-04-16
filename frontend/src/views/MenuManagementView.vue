<script setup lang="ts">
import { onMounted } from "vue";
import { ref } from "vue";

import { useMenuStore } from "../stores/menu";

const menuStore = useMenuStore();

const newCategoryName = ref("");
const newItemName = ref("");
const newItemPrice = ref(0);
const newItemCategoryId = ref<number | null>(null);
const actionMessage = ref("");

onMounted(async () => {
  await Promise.all([menuStore.fetchCategories(), menuStore.fetchItems()]);
  if (menuStore.categories.length > 0) {
    newItemCategoryId.value = menuStore.categories[0].id;
  }
});

async function createCategory() {
  actionMessage.value = "";
  if (!newCategoryName.value.trim()) {
    return;
  }
  await menuStore.createCategory({ name: newCategoryName.value.trim(), display_order: 0, is_active: true });
  newCategoryName.value = "";
  if (!newItemCategoryId.value && menuStore.categories.length > 0) {
    newItemCategoryId.value = menuStore.categories[0].id;
  }
  actionMessage.value = "Category created.";
}

async function createItem() {
  actionMessage.value = "";
  if (!newItemName.value.trim() || !newItemCategoryId.value || newItemPrice.value <= 0) {
    return;
  }

  await menuStore.createMenuItem({
    category_id: newItemCategoryId.value,
    name: newItemName.value.trim(),
    description: null,
    price_cents: Math.round(newItemPrice.value * 100),
    gst_percent: 5,
    is_available: true,
  });

  newItemName.value = "";
  newItemPrice.value = 0;
  actionMessage.value = "Menu item created.";
}
</script>

<template>
  <section class="rounded-lg border bg-white p-4 shadow">
    <h2 class="text-lg font-semibold">Menu Management</h2>
    <p class="mt-1 text-sm text-slate-500">Manage categories, pricing, and availability.</p>

    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <div class="rounded border p-3">
        <h3 class="mb-2 text-sm font-semibold">Create Category</h3>
        <div class="flex gap-2">
          <input v-model="newCategoryName" class="w-full rounded border px-3 py-2 text-sm" placeholder="Category name" />
          <button class="rounded bg-slate-900 px-3 py-2 text-sm text-white" @click="createCategory">Add</button>
        </div>
      </div>

      <div class="rounded border p-3">
        <h3 class="mb-2 text-sm font-semibold">Create Menu Item</h3>
        <div class="grid gap-2">
          <input v-model="newItemName" class="rounded border px-3 py-2 text-sm" placeholder="Item name" />
          <select v-model="newItemCategoryId" class="rounded border px-3 py-2 text-sm">
            <option v-for="category in menuStore.categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <input v-model.number="newItemPrice" type="number" min="0" class="rounded border px-3 py-2 text-sm" placeholder="Price (Rs)" />
          <button class="rounded bg-slate-900 px-3 py-2 text-sm text-white" @click="createItem">Create Item</button>
        </div>
      </div>
    </div>

    <p v-if="actionMessage" class="mt-3 text-xs text-emerald-700">{{ actionMessage }}</p>

    <div class="mt-4 grid gap-3">
      <div v-for="item in menuStore.items" :key="item.id" class="flex items-center justify-between rounded border p-3">
        <div>
          <p class="font-medium">{{ item.name }}</p>
          <p class="text-xs text-slate-500">Rs {{ (item.price_cents / 100).toFixed(2) }}</p>
        </div>
        <button
          class="rounded px-3 py-1 text-sm text-white"
          :class="item.is_available ? 'bg-emerald-600' : 'bg-slate-500'"
          @click="menuStore.toggleAvailability(item.id, !item.is_available)"
        >
          {{ item.is_available ? "Available" : "Unavailable" }}
        </button>
      </div>
    </div>
  </section>
</template>
