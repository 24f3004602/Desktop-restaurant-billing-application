import { computed } from "vue";

import { useOrdersStore } from "../stores/orders";

export function useOrderStatus() {
  const orders = useOrdersStore();

  const activeOrderNo = computed(() => orders.activeOrder?.order_no || "-");
  const activeOrderStatus = computed(() => orders.activeOrder?.status || "idle");
  const hasActiveOrder = computed(() => Boolean(orders.activeOrder));

  return {
    activeOrderNo,
    activeOrderStatus,
    hasActiveOrder,
  };
}
