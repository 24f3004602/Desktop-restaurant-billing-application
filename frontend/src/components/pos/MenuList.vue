<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { useMenuStore } from "../../stores/menu";
import { useOrdersStore } from "../../stores/orders";
import { getApiErrorMessage } from "../../utils/api";

const menuStore = useMenuStore();
const ordersStore = useOrdersStore();
const actionMessage = ref("");
const searchTerm = ref("");
const selectedCategoryId = ref<number | null>(null);

const filteredItems = computed(() => {
  if (selectedCategoryId.value === null) {
    return [];
  }

  const search = searchTerm.value.trim().toLowerCase();
  return menuStore.items.filter((item) => {
    const searchMatch = !search || item.name.toLowerCase().includes(search);
    return item.category_id === selectedCategoryId.value && searchMatch;
  });
});

const selectedCategoryName = computed(() => {
  if (selectedCategoryId.value === null) {
    return "";
  }
  return menuStore.categories.find((category) => category.id === selectedCategoryId.value)?.name || "";
});

function toggleCategory(categoryId: number) {
  if (selectedCategoryId.value === categoryId) {
    selectedCategoryId.value = null;
    return;
  }
  selectedCategoryId.value = categoryId;
}

onMounted(() => {
  menuStore.fetchItems();
  menuStore.fetchCategories();
});

async function addItem(menuItemId: number) {
  actionMessage.value = "";
  if (!ordersStore.activeOrder) {
    return;
  }

  try {
    await ordersStore.addItem(ordersStore.activeOrder.id, {
      menu_item_id: menuItemId,
      quantity: 1,
      special_note: null,
    });
  } catch (error) {
    actionMessage.value = getApiErrorMessage(error);
  }
}
</script>

<template>
  <section class="rounded-lg border bg-white p-3 shadow">
    <h3 class="mb-3 text-sm font-semibold">Menu Items</h3>
    <div class="grid gap-3 lg:grid-cols-[11rem,1fr]">
      <div>
        <p class="mb-2 text-xs font-medium text-slate-600">Categories</p>
        <div class="max-h-72 space-y-1 overflow-auto rounded border p-1">
          <button
            v-for="category in menuStore.categories"
            :key="category.id"
            class="w-full rounded px-2 py-1 text-left text-xs"
            :class="selectedCategoryId === category.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'"
            @click="toggleCategory(category.id)"
          >
            {{ category.name }}
          </button>
          <p v-if="menuStore.categories.length === 0" class="px-2 py-1 text-xs text-slate-500">No categories found.</p>
        </div>
      </div>

      <div>
        <input
          v-model="searchTerm"
          class="mb-2 w-full rounded border px-2 py-1 text-xs"
          placeholder="Search menu item"
          :disabled="selectedCategoryId === null"
        />

        <p v-if="selectedCategoryId !== null" class="mb-2 text-xs text-slate-500">
          Showing items in {{ selectedCategoryName }}.
        </p>

        <p v-if="!ordersStore.activeOrder" class="mb-3 text-xs text-amber-700">Create an order before adding items.</p>
        <p v-if="actionMessage" class="mb-3 text-xs text-red-600">{{ actionMessage }}</p>

        <div v-if="selectedCategoryId === null" class="rounded border p-3 text-xs text-slate-500">
          Select a category from the left to view items.
        </div>

        <div v-else class="space-y-2">
          <div v-for="item in filteredItems" :key="item.id" class="rounded border p-2 text-sm">
            <div class="flex items-center justify-between gap-2">
              <div>
                <p class="font-medium">{{ item.name }}</p>
                <p class="text-xs text-slate-500">Rs {{ (item.price_cents / 100).toFixed(2) }}</p>
                <p v-if="item.track_inventory" class="text-xs" :class="item.is_low_stock ? 'text-amber-700' : 'text-slate-500'">
                  Stock: {{ item.stock_quantity }}
                </p>
              </div>
              <button
                class="rounded px-2 py-1 text-xs text-white"
                :class="ordersStore.activeOrder && item.is_available ? 'bg-emerald-600' : 'bg-slate-400 cursor-not-allowed'"
                :disabled="!ordersStore.activeOrder || !item.is_available"
                @click="addItem(item.id)"
              >
                {{ item.is_available ? "Add" : "Out" }}
              </button>
            </div>
          </div>

          <p v-if="filteredItems.length === 0" class="rounded border p-2 text-xs text-slate-500">No items match current filters.</p>
        </div>
      </div>
    </div>
  </section>
</template>
