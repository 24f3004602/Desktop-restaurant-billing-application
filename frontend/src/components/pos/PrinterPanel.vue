<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { usePrinter } from "../../composables/usePrinter";
import { useBillingStore } from "../../stores/billing";
import { useOrdersStore } from "../../stores/orders";
import { useSettingsStore } from "../../stores/settings";
import { formatCurrencyFromCents } from "../../utils/currency";
import { formatReceiptTimestamp } from "../../utils/date";

const billing = useBillingStore();
const orders = useOrdersStore();
const settingsStore = useSettingsStore();

const { printers, loading, error, loadPrinters, printHtml, savePdf } = usePrinter();
const status = ref("");
const receiptBranding = computed(() => settingsStore.receipt);

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRupees(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

const canGenerateReceipt = computed(() => {
  return Boolean(billing.bill && orders.activeOrder && orders.activeOrder.items.length);
});

const paidTotalCents = computed(() => billing.payments.reduce((sum, payment) => sum + payment.amount_cents, 0));
const remainingCents = computed(() => {
  if (!billing.bill) {
    return 0;
  }
  return Math.max(0, billing.bill.grand_total_cents - paidTotalCents.value);
});

const receiptHtml = computed(() => {
  if (!canGenerateReceipt.value || !billing.bill || !orders.activeOrder) {
    return "";
  }

  const bill = billing.bill;
  const order = orders.activeOrder;
  const lineRows = order.items
    .map((item) => {
      return `<tr>
        <td>${escapeHtml(item.menu_item_name)}</td>
        <td style="text-align:center;">${escapeHtml(item.quantity)}</td>
        <td style="text-align:right;">Rs ${formatRupees(item.line_total_cents)}</td>
      </tr>`;
    })
    .join("");

  const paymentRows = billing.payments
    .map((payment) => {
      return `<tr>
        <td>${escapeHtml(payment.method.toUpperCase())}</td>
        <td style="text-align:right;">Rs ${formatRupees(payment.amount_cents)}</td>
        <td style="text-align:right;">${escapeHtml(payment.reference_no || "-")}</td>
      </tr>`;
    })
    .join("");

  const addressLine = receiptBranding.value.address ? `<p class="muted">${escapeHtml(receiptBranding.value.address)}</p>` : "";
  const phoneLine = receiptBranding.value.phone ? `<p class="muted">Phone: ${escapeHtml(receiptBranding.value.phone)}</p>` : "";
  const gstinLine = receiptBranding.value.gstin ? `<p class="muted">GSTIN: ${escapeHtml(receiptBranding.value.gstin)}</p>` : "";
  const footerLine = receiptBranding.value.footer ? `<p class="muted" style="margin-top:10px;">${escapeHtml(receiptBranding.value.footer)}</p>` : "";

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Receipt ${escapeHtml(bill.bill_no)}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 18px; color: #111827; }
        .title { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
        .muted { color: #6b7280; font-size: 12px; margin: 2px 0; }
        .section { margin-top: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 4px; text-align: left; }
        .totals { margin-top: 10px; font-size: 13px; }
        .totals p { display: flex; justify-content: space-between; margin: 4px 0; }
        .totals .grand { font-size: 15px; font-weight: 700; margin-top: 8px; }
      </style>
    </head>
    <body>
      <p class="title">${escapeHtml(receiptBranding.value.name)} Receipt</p>
      ${addressLine}
      ${phoneLine}
      ${gstinLine}
      <p class="muted">Bill No: ${escapeHtml(bill.bill_no)}</p>
      <p class="muted">Order No: ${escapeHtml(order.order_no)}</p>
      <p class="muted">Date: ${escapeHtml(formatReceiptTimestamp(new Date()))}</p>

      <div class="section">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows}
          </tbody>
        </table>
      </div>

      <div class="section">
        <table>
          <thead>
            <tr>
              <th>Payment Method</th>
              <th style="text-align:right;">Amount</th>
              <th style="text-align:right;">Reference</th>
            </tr>
          </thead>
          <tbody>
            ${paymentRows || '<tr><td colspan="3" style="text-align:center;">No payments added yet</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="totals">
        <p><span>Subtotal</span><span>Rs ${formatRupees(bill.subtotal_cents)}</span></p>
        <p><span>Tax</span><span>Rs ${formatRupees(bill.tax_cents)}</span></p>
        <p><span>Discount</span><span>Rs ${formatRupees(bill.discount_cents)}</span></p>
        <p class="grand"><span>Grand Total</span><span>Rs ${formatRupees(bill.grand_total_cents)}</span></p>
      </div>
      ${footerLine}
    </body>
  </html>`;
});

async function printReceipt() {
  if (!receiptHtml.value) {
    status.value = "Generate a bill with items before printing.";
    return;
  }

  status.value = "";
  try {
    await printHtml(receiptHtml.value);
    status.value = "Receipt sent to printer.";
  } catch (err) {
    status.value = err instanceof Error ? err.message : "Print failed";
  }
}

async function saveReceiptPdf() {
  if (!receiptHtml.value) {
    status.value = "Generate a bill with items before exporting PDF.";
    return;
  }

  status.value = "";
  try {
    const result = await savePdf(receiptHtml.value);
    if (result?.canceled) {
      status.value = "PDF save canceled.";
      return;
    }
    status.value = `PDF saved${result?.filePath ? `: ${result.filePath}` : "."}`;
  } catch (err) {
    status.value = err instanceof Error ? err.message : "PDF export failed";
  }
}

onMounted(async () => {
  await Promise.all([loadPrinters(), settingsStore.loadReceiptSettings()]);
});
</script>

<template>
  <section class="rounded-lg border bg-white p-3 shadow">
    <h3 class="mb-2 text-sm font-semibold">Receipt & Printer</h3>
    <p v-if="loading" class="text-xs text-slate-500">Loading printers...</p>
    <p v-else-if="error" class="text-xs text-amber-700">{{ error }}</p>
    <div v-else class="space-y-1 text-xs">
      <p v-for="printer in printers" :key="printer.name">{{ printer.displayName }}</p>
      <p v-if="printers.length === 0" class="text-slate-500">No printers found.</p>
    </div>

    <div class="mt-3 rounded border p-2">
      <p class="text-xs text-slate-600">Current Bill</p>
      <p class="text-sm font-medium">{{ billing.bill?.bill_no || "No bill generated" }}</p>
      <p class="text-xs text-slate-500">{{ orders.activeOrder?.order_no || "No active order" }}</p>
      <p class="text-xs text-slate-500">Paid: {{ formatCurrencyFromCents(paidTotalCents) }}</p>
      <p class="text-xs text-slate-500">Remaining: {{ formatCurrencyFromCents(remainingCents) }}</p>
    </div>

    <div class="mt-3">
      <p class="mb-1 text-xs text-slate-600">Receipt Preview</p>
      <iframe
        v-if="receiptHtml"
        class="h-48 w-full rounded border bg-white"
        :srcdoc="receiptHtml"
        title="Receipt preview"
      />
      <p v-else class="rounded border p-2 text-xs text-slate-500">Generate a bill and add items to preview the receipt.</p>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2">
      <button
        class="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        :disabled="!canGenerateReceipt"
        @click="printReceipt"
      >
        Print Receipt
      </button>
      <button
        class="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        :disabled="!canGenerateReceipt"
        @click="saveReceiptPdf"
      >
        Save PDF
      </button>
    </div>

    <p v-if="status" class="mt-2 text-xs text-slate-600">{{ status }}</p>
  </section>
</template>
