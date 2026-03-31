function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInr(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function renderReceipt80mm(order, options = {}) {
  const cutterFeedLines = Math.max(0, Math.min(20, Number(options.cutterFeedLines ?? 4)));
  const feedMarkup = Array.from({ length: cutterFeedLines }, () => "<div>&nbsp;</div>").join("");
  const lines = order.items
    .map((item) => {
      const addOnsMarkup = item.addOns
        .map((addOn) => `<div class="addon">+ ${escapeHtml(addOn.name)} ${formatInr(addOn.price)}</div>`)
        .join("");

      return `
        <div class="line">
          <div class="row">
            <div class="name">${escapeHtml(item.itemName)} (${escapeHtml(item.variantName)}) x${item.qty}</div>
            <div class="price">${formatInr(item.lineTotal)}</div>
          </div>
          ${addOnsMarkup}
        </div>
      `;
    })
    .join("");

  const payments = order.payments
    .map((payment) => `<div class="row"><span>${escapeHtml(payment.method)}</span><span>${formatInr(payment.amount)}</span></div>`)
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            width: 76mm;
            margin: 0 auto;
            padding: 3mm 2mm;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: #111;
          }
          .center { text-align: center; }
          .title { font-size: 14px; font-weight: 700; }
          .divider { border-top: 1px dashed #111; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; gap: 10px; }
          .line { margin-bottom: 4px; }
          .name { flex: 1; }
          .price { min-width: 70px; text-align: right; }
          .addon { margin-left: 6px; color: #444; }
          .strong { font-weight: 700; }
          .muted { color: #555; }
        </style>
      </head>
      <body>
        <div class="center title">Casa Benito</div>
        <div class="center">Restaurant Bill</div>
        <div class="divider"></div>

        <div class="row"><span>Order</span><span>${escapeHtml(order.orderNo)}</span></div>
        <div class="row"><span>Type</span><span>${escapeHtml(order.orderType)}</span></div>
        <div class="row"><span>Table</span><span>${escapeHtml(order.tableRef || "-")}</span></div>
        <div class="row"><span>Status</span><span>${escapeHtml(order.status)}</span></div>
        <div class="row"><span>Time</span><span>${escapeHtml(order.updatedAt || order.createdAt || "")}</span></div>

        <div class="divider"></div>
        ${lines}
        <div class="divider"></div>

        <div class="row"><span>Subtotal</span><span>${formatInr(order.totals.subtotal)}</span></div>
        <div class="row"><span>Discount</span><span>${formatInr(order.totals.discount)}</span></div>
        <div class="row strong"><span>Total</span><span>${formatInr(order.totals.total)}</span></div>

        <div class="divider"></div>
        <div class="strong">Payments</div>
        ${payments || "<div class='muted'>No payment yet</div>"}
        <div class="row strong"><span>Paid</span><span>${formatInr(order.totals.paid)}</span></div>
        <div class="row strong"><span>Balance</span><span>${formatInr(order.totals.balance)}</span></div>

        <div class="divider"></div>
        <div class="center">Thank you. Visit again.</div>
        ${feedMarkup}
      </body>
    </html>
  `;
}

function buildSampleTicket() {
  return {
    orderNo: "TEST-RECEIPT-001",
    orderType: "DINE_IN",
    tableRef: "T99",
    status: "PAID",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        itemName: "Sample Coffee",
        variantName: "Regular",
        qty: 1,
        lineTotal: 120,
        addOns: [{ name: "Extra Shot", price: 30 }]
      },
      {
        itemName: "Sample Sandwich",
        variantName: "Large",
        qty: 2,
        lineTotal: 360,
        addOns: []
      }
    ],
    payments: [{ method: "CASH", amount: 480 }],
    totals: {
      subtotal: 510,
      discount: 30,
      total: 480,
      paid: 480,
      balance: 0
    }
  };
}

module.exports = {
  renderReceipt80mm,
  buildSampleTicket
};
