import { defineStore } from "pinia";

import { endpoints } from "../api/endpoints";
import { apiClient } from "../api/http";
import type { RestaurantTable } from "../types/models";

export const useTablesStore = defineStore("tables", {
  state: () => ({
    tables: [] as RestaurantTable[],
    selectedTableId: null as number | null,
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
      const { data } = await apiClient.get<RestaurantTable[]>(endpoints.tables);
      this.tables = data;
      if (this.selectedTableId !== null) {
        const stillExists = this.tables.some((table) => table.id === this.selectedTableId);
        if (!stillExists) {
          this.selectedTableId = null;
        }
      }
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
