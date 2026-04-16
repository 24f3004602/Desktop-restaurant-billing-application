import { defineStore } from "pinia";

import { endpoints } from "../api/endpoints";
import { apiClient } from "../api/http";

interface DailySales {
  date: string;
  total_orders: number;
  total_sales_cents: number;
  total_tax_cents: number;
  total_discount_cents: number;
}

interface OrderHistoryRow {
  order_id: number;
  order_no: string;
  status: string;
  order_type: string;
  table_id: number | null;
  opened_at: string;
  grand_total_cents: number | null;
}

export const useReportsStore = defineStore("reports", {
  state: () => ({
    daily: null as DailySales | null,
    history: [] as OrderHistoryRow[],
  }),
  actions: {
    async fetchDaily(date?: string) {
      const { data } = await apiClient.get<DailySales>(`${endpoints.reports}/daily`, { params: { date } });
      this.daily = data;
      return data;
    },
    async fetchHistory(params?: { from?: string; to?: string; table_id?: number }) {
      const { data } = await apiClient.get<OrderHistoryRow[]>(`${endpoints.reports}/orders/history`, { params });
      this.history = data;
      return data;
    },
  },
});
