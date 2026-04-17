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

interface DateRangeParams {
  from_date?: string;
  to_date?: string;
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
    async fetchHistory(params?: DateRangeParams & { table_id?: number }) {
      this.isLoading = true;
      this.error = "";
      try {
        const queryParams = {
          from: params?.from_date,
          to: params?.to_date,
          table_id: params?.table_id,
        };
        const { data } = await apiClient.get<OrderHistoryRow[]>(`${endpoints.reports}/orders/history`, { params: queryParams });
        this.history = data;
        return data;
      } catch (_error) {
        this.error = "Failed to load order history.";
        throw _error;
      } finally {
        this.isLoading = false;
      }
    },
    async fetchSalesByDay(params?: DateRangeParams) {
      this.isLoading = true;
      this.error = "";
      try {
        const queryParams = {
          from: params?.from_date,
          to: params?.to_date,
        };
        const { data } = await apiClient.get<SalesByDayRow[]>(`${endpoints.reports}/sales-by-day`, { params: queryParams });
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
