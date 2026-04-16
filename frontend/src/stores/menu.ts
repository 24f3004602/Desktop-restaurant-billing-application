import { defineStore } from "pinia";

import { endpoints } from "../api/endpoints";
import { apiClient } from "../api/http";
import type { Category, MenuItem } from "../types/models";

export const useMenuStore = defineStore("menu", {
  state: () => ({
    categories: [] as Category[],
    items: [] as MenuItem[],
    loading: false,
  }),
  actions: {
    async fetchCategories() {
      const { data } = await apiClient.get<Category[]>(endpoints.categories);
      this.categories = data;
    },
    async fetchItems() {
      const { data } = await apiClient.get<MenuItem[]>(endpoints.menuItems);
      this.items = data;
    },
    async toggleAvailability(itemId: number, isAvailable: boolean) {
      await apiClient.patch(`${endpoints.menuItems}/${itemId}/availability`, { is_available: isAvailable });
      await this.fetchItems();
    },
    async createCategory(payload: { name: string; display_order?: number; is_active?: boolean }) {
      await apiClient.post(endpoints.categories, payload);
      await this.fetchCategories();
    },
    async createMenuItem(payload: {
      category_id: number;
      name: string;
      description?: string | null;
      price_cents: number;
      gst_percent?: number;
      is_available?: boolean;
    }) {
      await apiClient.post(endpoints.menuItems, payload);
      await this.fetchItems();
    },
  },
});
