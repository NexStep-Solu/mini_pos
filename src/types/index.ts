// ─── Mini Mart POS + Inventory + CRM · core domain types ─────────────────────
// Mirrors §6-§27 of MINIMART_POS_INVENTORY_CRM.md. UUID strings everywhere.

export type Role = 'owner' | 'manager' | 'cashier' | 'inventory' | 'viewer';

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  pin?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  timezone: string;
}

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  phone: string;
  address: string;
  is_active: boolean;
}

export interface Category {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  is_active: boolean;
}

export interface Brand {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
}

export interface Unit {
  id: string;
  organization_id: string;
  name: string;
  short_name: string;
  allow_decimal: boolean;
}

export interface Product {
  id: string;
  organization_id: string;
  category_id: string;
  brand_id?: string | null;
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string;
  unit_id: string;
  cost_price: number;
  selling_price: number;
  wholesale_price?: number | null;
  minimum_price?: number | null;
  reorder_level: number;
  reorder_quantity: number;
  track_stock: boolean;
  allow_negative_stock: boolean;
  is_active: boolean;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockBalance {
  id: string;
  organization_id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  average_cost: number;
  updated_at: string;
}

export type MovementType =
  | 'purchase' | 'sale' | 'sale_return' | 'purchase_return'
  | 'adjustment_in' | 'adjustment_out' | 'transfer_in' | 'transfer_out'
  | 'stocktake' | 'opening_balance' | 'damage' | 'expired';

export interface StockMovement {
  id: string;
  organization_id: string;
  branch_id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number; // signed: +in, -out
  unit_cost: number;
  reference_type: string;
  reference_id: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  tax_number?: string;
  notes?: string;
  credit_limit?: number;
  is_active: boolean;
}

export type PurchaseStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  organization_id: string;
  branch_id: string;
  supplier_id: string;
  purchase_number: string;
  status: PurchaseStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  due_amount: number;
  ordered_at: string;
  received_at?: string | null;
  created_by: string;
}

export interface PurchaseItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  discount: number;
  total: number;
}

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'mobile_wallet' | 'credit';

export interface SalePayment {
  method: PaymentMethod;
  amount: number;
}

export type SaleStatus = 'completed' | 'partially_paid' | 'credit' | 'returned' | 'cancelled';

export interface Sale {
  id: string;
  organization_id: string;
  branch_id: string;
  register_session_id?: string | null;
  customer_id?: string | null;
  invoice_number: string;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  due_amount: number;
  change_amount: number;
  payments: SalePayment[];
  cashier_id: string;
  sold_at: string;
  notes?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount: number;
  tax: number;
  total: number;
}

export interface SaleReturn {
  id: string;
  sale_id: string;
  items: { product_id: string; quantity: number; reason: string }[];
  refund_amount: number;
  refund_method: PaymentMethod;
  created_by: string;
  created_at: string;
}

export interface RegisterSession {
  id: string;
  organization_id: string;
  branch_id: string;
  user_id: string;
  opening_cash: number;
  closing_cash?: number | null;
  expected_cash?: number | null;
  cash_difference?: number | null;
  opened_at: string;
  closed_at?: string | null;
  status: 'open' | 'closed';
  cash_in?: number;
  cash_out?: number;
  note?: string;
}

export interface Expense {
  id: string;
  organization_id: string;
  branch_id: string;
  category: string;
  amount: number;
  payment_method: PaymentMethod;
  description: string;
  expense_date: string;
  created_by: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  customer_code: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  date_of_birth?: string | null;
  gender?: string | null;
  group_id?: string | null;
  credit_limit: number;
  current_balance: number; // amount customer owes
  loyalty_points: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerGroup {
  id: string;
  organization_id: string;
  name: string;
  discount_pct: number;
}

export interface HeldSale {
  id: string;
  cart: CartLine[];
  customer_id?: string | null;
  discount: number;
  notes?: string;
  held_at: string;
  held_by: string;
}

export interface CartLine {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number; // line-level fixed discount
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: unknown;
  new_values?: unknown;
  created_at: string;
}

export interface Stocktake {
  id: string;
  branch_id: string;
  status: 'draft' | 'confirmed';
  lines: { product_id: string; system_qty: number; counted_qty: number }[];
  created_by: string;
  created_at: string;
  confirmed_at?: string | null;
}

// join helper for UI
export interface ProductWithStock extends Product {
  stock_qty: number;
  category_name?: string;
  brand_name?: string;
  unit_short?: string;
}
