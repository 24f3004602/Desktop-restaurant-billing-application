<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { useBillingStore } from "../../stores/billing";
import { useOrdersStore } from "../../stores/orders";
import { getApiErrorMessage } from "../../utils/api";
import { formatCurrencyFromCents } from "../../utils/currency";

type StatusType = "error" | "success" | "info";

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
const splitWays = ref(2);
const statusMessage = ref("");
const statusType = ref<StatusType>("info");
const isPaid = computed(() => billing.bill?.payment_status === "paid");
const splitPerPersonRupees = computed(() => {
  const ways = Math.max(1, Math.round(splitWays.value || 1));
  return Number(((remainingCents.value / 100) / ways).toFixed(2));
});

async function createBill() {
  if (!orders.activeOrder) {
    return;
  }
  statusMessage.value = "";
  statusType.value = "info";
  try {
    const bill = await billing.generateBill(orders.activeOrder.id, Math.max(0, Math.round(discountRupees.value * 100)));
    await billing.fetchPayments(bill.id);
    paymentAmountRupees.value = Number((remainingCents.value / 100).toFixed(2));
  } catch (error) {
    statusMessage.value = getApiErrorMessage(error, "Request failed. Please try again.");
    statusType.value = "error";
  }
}

async function addPayment() {
  if (!billing.bill) {
    return;
  }

  const amountCents = Math.round(paymentAmountRupees.value * 100);
  if (amountCents <= 0) {
    return;
  }
  if (amountCents > remainingCents.value) {
    statusMessage.value = "Payment exceeds remaining amount.";
    statusType.value = "error";
    return;
  }

  statusMessage.value = "";
  statusType.value = "info";
  try {
    await billing.addPayment(billing.bill.id, {
      method: paymentMethod.value,
      amount_cents: amountCents,
      reference_no: paymentReference.value || null,
    });
  } catch (error) {
    statusMessage.value = getApiErrorMessage(error, "Request failed. Please try again.");
    statusType.value = "error";
    return;
  }

  paymentReference.value = "";
  paymentAmountRupees.value = Number((remainingCents.value / 100).toFixed(2));
}

function applySplitAmount() {
  splitWays.value = Math.max(1, Math.round(splitWays.value || 1));
  if (remainingCents.value <= 0) {
    statusMessage.value = "No remaining amount to split.";
    statusType.value = "info";
    paymentAmountRupees.value = 0;
    return;
  }

  paymentAmountRupees.value = splitPerPersonRupees.value;
  statusMessage.value = `Split into ${splitWays.value} ways. Prefilled ${paymentAmountRupees.value.toFixed(2)}.`;
  statusType.value = "info";
}

function startNewOrder() {
  orders.clearActiveOrder();
  billing.clearBilling();
  discountRupees.value = 0;
  paymentAmountRupees.value = 0;
  paymentReference.value = "";
  statusMessage.value = "Ready for a new order.";
  statusType.value = "success";
}

watch(isPaid, (paidNow) => {
  if (paidNow) {
    statusMessage.value = "Payment completed successfully.";
    statusType.value = "success";
  }
});
</script>

<template>
  <section class="rounded-lg border bg-white p-3 shadow">
    <h3 class="mb-2 text-sm font-semibold">Billing</h3>
    <label class="mb-2 block text-xs text-slate-600">
      Discount (Rs)
      <input v-model.number="discountRupees" type="number" min="0" class="mt-1 w-full rounded border px-2 py-1 text-sm" />
    </label>
    <button
      data-hotkey="generate-bill"
      class="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      :disabled="!!billing.bill || billing.loadingBill"
      @click="createBill"
    >
      Generate Bill [F9]
    </button>
    <p
      v-if="statusMessage"
      class="mt-2 text-xs"
      :class="statusType === 'error' ? 'text-red-600' : statusType === 'success' ? 'text-emerald-700' : 'text-slate-600'"
    >
      {{ statusMessage }}
    </p>

    <div v-if="isPaid" class="mt-2 rounded border border-emerald-300 bg-emerald-50 p-2">
      <p class="text-xs font-medium text-emerald-800">Bill fully paid.</p>
      <button class="mt-2 w-full rounded bg-emerald-700 px-3 py-2 text-sm text-white" @click="startNewOrder">
        Start New Order
      </button>
    </div>

    <p class="mt-2 text-sm">Payable: {{ formatCurrencyFromCents(payableCents) }}</p>

    <template v-if="billing.bill">
      <p class="mt-1 text-xs text-slate-500">Status: {{ billing.bill.payment_status }}</p>
      <p class="mt-1 text-xs text-slate-500">Remaining: {{ formatCurrencyFromCents(remainingCents) }}</p>

      <div class="mt-3 space-y-2 border-t pt-3">
        <div class="rounded border border-slate-200 bg-slate-50 p-2">
          <p class="text-xs font-medium text-slate-700">Split Bill</p>
          <div class="mt-2 flex items-end gap-2">
            <label class="block flex-1 text-xs text-slate-600">
              Ways
              <input v-model.number="splitWays" type="number" min="1" class="mt-1 w-full rounded border px-2 py-1 text-sm" />
            </label>
            <button class="rounded bg-slate-700 px-2 py-1.5 text-xs text-white" @click="applySplitAmount">Prefill Share</button>
          </div>
          <p class="mt-1 text-[11px] text-slate-500">Each share: Rs {{ splitPerPersonRupees.toFixed(2) }}</p>
        </div>

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
