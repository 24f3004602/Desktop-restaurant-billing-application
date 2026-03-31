const ORDER_STATUS = {
  DRAFT: "DRAFT",
  PREPARING: "PREPARING",
  SERVED: "SERVED",
  PAID: "PAID",
  CANCELLED: "CANCELLED"
};

const ORDER_TYPE = {
  DINE_IN: "DINE_IN",
  TAKEAWAY: "TAKEAWAY"
};

const PAYMENT_METHOD = {
  CASH: "CASH",
  UPI: "UPI",
  CARD: "CARD"
};

const allowedTransitions = {
  [ORDER_STATUS.DRAFT]: [ORDER_STATUS.PREPARING, ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.SERVED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SERVED]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [],
  [ORDER_STATUS.CANCELLED]: []
};

function assertOrderTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return;
  }

  const allowed = allowedTransitions[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error(`Invalid order transition: ${fromStatus} -> ${toStatus}`);
  }
}

module.exports = {
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  assertOrderTransition
};
