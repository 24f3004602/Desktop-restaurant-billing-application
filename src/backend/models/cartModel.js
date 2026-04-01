class CartAddOn {
  constructor({ addOnId, name, price }) {
    this.addOnId = addOnId;
    this.name = name;
    this.price = Number(price);
  }
}

class CartLine {
  constructor({ orderItemId, menuItemId, variantId, itemName, variantName, qty, unitPrice, addOns = [] }) {
    this.orderItemId = orderItemId;
    this.menuItemId = menuItemId;
    this.variantId = variantId;
    this.itemName = itemName;
    this.variantName = variantName;
    this.qty = Number(qty);
    this.unitPrice = Number(unitPrice);
    this.addOns = addOns.map((entry) => new CartAddOn(entry));
  }

  get addOnUnitTotal() {
    return this.addOns.reduce((sum, addOn) => sum + addOn.price, 0);
  }

  get lineTotal() {
    return (this.unitPrice + this.addOnUnitTotal) * this.qty;
  }
}

class CartModel {
  constructor(order) {
    this.orderId = order.id;
    this.status = order.status;
    this.discountType = order.discount_type || "NONE";
    this.discountValue = Number(order.discount_value || 0);
    this.lines = [];
  }

  addLine(line) {
    this.lines.push(new CartLine(line));
  }

  get subtotal() {
    return this.lines.reduce((sum, line) => sum + line.lineTotal, 0);
  }

  get discountAmount() {
    if (this.discountType === "PERCENT") {
      return Math.min(this.subtotal, this.subtotal * (this.discountValue / 100));
    }

    if (this.discountType === "FIXED") {
      return Math.min(this.subtotal, this.discountValue);
    }

    return 0;
  }

  get total() {
    return this.subtotal - this.discountAmount;
  }
}

module.exports = {
  CartModel,
  CartLine,
  CartAddOn
};
