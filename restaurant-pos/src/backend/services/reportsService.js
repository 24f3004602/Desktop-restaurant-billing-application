const { db } = require("../db");

function normalizedDate(inputDate) {
  const date = String(inputDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizedPeriod(inputPeriod) {
  const period = String(inputPeriod || "TODAY").trim().toUpperCase();
  if (["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS"].includes(period)) {
    return period;
  }
  return "TODAY";
}

function dateOffset(dateString, days) {
  const dt = new Date(`${dateString}T00:00:00`);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function percentChange(current, previous) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
}

function resolvePeriodRange(anchorDate, period) {
  switch (period) {
    case "YESTERDAY": {
      const day = dateOffset(anchorDate, -1);
      return { startDate: day, endDate: day, label: "Yesterday" };
    }
    case "LAST_7_DAYS":
      return { startDate: dateOffset(anchorDate, -6), endDate: anchorDate, label: "Last 7 Days" };
    case "LAST_30_DAYS":
      return { startDate: dateOffset(anchorDate, -29), endDate: anchorDate, label: "Last 30 Days" };
    case "TODAY":
    default:
      return { startDate: anchorDate, endDate: anchorDate, label: "Today" };
  }
}

function getRangeMetrics(startDate, endDate) {
  const orderTotalsCte = `
    WITH add_on_totals AS (
      SELECT order_item_id, COALESCE(SUM(price), 0) AS addOnTotal
      FROM OrderItemAddOns
      GROUP BY order_item_id
    ),
    item_subtotals AS (
      SELECT
        oi.order_id AS orderId,
        COALESCE(SUM((oi.unit_price + COALESCE(aot.addOnTotal, 0)) * oi.qty), 0) AS subtotal
      FROM OrderItems oi
      LEFT JOIN add_on_totals aot ON aot.order_item_id = oi.id
      GROUP BY oi.order_id
    ),
    order_totals AS (
      SELECT
        o.id,
        o.status,
        o.created_at AS createdAt,
        COALESCE(i.subtotal, 0) AS subtotal,
        COALESCE(i.subtotal, 0) - CASE
          WHEN o.discount_type = 'PERCENT' THEN MIN(COALESCE(i.subtotal, 0), COALESCE(i.subtotal, 0) * (o.discount_value / 100.0))
          WHEN o.discount_type = 'FIXED' THEN MIN(COALESCE(i.subtotal, 0), o.discount_value)
          ELSE 0
        END AS total
      FROM Orders o
      LEFT JOIN item_subtotals i ON i.orderId = o.id
      WHERE date(o.created_at) BETWEEN ? AND ?
    )
  `;

  const summary = db
    .prepare(
      `${orderTotalsCte}
      SELECT
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END), 0) AS revenue,
        COUNT(*) AS orders,
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paidOrders,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelledOrders
      FROM order_totals`
    )
    .get(startDate, endDate);

  return {
    revenue: Number(summary.revenue || 0),
    orders: Number(summary.orders || 0),
    paidOrders: Number(summary.paidOrders || 0),
    cancelledOrders: Number(summary.cancelledOrders || 0)
  };
}

function getDailySeries(startDate, endDate) {
  const orderTotalsCte = `
    WITH add_on_totals AS (
      SELECT order_item_id, COALESCE(SUM(price), 0) AS addOnTotal
      FROM OrderItemAddOns
      GROUP BY order_item_id
    ),
    item_subtotals AS (
      SELECT
        oi.order_id AS orderId,
        COALESCE(SUM((oi.unit_price + COALESCE(aot.addOnTotal, 0)) * oi.qty), 0) AS subtotal
      FROM OrderItems oi
      LEFT JOIN add_on_totals aot ON aot.order_item_id = oi.id
      GROUP BY oi.order_id
    ),
    order_totals AS (
      SELECT
        o.id,
        o.status,
        date(o.created_at) AS day,
        COALESCE(i.subtotal, 0) - CASE
          WHEN o.discount_type = 'PERCENT' THEN MIN(COALESCE(i.subtotal, 0), COALESCE(i.subtotal, 0) * (o.discount_value / 100.0))
          WHEN o.discount_type = 'FIXED' THEN MIN(COALESCE(i.subtotal, 0), o.discount_value)
          ELSE 0
        END AS total
      FROM Orders o
      LEFT JOIN item_subtotals i ON i.orderId = o.id
      WHERE date(o.created_at) BETWEEN ? AND ?
    )
  `;

  const raw = db
    .prepare(
      `${orderTotalsCte}
      SELECT
        day,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END), 0) AS revenue,
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS orderCount
      FROM order_totals
      GROUP BY day
      ORDER BY day`
    )
    .all(startDate, endDate);

  const map = new Map(raw.map((row) => [row.day, { revenue: Number(row.revenue || 0), orderCount: Number(row.orderCount || 0) }]));

  const series = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    const point = map.get(cursor) || { revenue: 0, orderCount: 0 };
    series.push({ day: cursor, revenue: point.revenue, orderCount: point.orderCount });
    cursor = dateOffset(cursor, 1);
  }

  return series;
}

function getDashboard({ date, period }) {
  const selectedDate = normalizedDate(date);
  const selectedPeriod = normalizedPeriod(period);
  const { startDate: reportStartDate, endDate: reportEndDate, label: periodLabel } = resolvePeriodRange(selectedDate, selectedPeriod);
  const last7Start = dateOffset(selectedDate, -6);
  const prev7Start = dateOffset(selectedDate, -13);
  const prev7End = dateOffset(selectedDate, -7);
  const last30Start = dateOffset(selectedDate, -29);
  const prev30Start = dateOffset(selectedDate, -59);
  const prev30End = dateOffset(selectedDate, -30);

  const orderTotalsCte = `
    WITH add_on_totals AS (
      SELECT order_item_id, COALESCE(SUM(price), 0) AS addOnTotal
      FROM OrderItemAddOns
      GROUP BY order_item_id
    ),
    item_subtotals AS (
      SELECT
        oi.order_id AS orderId,
        COALESCE(SUM((oi.unit_price + COALESCE(aot.addOnTotal, 0)) * oi.qty), 0) AS subtotal
      FROM OrderItems oi
      LEFT JOIN add_on_totals aot ON aot.order_item_id = oi.id
      GROUP BY oi.order_id
    ),
    order_totals AS (
      SELECT
        o.id,
        o.order_no AS orderNo,
        o.order_type AS orderType,
        o.status,
        o.created_at AS createdAt,
        COALESCE(i.subtotal, 0) AS subtotal,
        CASE
          WHEN o.discount_type = 'PERCENT' THEN MIN(COALESCE(i.subtotal, 0), COALESCE(i.subtotal, 0) * (o.discount_value / 100.0))
          WHEN o.discount_type = 'FIXED' THEN MIN(COALESCE(i.subtotal, 0), o.discount_value)
          ELSE 0
        END AS discount,
        COALESCE(i.subtotal, 0) - CASE
          WHEN o.discount_type = 'PERCENT' THEN MIN(COALESCE(i.subtotal, 0), COALESCE(i.subtotal, 0) * (o.discount_value / 100.0))
          WHEN o.discount_type = 'FIXED' THEN MIN(COALESCE(i.subtotal, 0), o.discount_value)
          ELSE 0
        END AS total
      FROM Orders o
      LEFT JOIN item_subtotals i ON i.orderId = o.id
      WHERE date(o.created_at) BETWEEN ? AND ?
    )
  `;

  const kpi = db
    .prepare(
      `${orderTotalsCte}
      SELECT
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END), 0) AS totalRevenue,
        COUNT(*) AS totalOrders,
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paidOrders,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelledOrders
      FROM order_totals`
    )
    .get(reportStartDate, reportEndDate);

  const dailySalesSummary = db
    .prepare(
      `${orderTotalsCte}
      SELECT
        ot.orderNo,
        ot.orderType,
        ot.status,
        ot.total,
        ot.createdAt,
        GROUP_CONCAT(mi.name || ' x' || oi.qty, ', ') AS itemLines
      FROM order_totals ot
      LEFT JOIN OrderItems oi ON oi.order_id = ot.id
      LEFT JOIN MenuItems mi ON mi.id = oi.menu_item_id
      GROUP BY ot.id, ot.orderNo, ot.orderType, ot.status, ot.total, ot.createdAt
      ORDER BY ot.createdAt DESC`
    )
    .all(reportStartDate, reportEndDate);

  const itemSales = db
    .prepare(
      `
      SELECT
        mi.id,
        mi.name,
        COALESCE(SUM(oi.qty), 0) AS qtySold,
        COALESCE(SUM((oi.unit_price + COALESCE(aot.addOnTotal, 0)) * oi.qty), 0) AS grossSales
      FROM OrderItems oi
      INNER JOIN Orders o ON o.id = oi.order_id
      INNER JOIN MenuItems mi ON mi.id = oi.menu_item_id
      LEFT JOIN (
        SELECT order_item_id, COALESCE(SUM(price), 0) AS addOnTotal
        FROM OrderItemAddOns
        GROUP BY order_item_id
      ) aot ON aot.order_item_id = oi.id
      WHERE date(o.created_at) BETWEEN ? AND ?
        AND o.status = 'PAID'
      GROUP BY mi.id, mi.name
      ORDER BY qtySold DESC, grossSales DESC
      `
    )
    .all(reportStartDate, reportEndDate);

  const topSellingItems = itemSales.slice(0, 5);
  const leastSellingItems = [...itemSales].sort((a, b) => a.qtySold - b.qtySold).slice(0, 5);

  const paymentBreakdown = db
    .prepare(
      `
      SELECT
        p.method,
        COALESCE(SUM(p.amount), 0) AS totalAmount,
        COUNT(*) AS paymentCount
      FROM Payments p
      INNER JOIN Orders o ON o.id = p.order_id
      WHERE date(o.created_at) BETWEEN ? AND ?
      GROUP BY p.method
      ORDER BY totalAmount DESC
      `
    )
    .all(reportStartDate, reportEndDate);

  const hourlySales = db
    .prepare(
      `${orderTotalsCte}
      SELECT
        strftime('%H', createdAt) AS hour,
        COALESCE(SUM(total), 0) AS revenue,
        COUNT(*) AS orderCount
      FROM order_totals
      WHERE status = 'PAID'
      GROUP BY strftime('%H', createdAt)
      ORDER BY hour`
    )
    .all(reportStartDate, reportEndDate);

  const categoryRevenue = db
    .prepare(
      `
      SELECT
        c.id,
        c.name,
        COALESCE(SUM((oi.unit_price + COALESCE(aot.addOnTotal, 0)) * oi.qty), 0) AS revenue,
        COALESCE(SUM(oi.qty), 0) AS qtySold
      FROM OrderItems oi
      INNER JOIN Orders o ON o.id = oi.order_id
      INNER JOIN MenuItems mi ON mi.id = oi.menu_item_id
      INNER JOIN Categories c ON c.id = mi.category_id
      LEFT JOIN (
        SELECT order_item_id, COALESCE(SUM(price), 0) AS addOnTotal
        FROM OrderItemAddOns
        GROUP BY order_item_id
      ) aot ON aot.order_item_id = oi.id
      WHERE date(o.created_at) BETWEEN ? AND ?
        AND o.status = 'PAID'
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
      `
    )
    .all(reportStartDate, reportEndDate);

  const cancelledOrders = db
    .prepare(
      `${orderTotalsCte}
      SELECT
        orderNo,
        orderType,
        status,
        total,
        createdAt
      FROM order_totals
      WHERE status = 'CANCELLED'
      ORDER BY createdAt DESC`
    )
    .all(reportStartDate, reportEndDate);

  const last7Metrics = getRangeMetrics(last7Start, selectedDate);
  const previous7Metrics = getRangeMetrics(prev7Start, prev7End);
  const last30Metrics = getRangeMetrics(last30Start, selectedDate);
  const previous30Metrics = getRangeMetrics(prev30Start, prev30End);
  const dailyTrend30 = getDailySeries(last30Start, selectedDate);

  return {
    date: selectedDate,
    period: selectedPeriod,
    periodLabel,
    range: {
      startDate: reportStartDate,
      endDate: reportEndDate
    },
    kpi: {
      totalRevenue: Number(kpi.totalRevenue || 0),
      totalOrders: Number(kpi.totalOrders || 0),
      paidOrders: Number(kpi.paidOrders || 0),
      cancelledOrders: Number(kpi.cancelledOrders || 0)
    },
    dailySalesSummary,
    topSellingItems,
    leastSellingItems,
    paymentBreakdown,
    hourlySales,
    categoryRevenue,
    cancelledOrders,
    comparativeTrends: {
      last7Days: last7Metrics,
      previous7Days: previous7Metrics,
      last30Days: last30Metrics,
      previous30Days: previous30Metrics,
      revenueChange7dPct: percentChange(last7Metrics.revenue, previous7Metrics.revenue),
      revenueChange30dPct: percentChange(last30Metrics.revenue, previous30Metrics.revenue),
      orderChange7dPct: percentChange(last7Metrics.orders, previous7Metrics.orders),
      orderChange30dPct: percentChange(last30Metrics.orders, previous30Metrics.orders)
    },
    dailyTrend30
  };
}

module.exports = {
  getDashboard
};
