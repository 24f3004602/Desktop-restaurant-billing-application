import { defineStore } from "pinia";

import { endpoints } from "../api/endpoints";
import { apiClient } from "../api/http";
import type { RestaurantTable } from "../types/models";

export const useTablesStore = defineStore("tables", {
  state: () => ({
    tables: [] as RestaurantTable[],
    selectedTableId: null as number | null,
    loading: false,
    error: "",
  }),
  getters: {
    selectedTable: (state): RestaurantTable | null => {
      if (state.selectedTableId === null) {
        return null;
      }
      return state.tables.find((table) => table.id === state.selectedTableId) ?? null;
    },
  },
  actions: {
    async fetchTables() {
      this.loading = true;
      this.error = "";
      try {
        const { data } = await apiClient.get<RestaurantTable[]>(endpoints.tables);
        this.tables = data;
        if (this.selectedTableId !== null) {
          const stillExists = this.tables.some((table) => table.id === this.selectedTableId);
          if (!stillExists) {
            this.selectedTableId = null;
          }
        }
      } catch (_error) {
        this.error = "Failed to load tables.";
        throw _error;
      } finally {
        this.loading = false;
      }
    },
    async createTable(payload: {
      table_number: string;
      seats: number;
      status?: RestaurantTable["status"];
      is_active?: boolean;
    }) {
      const { data } = await apiClient.post<RestaurantTable>(endpoints.tables, payload);
      await this.fetchTables();
      return data;
    },
    async updateTable(
      tableId: number,
      payload: Partial<{
        table_number: string;
        seats: number;
        status: RestaurantTable["status"];
        is_active: boolean;
      }>
    ) {
      const { data } = await apiClient.patch<RestaurantTable>(`${endpoints.tables}/${tableId}`, payload);
      await this.fetchTables();
      return data;
    },
    selectTable(tableId: number | null) {
      this.selectedTableId = tableId;
    },
    async setTableStatus(tableId: number, status: RestaurantTable["status"]) {
      await apiClient.patch(`${endpoints.tables}/${tableId}/status`, { status });
      await this.fetchTables();
    },
  },
});
