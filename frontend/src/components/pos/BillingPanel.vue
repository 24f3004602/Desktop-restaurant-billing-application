<script setup lang="ts">
import { computed, ref } from "vue";

import { useBillingStore } from "../../stores/billing";
import { useOrdersStore } from "../../stores/orders";
import { formatCurrencyFromCents } from "../../utils/currency";

const billing = useBillingStore();
const orders = useOrdersStore();

const payableCents = computed(() => billing.bill?.grand_total_cents ?? 0);
const remainingCents = computed(() => {
  if (!billing.bill) {
    return 0;
  }
  const paid = billing.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  return Math.max(0, billing.bill.grand_total_cents - paid);
});

const discountRupees = ref(0);
const paymentMethod = ref<"cash" | "card" | "upi">("cash");
const paymentAmountRupees = ref(0);
const paymentReference = ref("");

async function createBill() {
  if (!orders.activeOrder) {
    return;
  }
  const bill = await billing.generateBill(orders.activeOrder.id, Math.max(0, Math.round(discountRupees.value * 100)));
  await billing.fetchPayments(bill.id);
  paymentAmountRupees.value = Number((remainingCents.value / 100).toFixed(2));
}

async function addPayment() {
  if (!billing.bill) {
    return;
  }

  const amountCents = Math.round(paymentAmountRupees.value * 100);
  if (amountCents <= 0) {
    return;
  }

  await billing.addPayment(billing.bill.id, {
    method: paymentMethod.value,
    amount_cents: amountCents,
    reference_no: paymentReference.value || null,
  });

  paymentReference.value = "";
  paymentAmountRupees.value = Number((remainingCents.value / 100).toFixed(2));
}
</script>

<template>
  <section class="rounded-lg border bg-white p-3 shadow">
    <h3 class="mb-2 text-sm font-semibold">Billing</h3>
    <label class="mb-2 block text-xs text-slate-600">
      Discount (Rs)
      <input v-model.number="discountRupees" type="number" min="0" class="mt-1 w-full rounded border px-2 py-1 text-sm" />
    </label>
    <button class="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white" :disabled="billing.loadingBill" @click="createBill">
      Generate Bill
    </button>
    <p class="mt-2 text-sm">Payable: {{ formatCurrencyFromCents(payableCents) }}</p>

    <template v-if="billing.bill">
      <p class="mt-1 text-xs text-slate-500">Status: {{ billing.bill.payment_status }}</p>
      <p class="mt-1 text-xs text-slate-500">Remaining: {{ formatCurrencyFromCents(remainingCents) }}</p>

      <div class="mt-3 space-y-2 border-t pt-3">
        <label class="block text-xs text-slate-600">
          Method
          <select v-model="paymentMethod" class="mt-1 w-full rounded border px-2 py-1 text-sm">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
          </select>
        </label>

        <label class="block text-xs text-slate-600">
          Amount (Rs)
          <input v-model.number="paymentAmountRupees" type="number" min="0" class="mt-1 w-full rounded border px-2 py-1 text-sm" />
        </label>

        <label class="block text-xs text-slate-600">
          Reference (optional)
          <input v-model="paymentReference" class="mt-1 w-full rounded border px-2 py-1 text-sm" />
        </label>

        <button class="w-full rounded bg-emerald-600 px-3 py-2 text-sm text-white" @click="addPayment">Add Payment</button>

        <div class="max-h-28 overflow-auto rounded border p-2 text-xs">
          <p v-for="payment in billing.payments" :key="payment.id" class="py-0.5">
            {{ payment.method.toUpperCase() }} - {{ formatCurrencyFromCents(payment.amount_cents) }}
          </p>
          <p v-if="billing.payments.length === 0" class="text-slate-500">No payments yet.</p>
        </div>
      </div>
    </template>
  </section>
</template>
