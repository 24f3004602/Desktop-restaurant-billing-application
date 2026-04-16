import { computed } from "vue";

import { useOrdersStore } from "../stores/orders";

export function useCart() {
  const orders = useOrdersStore();

  const totalCents = computed(() =>
    (orders.activeOrder?.items || []).reduce((sum, item) => sum + item.line_total_cents, 0)
  );

  async function increase(itemId: number, qty: number) {
    if (!orders.activeOrder) {
      return;
    }
    await orders.updateItem(orders.activeOrder.id, itemId, { quantity: qty + 1 });
  }

  async function decrease(itemId: number, qty: number) {
    if (!orders.activeOrder) {
      return;
    }
    const nextQty = qty - 1;
    if (nextQty <= 0) {
      await remove(itemId);
      return;
    }

    await orders.updateItem(orders.activeOrder.id, itemId, { quantity: nextQty });
  }

  async function remove(itemId: number) {
    if (!orders.activeOrder) {
      return;
    }
    await orders.removeItem(orders.activeOrder.id, itemId);
  }

  return {
    orders,
    totalCents,
    increase,
    decrease,
    remove,
  };
}
