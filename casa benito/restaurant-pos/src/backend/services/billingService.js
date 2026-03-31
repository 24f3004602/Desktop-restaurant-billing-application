const { db } = require("../db");
const { CartModel } = require("../models/cartModel");
const { ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD, assertOrderTransition } = require("../models/orderLifecycle");

function assertValidOrderType(orderType) {
  if (!Object.values(ORDER_TYPE).includes(orderType)) {
    throw new Error("Invalid order type");
  }
}

function assertValidPaymentMethod(method) {
  if (!Object.values(PAYMENT_METHOD).includes(method)) {
    throw new Error("Invalid payment method");
  }
}

function buildOrderNo(orderId) {
  const date = new Date();
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `ORD-${y}${m}${d}-${String(orderId).padStart(5, "0")}`;
}

function getMenuSnapshot() {
  const categories = db.prepare("SELECT id, name FROM Categories WHERE is_active = 1 ORDER BY name").all();
  const items = db
    .prepare(
      `
      SELECT
        m.id,
        m.category_id AS categoryId,
        m.name,
        m.is_available AS isAvailable
      FROM MenuItems m
      WHERE m.is_available = 1
      ORDER BY m.name
      `
    )
    .all();

  const variants = db
    .prepare(
      `
      SELECT
        v.id,
        v.menu_item_id AS menuItemId,
        v.name,
        v.price,
        v.is_default AS isDefault
      FROM Variants v
      ORDER BY v.menu_item_id, v.price
      `
    )
    .all();

  const addOns = db
    .prepare(
      `
      SELECT
        ia.menu_item_id AS menuItemId,
        a.id,
        a.name,
        a.price
      FROM ItemAddOns ia
      INNER JOIN AddOns a ON a.id = ia.add_on_id
      WHERE a.is_active = 1
      ORDER BY a.name
      `
    )
    .all();

  const variantsByItem = new Map();
  variants.forEach((variant) => {
    const current = variantsByItem.get(variant.menuItemId) || [];
    current.push(variant);
    variantsByItem.set(variant.menuItemId, current);
  });

  const addOnsByItem = new Map();
  addOns.forEach((entry) => {
    const current = addOnsByItem.get(entry.menuItemId) || [];
    current.push({ id: entry.id, name: entry.name, price: entry.price });
    addOnsByItem.set(entry.menuItemId, current);
  });

  const menuItems = items.map((item) => ({
    ...item,
    variants: variantsByItem.get(item.id) || [],
    addOns: addOnsByItem.get(item.id) || []
  }));

  return {
    categories,
    menuItems
  };
}

function getActiveTables() {
  return db
    .prepare(
      `
      SELECT
        id,
        table_code AS tableCode,
        display_name AS displayName,
        capacity,
        is_active AS isActive
      FROM RestaurantTables
      WHERE is_active = 1
      ORDER BY id
      `
    )
    .all();
}

function createOrder({ orderType, tableRef = null, notes = null }) {
  assertValidOrderType(orderType);

  const now = new Date().toISOString();
  const createStmt = db.prepare(
    `
      INSERT INTO Orders(order_no, order_type, table_ref, status, notes, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?)
    `
  );

  const trx = db.transaction(() => {
    const tempOrderNo = `TMP-${Date.now()}`;
    const result = createStmt.run(tempOrderNo, orderType, tableRef, ORDER_STATUS.DRAFT, notes, now, now);
    const orderId = Number(result.lastInsertRowid);
    const orderNo = buildOrderNo(orderId);
    db.prepare("UPDATE Orders SET order_no = ? WHERE id = ?").run(orderNo, orderId);
    return orderId;
  });

  const orderId = trx();
  return getOrder(orderId);
}

