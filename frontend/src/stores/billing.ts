import { defineStore } from "pinia";

import { endpoints } from "../api/endpoints";
import { apiClient } from "../api/http";
import type { Bill, Payment } from "../types/models";

export const useBillingStore = defineStore("billing", {
  state: () => ({
    bill: null as Bill | null,
    payments: [] as Payment[],
    loadingBill: false,
    loadingPayments: false,
  }),
  actions: {
    async generateBill(orderId: number, discountCents = 0) {
      this.loadingBill = true;
      try {
        const { data } = await apiClient.post<Bill>(`${endpoints.billing}/orders/${orderId}/bill`, {
          discount_cents: discountCents,
        });
        this.bill = data;
        return data;
      } finally {
        this.loadingBill = false;
      }
    },
    async addPayment(billId: number, payload: { method: "cash" | "card" | "upi"; amount_cents: number; reference_no?: string | null }) {
      await apiClient.post<Payment>(`${endpoints.bills}/${billId}/payments`, payload);
      await this.fetchPayments(billId);
      await this.fetchBill(billId);
    },
    async fetchPayments(billId: number) {
      this.loadingPayments = true;
      try {
        const { data } = await apiClient.get<Payment[]>(`${endpoints.bills}/${billId}/payments`);
        this.payments = data;
        return data;
      } finally {
        this.loadingPayments = false;
      }
    },
    async fetchBill(billId: number) {
      const { data } = await apiClient.get<Bill>(`${endpoints.billing}/${billId}`);
      this.bill = data;
      return data;
    },
    clearBilling() {
      this.bill = null;
      this.payments = [];
    }
  },
});
