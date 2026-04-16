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

interface SalesByDayRow {
  date: string;
  total_orders: number;
  total_sales_cents: number;
}

export const useReportsStore = defineStore("reports", {
  state: () => ({
    daily: null as DailySales | null,
    history: [] as OrderHistoryRow[],
    salesByDay: [] as SalesByDayRow[],
    isLoading: false,
    error: "",
  }),
  actions: {
    async fetchDaily(date?: string) {
      this.isLoading = true;
      this.error = "";
      try {
        const { data } = await apiClient.get<DailySales>(`${endpoints.reports}/daily`, { params: { date } });
        this.daily = data;
        return data;
      } catch (_error) {
        this.error = "Failed to load daily report.";
        throw _error;
      } finally {
        this.isLoading = false;
      }
    },
    async fetchHistory(params?: { from?: string; to?: string; table_id?: number }) {
      this.isLoading = true;
      this.error = "";
      try {
        const { data } = await apiClient.get<OrderHistoryRow[]>(`${endpoints.reports}/orders/history`, { params });
        this.history = data;
        return data;
      } catch (_error) {
        this.error = "Failed to load order history.";
        throw _error;
      } finally {
        this.isLoading = false;
      }
    },
    async fetchSalesByDay(params?: { from?: string; to?: string }) {
      this.isLoading = true;
      this.error = "";
      try {
        const { data } = await apiClient.get<SalesByDayRow[]>(`${endpoints.reports}/sales-by-day`, { params });
        this.salesByDay = data;
        return data;
      } catch (_error) {
        this.error = "Failed to load sales chart data.";
        throw _error;
      } finally {
        this.isLoading = false;
      }
    },
  },
});