function getOrder(orderId) {
  const order = db.prepare("SELECT * FROM Orders WHERE id = ?").get(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const rows = db
    .prepare(
      `
      SELECT
        oi.id AS orderItemId,
        oi.menu_item_id AS menuItemId,
        mi.name AS itemName,
        oi.variant_id AS variantId,
        v.name AS variantName,
        oi.qty,
        oi.unit_price AS unitPrice
      FROM OrderItems oi
      INNER JOIN MenuItems mi ON mi.id = oi.menu_item_id
      INNER JOIN Variants v ON v.id = oi.variant_id
      WHERE oi.order_id = ?
      ORDER BY oi.id DESC
      `
    )
    .all(orderId);

  const addOnRows = db
    .prepare(
      `
      SELECT
        oia.order_item_id AS orderItemId,
        a.id AS addOnId,
        a.name,
        oia.price
      FROM OrderItemAddOns oia
      INNER JOIN AddOns a ON a.id = oia.add_on_id
      INNER JOIN OrderItems oi ON oi.id = oia.order_item_id
      WHERE oi.order_id = ?
      ORDER BY oia.id
      `
    )
    .all(orderId);

  const addOnMap = new Map();
  addOnRows.forEach((entry) => {
    const current = addOnMap.get(entry.orderItemId) || [];
    current.push({ addOnId: entry.addOnId, name: entry.name, price: entry.price });
    addOnMap.set(entry.orderItemId, current);
  });

  const cart = new CartModel(order);
  rows.forEach((row) => {
    cart.addLine({
      ...row,
      addOns: addOnMap.get(row.orderItemId) || []
    });
  });

  const payments = db
    .prepare(
      `
      SELECT id, method, amount, reference_no AS referenceNo, created_at AS createdAt
      FROM Payments
      WHERE order_id = ?
      ORDER BY id
      `
    )
    .all(orderId);

  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  return {
    id: order.id,
    orderNo: order.order_no,
    orderType: order.order_type,
    tableRef: order.table_ref,
    status: order.status,
    notes: order.notes,
    discountType: order.discount_type,
    discountValue: Number(order.discount_value),
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    paidAt: order.paid_at,
    items: cart.lines.map((line) => ({
      orderItemId: line.orderItemId,
      menuItemId: line.menuItemId,
      variantId: line.variantId,
      itemName: line.itemName,
      variantName: line.variantName,
      qty: line.qty,
      unitPrice: line.unitPrice,
      addOns: line.addOns,
      addOnUnitTotal: line.addOnUnitTotal,
      lineTotal: line.lineTotal
    })),
    payments,
    totals: {
      subtotal: cart.subtotal,
      discount: cart.discountAmount,
      total: cart.total,
      paid: paidAmount,
      balance: Math.max(cart.total - paidAmount, 0)
    }
  };
}

function getActiveOrder({ orderType, tableRef }) {
  assertValidOrderType(orderType);

  const row = db
    .prepare(
      `
      SELECT id
      FROM Orders
      WHERE order_type = ?
        AND COALESCE(table_ref, '') = COALESCE(?, '')
        AND status IN ('DRAFT', 'PREPARING', 'SERVED')
      ORDER BY id DESC
      LIMIT 1
      `
    )
    .get(orderType, tableRef || null);

  if (!row) {
    return null;
  }

  return getOrder(row.id);
}

function addItem({ orderId, variantId, qty = 1, addOnIds = [] }) {
  const order = db.prepare("SELECT id, status FROM Orders WHERE id = ?").get(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  if ([ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED].includes(order.status)) {
    throw new Error("Cannot modify a paid/cancelled order");
  }

  const variant = db
    .prepare(
      `
      SELECT
        v.id,
        v.menu_item_id AS menuItemId,
        v.price
      FROM Variants v
      INNER JOIN MenuItems m ON m.id = v.menu_item_id
      WHERE v.id = ? AND m.is_available = 1
      `
    )
    .get(variantId);

  if (!variant) {
    throw new Error("Variant not found or unavailable");
  }

  const uniqueAddOnIds = [...new Set(addOnIds.map(Number))];
  const validAddOns = uniqueAddOnIds.length
    ? db
        .prepare(
          `
          SELECT a.id, a.price
          FROM AddOns a
          INNER JOIN ItemAddOns ia ON ia.add_on_id = a.id
          WHERE ia.menu_item_id = ?
            AND a.id IN (${uniqueAddOnIds.map(() => "?").join(",")})
            AND a.is_active = 1
          `
        )
        .all(variant.menuItemId, ...uniqueAddOnIds)
    : [];

  if (validAddOns.length !== uniqueAddOnIds.length) {
    throw new Error("Invalid add-on selection");
  }

  const addOnSignature = uniqueAddOnIds.slice().sort((a, b) => a - b).join(",");
  const existingItems = db
    .prepare(
      `
      SELECT id
      FROM OrderItems
      WHERE order_id = ?
        AND variant_id = ?
      ORDER BY id
      `
    )
    .all(orderId, variantId);

  let matchedOrderItemId = null;

  for (const row of existingItems) {
    const addOns = db
      .prepare("SELECT add_on_id AS addOnId FROM OrderItemAddOns WHERE order_item_id = ? ORDER BY add_on_id")
      .all(row.id)
      .map((entry) => entry.addOnId)
      .join(",");

    if (addOns === addOnSignature) {
      matchedOrderItemId = row.id;
      break;
    }
  }

  const trx = db.transaction(() => {
    if (matchedOrderItemId) {
      db.prepare("UPDATE OrderItems SET qty = qty + ? WHERE id = ?").run(Math.max(1, Number(qty)), matchedOrderItemId);
    } else {
      const insertItem = db.prepare(
        `
        INSERT INTO OrderItems(order_id, menu_item_id, variant_id, qty, unit_price)
        VALUES(?, ?, ?, ?, ?)
        `
      );
      const itemResult = insertItem.run(orderId, variant.menuItemId, variant.id, Math.max(1, Number(qty)), variant.price);
      matchedOrderItemId = Number(itemResult.lastInsertRowid);

      const insertAddOn = db.prepare(
        "INSERT INTO OrderItemAddOns(order_item_id, add_on_id, price) VALUES(?, ?, ?)"
      );
      validAddOns.forEach((addOn) => {
        insertAddOn.run(matchedOrderItemId, addOn.id, addOn.price);
      });
    }

    db.prepare("UPDATE Orders SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), orderId);
  });

  trx();
  return getOrder(orderId);
}

function updateItemQuantity({ orderId, orderItemId, qty }) {
  const order = db.prepare("SELECT status FROM Orders WHERE id = ?").get(orderId);
  if (!order) throw new Error("Order not found");
  if ([ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED].includes(order.status)) {
    throw new Error("Cannot modify a paid/cancelled order");
  }

  const nextQty = Number(qty);
  if (!Number.isInteger(nextQty) || nextQty <= 0) {
    throw new Error("Quantity must be a positive integer");
  }

  const updated = db
    .prepare("UPDATE OrderItems SET qty = ? WHERE id = ? AND order_id = ?")
    .run(nextQty, orderItemId, orderId);

  if (updated.changes === 0) {
    throw new Error("Order item not found");
  }

  db.prepare("UPDATE Orders SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), orderId);

  return getOrder(orderId);
}

function removeItem({ orderId, orderItemId }) {
  const order = db.prepare("SELECT status FROM Orders WHERE id = ?").get(orderId);
  if (!order) throw new Error("Order not found");
  if ([ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED].includes(order.status)) {
    throw new Error("Cannot modify a paid/cancelled order");
  }

  const deleted = db.prepare("DELETE FROM OrderItems WHERE id = ? AND order_id = ?").run(orderItemId, orderId);
  if (deleted.changes === 0) {
    throw new Error("Order item not found");
  }

  db.prepare("UPDATE Orders SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), orderId);

  return getOrder(orderId);
}

function applyDiscount({ orderId, discountType, discountValue }) {
  const order = db.prepare("SELECT status FROM Orders WHERE id = ?").get(orderId);
  if (!order) throw new Error("Order not found");
  if ([ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED].includes(order.status)) {
    throw new Error("Cannot apply discount on paid/cancelled order");
  }

  const type = ["NONE", "PERCENT", "FIXED"].includes(discountType) ? discountType : "NONE";
  const value = Math.max(0, Number(discountValue || 0));

  db.prepare("UPDATE Orders SET discount_type = ?, discount_value = ?, updated_at = ? WHERE id = ?").run(
    type,
    type === "NONE" ? 0 : value,
    new Date().toISOString(),
    orderId
  );

  return getOrder(orderId);
}

function getOrderPaidAmount(orderId) {
  const row = db.prepare("SELECT COALESCE(SUM(amount), 0) AS totalPaid FROM Payments WHERE order_id = ?").get(orderId);
  return Number(row.totalPaid);
}

function addPayment({ orderId, method, amount, referenceNo = null }) {
  assertValidPaymentMethod(method);
  const order = getOrder(orderId);

  if (order.status === ORDER_STATUS.CANCELLED) {
    throw new Error("Cannot add payment to cancelled order");
  }

  const numericAmount = Number(amount);
  if (numericAmount <= 0) {
    throw new Error("Payment amount must be greater than 0");
  }

  db.prepare("INSERT INTO Payments(order_id, method, amount, reference_no) VALUES(?, ?, ?, ?)").run(
    orderId,
    method,
    numericAmount,
    referenceNo
  );

  return getOrder(orderId);
}

function updateOrderStatus({ orderId, nextStatus, reason = null }) {
  const order = db.prepare("SELECT * FROM Orders WHERE id = ?").get(orderId);
  if (!order) throw new Error("Order not found");

  assertOrderTransition(order.status, nextStatus);

  if (nextStatus === ORDER_STATUS.PAID) {
    const orderView = getOrder(orderId);
    const paidAmount = getOrderPaidAmount(orderId);
    if (paidAmount < orderView.totals.total) {
      throw new Error("Insufficient payment. Complete payment before marking as PAID.");
    }
  }

  const nowIso = new Date().toISOString();
  db.prepare(
    `
      UPDATE Orders
      SET status = ?,
          cancelled_reason = ?,
          updated_at = ?,
          paid_at = CASE WHEN ? = 'PAID' THEN ? ELSE paid_at END
      WHERE id = ?
    `
  ).run(nextStatus, reason, nowIso, nextStatus, nowIso, orderId);

  return getOrder(orderId);
}

function mergeTableOrders({ tableRef }) {
  if (!tableRef) {
    throw new Error("tableRef is required for merge");
  }

  const activeOrders = db
    .prepare(
      `
      SELECT id, status
      FROM Orders
      WHERE table_ref = ?
        AND status IN ('DRAFT', 'PREPARING', 'SERVED')
      ORDER BY id
      `
    )
    .all(tableRef);

  if (activeOrders.length <= 1) {
    return activeOrders.length === 1 ? getOrder(activeOrders[0].id) : null;
  }

  const targetOrderId = activeOrders[0].id;
  const sourceOrderIds = activeOrders.slice(1).map((entry) => entry.id);

  const trx = db.transaction(() => {
    sourceOrderIds.forEach((sourceOrderId) => {
      const rows = db
        .prepare(
          `
          SELECT id, menu_item_id AS menuItemId, variant_id AS variantId, qty, unit_price AS unitPrice
          FROM OrderItems
          WHERE order_id = ?
          `
        )
        .all(sourceOrderId);

      rows.forEach((row) => {
        const newItem = db
          .prepare(
            `
            INSERT INTO OrderItems(order_id, menu_item_id, variant_id, qty, unit_price)
            VALUES(?, ?, ?, ?, ?)
            `
          )
          .run(targetOrderId, row.menuItemId, row.variantId, row.qty, row.unitPrice);

        const addOns = db
          .prepare("SELECT add_on_id AS addOnId, price FROM OrderItemAddOns WHERE order_item_id = ?")
          .all(row.id);

        const addOnInsert = db.prepare(
          "INSERT INTO OrderItemAddOns(order_item_id, add_on_id, price) VALUES(?, ?, ?)"
        );
        addOns.forEach((entry) => addOnInsert.run(newItem.lastInsertRowid, entry.addOnId, entry.price));
      });

      const payments = db
        .prepare("SELECT method, amount, reference_no AS referenceNo FROM Payments WHERE order_id = ?")
        .all(sourceOrderId);

      const paymentInsert = db.prepare(
        "INSERT INTO Payments(order_id, method, amount, reference_no) VALUES(?, ?, ?, ?)"
      );

      payments.forEach((payment) => {
        paymentInsert.run(targetOrderId, payment.method, payment.amount, payment.referenceNo);
      });

      db.prepare("DELETE FROM OrderItems WHERE order_id = ?").run(sourceOrderId);
      db.prepare("DELETE FROM Payments WHERE order_id = ?").run(sourceOrderId);
      db.prepare("UPDATE Orders SET status = 'CANCELLED', cancelled_reason = ?, updated_at = ? WHERE id = ?").run(
        `Merged into order #${targetOrderId}`,
        new Date().toISOString(),
        sourceOrderId
      );
    });

    db.prepare("UPDATE Orders SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), targetOrderId);
  });

  trx();
  return getOrder(targetOrderId);
}

module.exports = {
  getMenuSnapshot,
  getActiveTables,
  createOrder,
  getOrder,
  getActiveOrder,
  addItem,
  updateItemQuantity,
  removeItem,
  applyDiscount,
  addPayment,
  updateOrderStatus,
  mergeTableOrders,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD
};
