export type Role = "admin" | "cashier" | "waiter";

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  display_order: number;
  is_active: boolean;
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price_cents: number;
  gst_percent: number;
  is_available: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
}

export interface StockAdjustment {
  id: number;
  menu_item_id: number;
  change_quantity: number;
  quantity_after: number;
  reason: string;
  note: string | null;
  created_by: number | null;
  created_at: string;
}

export interface RestaurantTable {
  id: number;
  table_number: string;
  seats: number;
  status: "free" | "occupied" | "billed";
  is_active: boolean;
}

export interface OrderItem {
  id: number;
  menu_item_id: number;
  menu_item_name: string;
  quantity: number;
  special_note: string | null;
  kot_status: "pending" | "sent" | "prepared" | "served";
  line_total_cents: number;
}

export interface Order {
  id: number;
  order_no: string;
  table_id: number | null;
  order_type: "dine_in" | "takeaway";
  status: string;
  items: OrderItem[];
}

export interface Bill {
  id: number;
  bill_no: string;
  order_id: number;
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  grand_total_cents: number;
  payment_status: "unpaid" | "partial" | "paid";
}

export interface Payment {
  id: number;
  bill_id: number;
  method: "cash" | "card" | "upi";
  amount_cents: number;
  reference_no: string | null;
}
