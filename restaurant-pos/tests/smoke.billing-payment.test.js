const path = require("path");
const fs = require("fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const tmpDir = path.join(__dirname, ".tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

process.env.POS_DB_PATH = path.join(tmpDir, `pos-smoke-${Date.now()}.db`);

const { initializeDatabase } = require("../src/backend/db");
const billingService = require("../src/backend/services/billingService");

initializeDatabase();

function createOrderWithOneItem(orderType, tableRef = null) {
  const menu = billingService.getMenuSnapshot();
  const firstItem = menu.menuItems[0];
  assert.ok(firstItem, "Expected at least one seeded menu item");
  assert.ok(firstItem.variants.length > 0, "Expected at least one variant");

  const order = billingService.createOrder({ orderType, tableRef });
  const added = billingService.addItem({
    orderId: order.id,
    variantId: firstItem.variants[0].id,
    qty: 1,
    addOnIds: []
  });

  return added;
}

test("smoke: billing lifecycle transition guards", () => {
  const order = createOrderWithOneItem("DINE_IN", "T1");

  const preparing = billingService.updateOrderStatus({ orderId: order.id, nextStatus: "PREPARING" });
  assert.equal(preparing.status, "PREPARING");

  const served = billingService.updateOrderStatus({ orderId: order.id, nextStatus: "SERVED" });
  assert.equal(served.status, "SERVED");

  assert.throws(
    () => billingService.updateOrderStatus({ orderId: order.id, nextStatus: "DRAFT" }),
    /Invalid order transition/
  );

  const cancelled = billingService.updateOrderStatus({
    orderId: order.id,
    nextStatus: "CANCELLED",
    reason: "Smoke test cancellation"
  });
  assert.equal(cancelled.status, "CANCELLED");
});

test("smoke: split payment and paid validation", () => {
  const order = createOrderWithOneItem("TAKEAWAY", null);
  const total = Number(order.totals.total);
  assert.ok(total > 0, "Order total should be positive");

  const firstPaymentAmount = Number((total * 0.6).toFixed(2));
  const withFirstPayment = billingService.addPayment({
    orderId: order.id,
    method: "CASH",
    amount: firstPaymentAmount,
    referenceNo: null
  });

  assert.ok(Number(withFirstPayment.totals.balance) > 0, "Balance should remain after partial payment");

  assert.throws(
    () => billingService.updateOrderStatus({ orderId: order.id, nextStatus: "PAID" }),
    /Insufficient payment/
  );

  const remaining = Number(withFirstPayment.totals.balance);
  const withSecondPayment = billingService.addPayment({
    orderId: order.id,
    method: "UPI",
    amount: remaining,
    referenceNo: "UPI-SMOKE-001"
  });

  assert.equal(Number(withSecondPayment.totals.balance).toFixed(2), "0.00");

  const paid = billingService.updateOrderStatus({ orderId: order.id, nextStatus: "PAID" });
  assert.equal(paid.status, "PAID");
  assert.ok(paid.paidAt, "paidAt timestamp should be set after payment");
});
