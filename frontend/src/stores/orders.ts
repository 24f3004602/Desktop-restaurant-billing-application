import { defineStore } from "pinia";

import { endpoints } from "../api/endpoints";
import { apiClient } from "../api/http";
import type { Order } from "../types/models";

export const useOrdersStore = defineStore("orders", {
  state: () => ({
    activeOrder: null as Order | null,
    creatingOrder: false,
  }),
  actions: {
    async createOrder(payload: { table_id?: number | null; order_type: "dine_in" | "takeaway"; notes?: string | null }) {
      this.creatingOrder = true;
      try {
        const { data } = await apiClient.post<Order>(endpoints.orders, payload);
        this.activeOrder = data;
        return data;
      } finally {
        this.creatingOrder = false;
      }
    },
    async getOrder(orderId: number) {
      const { data } = await apiClient.get<Order>(`${endpoints.orders}/${orderId}`);
      this.activeOrder = data;
      return data;
    },
    async addItem(orderId: number, payload: { menu_item_id: number; quantity: number; special_note?: string | null }) {
      const { data } = await apiClient.post<Order>(`${endpoints.orders}/${orderId}/items`, payload);
      this.activeOrder = data;
      return data;
    },
    async updateItem(orderId: number, itemId: number, payload: { quantity?: number; special_note?: string | null }) {
      const { data } = await apiClient.patch<Order>(`${endpoints.orders}/${orderId}/items/${itemId}`, payload);
      this.activeOrder = data;
      return data;
    },
    async removeItem(orderId: number, itemId: number) {
      const { data } = await apiClient.delete<Order>(`${endpoints.orders}/${orderId}/items/${itemId}`);
      this.activeOrder = data;
      return data;
    },
    async sendKot(orderId: number) {
      await apiClient.post(`${endpoints.orders}/${orderId}/kot`);
      await this.getOrder(orderId);
    },
    clearActiveOrder() {
      this.activeOrder = null;
    },
  },
});
