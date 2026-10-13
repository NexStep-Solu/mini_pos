import { supabase } from '../lib/supabase';
import type {
  AuditLog, Branch, Brand, Category, Customer, Expense, Organization,
  PaymentMethod, Product, PurchaseItem, PurchaseOrder, RegisterSession,
  Role, Sale, SaleItem, SaleReturn, StockBalance, StockMovement, Supplier, Unit,
} from '../types';

// ─── Supabase adapter (remote mode) ─────────────────────────────────────
// Same domain model as the local store; every function throws a friendly
// Error on failure so callers can toast it. Client-generated UUIDs are used
// for new rows so local state and server rows share ids.

type Client = NonNullable<typeof supabase>;
function client(): Client {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

async function must<T>(label: string, q: unknown): Promise<T> {
  const res = (await (q as unknown as Promise<{ data: T; error: { message: string } | null }>));
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
}

export const N = (v: unknown, d = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};

/** random id shared by local state + server row (remote mode only) */
export const rid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function friendly(e: unknown): string {
  if (e instanceof Error) {
    if (/Failed to fetch|NetworkError|network/i.test(e.message)) return 'Network error — check your connection';
    return e.message.replace(/^[a-z_]+: /i, '');
  }
  return 'Unexpected error';
}

// ─── membership / auth ──────────────────────────────────────────────────
export interface Membership {
  organization_id: string;
  branch_id: string;
  role: Role;
  perms: string[];
  org: Organization;
  branch: Branch;
}

export interface StaffRow {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string | null;
  branch_id: string | null;
  email: string | null;
  display_name: string | null;
  is_active: boolean;
  role_name: string;
  branch_name: string | null;
}

interface MemberRow {
  organization_id: string;
  branch_id: string | null;
  roles: { name: string; permissions: string[] } | null;
  organizations: Organization | null;
  branches: Branch | null;
}

const VALID_ROLES: Role[] = ['owner', 'manager', 'cashier', 'inventory', 'viewer'];

export async function fetchMembership(userId: string): Promise<Membership> {
  const sb = client();
  const row = await must<MemberRow | null>(
    'Membership lookup failed',
    sb
      .from('organization_members')
      .select('organization_id, branch_id, roles(name, permissions), organizations(*), branches(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  );
  if (!row || !row.organizations) {
    throw new Error('No organization membership — ask your owner to add you (supabase/demo-users.sql)');
  }
  const roleName = row.roles?.name ?? '';
  const role: Role = (VALID_ROLES as string[]).includes(roleName) ? (roleName as Role) : 'viewer';
  const perms: string[] = role === 'owner'
    ? ['*']
    : Array.isArray(row.roles?.permissions) ? (row.roles as { permissions: unknown }).permissions as string[] : [];
  let branch = row.branches;
  if (!branch) {
    const branches = await must<Branch[] | null>(
      'Branch lookup failed',
      sb.from('branches').select('*').eq('organization_id', row.organization_id).eq('is_active', true).limit(1),
    );
    branch = branches?.[0] ?? null;
  }
  if (!branch) throw new Error('No active branch in this organization');
  return { organization_id: row.organization_id, branch_id: branch.id, role, perms, org: row.organizations, branch };
}

// ─── hydration ──────────────────────────────────────────────────────────
export interface Hydrated {
  org: Organization;
  branch: Branch;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  products: Product[];
  stock: StockBalance[];
  movements: StockMovement[];
  suppliers: Supplier[];
  purchases: PurchaseOrder[];
  purchaseItems: PurchaseItem[];
  sales: Sale[];
  saleItems: SaleItem[];
  returns: SaleReturn[];
  customers: Customer[];
  sessions: RegisterSession[];
  expenses: Expense[];
  audit: AuditLog[];
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function fetchAll(orgId: string, _branchId: string, m: Membership): Promise<Hydrated> {
  const sb = client();
  const [
    categories, brands, units, products, barcodes, stock, suppliers,
    purchases, purchaseItems, sales, customers, sessions, expenses, audit, returns,
  ] = await Promise.all([
    must<Category[] | null>('Categories', sb.from('categories').select('*').eq('organization_id', orgId).order('name')),
    must<Brand[] | null>('Brands', sb.from('brands').select('*').eq('organization_id', orgId).order('name')),
    must<Unit[] | null>('Units', sb.from('units').select('*').eq('organization_id', orgId)),
    must<Product[] | null>('Products', sb.from('products').select('*').eq('organization_id', orgId).order('name')),
    must<{ product_id: string; barcode: string; is_primary: boolean }[] | null>(
      'Barcodes', sb.from('product_barcodes').select('product_id, barcode, is_primary')),
    must<StockBalance[] | null>('Stock', sb.from('stock_balances').select('*').eq('organization_id', orgId)),
    must<Supplier[] | null>('Suppliers', sb.from('suppliers').select('*').eq('organization_id', orgId).order('name')),
    must<PurchaseOrder[] | null>('Purchases', sb.from('purchase_orders').select('*').eq('organization_id', orgId).order('ordered_at', { ascending: false }).limit(200)),
    must<PurchaseItem[] | null>('Purchase items', sb.from('purchase_items').select('*, purchase_orders!inner(organization_id)').eq('purchase_orders.organization_id', orgId).limit(2000)),
    must<Sale[] | null>('Sales', sb.from('sales').select('*').eq('organization_id', orgId).order('sold_at', { ascending: false }).limit(400)),
    must<Customer[] | null>('Customers', sb.from('customers').select('*').eq('organization_id', orgId).order('name')),
    must<RegisterSession[] | null>('Register', sb.from('register_sessions').select('*').eq('organization_id', orgId).order('opened_at', { ascending: false }).limit(100)),
    must<Expense[] | null>('Expenses', sb.from('expenses').select('*').eq('organization_id', orgId).order('expense_date', { ascending: false }).limit(500)),
    must<AuditLog[] | null>('Audit', sb.from('audit_logs').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(200)),
    must<SaleReturn[] | null>('Returns', sb.from('sale_returns').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(200)),
  ]);

  const saleIds = (sales ?? []).map((s) => s.id);
  let saleItems: SaleItem[] = [];
  for (const ids of chunk(saleIds, 100)) {
    if (!ids.length) break;
    const rows = await must<SaleItem[] | null>('Sale items', sb.from('sale_items').select('*').in('sale_id', ids));
    saleItems = saleItems.concat(rows ?? []);
  }

  const movements = await must<StockMovement[] | null>(
    'Movements', sb.from('stock_movements').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(1000));

  const primary = new Map<string, string>();
  for (const b of barcodes ?? []) {
    if (b.is_primary && !primary.has(b.product_id)) primary.set(b.product_id, b.barcode);
  }

  const num = (r: unknown, k: string, d = 0) => N((r as Record<string, unknown>)[k], d);
  const mapSale = (s: Sale): Sale => ({
    ...s,
    subtotal: num(s, 'subtotal'), discount: num(s, 'discount'), tax: num(s, 'tax'),
    total: num(s, 'total'), paid_amount: num(s, 'paid_amount'),
    due_amount: num(s, 'due_amount'), change_amount: num(s, 'change_amount'),
    payments: (Array.isArray(s.payments) ? s.payments : []) as Sale['payments'],
  });

  return {
    org: m.org,
    branch: m.branch,
    categories: categories ?? [],
    brands: brands ?? [],
    units: units ?? [],
    products: (products ?? []).map((p) => ({
      ...p,
      barcode: primary.get(p.id) ?? (p.barcode as string | null) ?? null,
      cost_price: num(p, 'cost_price'), selling_price: num(p, 'selling_price'),
      wholesale_price: p.wholesale_price == null ? null : N(p.wholesale_price),
      minimum_price: p.minimum_price == null ? null : N(p.minimum_price),
      reorder_level: num(p, 'reorder_level'), reorder_quantity: num(p, 'reorder_quantity'),
    })),
    stock: (stock ?? []).map((s) => ({ ...s, quantity: num(s, 'quantity'), reserved_quantity: num(s, 'reserved_quantity'), average_cost: num(s, 'average_cost') })),
    movements: (movements ?? []).map((x) => ({ ...x, quantity: num(x, 'quantity'), unit_cost: num(x, 'unit_cost') })),
    suppliers: (suppliers ?? []).map((s) => ({ ...s, credit_limit: s.credit_limit == null ? undefined : N(s.credit_limit) })),
    purchases: (purchases ?? []).map((p) => ({
      ...p, subtotal: num(p, 'subtotal'), discount: num(p, 'discount'), tax: num(p, 'tax'),
      total: num(p, 'total'), paid_amount: num(p, 'paid_amount'), due_amount: num(p, 'due_amount'),
    })),
    purchaseItems: (purchaseItems ?? []).map((i) => {
      const { purchase_orders, ...rest } = i as unknown as Record<string, unknown>;
      void purchase_orders;
      const r = rest as unknown as PurchaseItem;
      return { ...r, quantity: N(r.quantity), received_quantity: N(r.received_quantity), unit_cost: N(r.unit_cost), discount: N(r.discount), total: N(r.total) };
    }),
    sales: (sales ?? []).map(mapSale),
    saleItems: saleItems.map((i) => ({
      ...i, quantity: N(i.quantity), unit_price: N(i.unit_price), cost_price: N(i.cost_price),
      discount: N(i.discount), tax: N(i.tax), total: N(i.total),
    })),
    returns: (returns ?? []).map((r) => ({
      id: r.id as string, sale_id: (r as unknown as Record<string, string>).sale_id,
      items: ((r as unknown as Record<string, unknown>).items ?? []) as SaleReturn['items'],
      refund_amount: num(r, 'refund_amount'), refund_method: ((r as unknown as Record<string, string>).refund_method ?? 'cash') as SaleReturn['refund_method'],
      created_by: ((r as unknown as Record<string, string>).created_by ?? '') as string,
      created_at: ((r as unknown as Record<string, string>).created_at ?? '') as string,
    })),
    customers: (customers ?? []).map((c) => ({
      ...c, credit_limit: num(c, 'credit_limit'), current_balance: num(c, 'current_balance'),
      loyalty_points: Math.round(num(c, 'loyalty_points')),
    })),
    sessions: (sessions ?? []).map((s) => ({
      ...s, opening_cash: num(s, 'opening_cash'),
      closing_cash: s.closing_cash == null ? null : N(s.closing_cash),
      expected_cash: s.expected_cash == null ? null : N(s.expected_cash),
      cash_difference: s.cash_difference == null ? null : N(s.cash_difference),
      cash_in: N(s.cash_in), cash_out: N(s.cash_out),
    })),
    expenses: (expenses ?? []).map((e) => ({ ...e, amount: num(e, 'amount') })),
    audit: (audit ?? []).map((a) => ({ ...a } as AuditLog)),
  };
}

// ─── sale RPC ───────────────────────────────────────────────────────────
export interface RpcSaleArgs {
  org: string; branch: string; customer: string | null;
  payments: { method: PaymentMethod; amount: number }[];
  discount: number;
  items: { product_id: string; quantity: number; unit_price: number; discount: number }[];
  register: string | null;
}

export async function rpcCreateSale(a: RpcSaleArgs): Promise<string> {
  const sb = client();
  const id = await must<string>(
    'Sale failed',
    sb.rpc('create_sale', {
      p_org: a.org, p_branch: a.branch, p_customer: a.customer,
      p_payments: a.payments, p_discount: a.discount, p_items: a.items, p_register: a.register,
    }),
  );
  return id;
}

export async function fetchSale(id: string): Promise<{ sale: Sale; items: SaleItem[] }> {
  const sb = client();
  const sale = await must<Sale>('Sale sync', sb.from('sales').select('*').eq('id', id).single());
  const items = await must<SaleItem[] | null>('Sale items sync', sb.from('sale_items').select('*').eq('sale_id', id));
  return {
    sale: { ...sale, subtotal: N(sale.subtotal), discount: N(sale.discount), tax: N(sale.tax), total: N(sale.total), paid_amount: N(sale.paid_amount), due_amount: N(sale.due_amount), change_amount: N(sale.change_amount), payments: (Array.isArray(sale.payments) ? sale.payments : []) as Sale['payments'] },
    items: (items ?? []).map((i) => ({ ...i, quantity: N(i.quantity), unit_price: N(i.unit_price), cost_price: N(i.cost_price), discount: N(i.discount), tax: N(i.tax), total: N(i.total) })),
  };
}

// ─── generic writers ────────────────────────────────────────────────────
export { must as mustOk, client as sbClient };

export async function insertRow(table: string, row: Record<string, unknown>): Promise<void> {
  await must('Save failed', client().from(table).insert(row));
}

export async function updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  await must('Update failed', client().from(table).update(patch).eq('id', id));
}

export async function insertAudit(orgId: string, userId: string | null, action: string, entity: string, id: string, payload?: unknown): Promise<void> {
  await must('Audit failed', client().from('audit_logs').insert({
    organization_id: orgId, user_id: userId, action,
    entity_type: entity, entity_id: id, new_values: payload ?? null,
  }));
}

export async function ping(): Promise<{ ok: boolean; detail: string }> {  try {
    if (!supabase) return { ok: false, detail: 'Supabase is not configured (.env missing)' };
    const { error } = await supabase.from('organizations').select('id', { count: 'exact', head: true });
    if (error) return { ok: false, detail: `Connected, but query failed: ${error.message}` };
    return { ok: true, detail: 'Connected — schema reachable' };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Connection failed' };
  }
}

// ─── write-through persist helpers (remote mode) ────────────────────────
// Each mirrors one local applier: same payload the UI already computed,
// written to Supabase. Throw on failure; callers toast via friendly().

export interface PersistCtx {
  org: string;
  branch: string;
  by: string | null;
}

const movRow = (c: PersistCtx, m: StockMovement): Record<string, unknown> => ({
  id: m.id, organization_id: c.org, branch_id: m.branch_id, product_id: m.product_id,
  movement_type: m.movement_type, quantity: m.quantity, unit_cost: m.unit_cost,
  reference_type: m.reference_type, reference_id: m.reference_id,
  notes: m.notes ?? null, created_by: c.by, created_at: m.created_at,
});

export async function persistAdjust(
  c: PersistCtx, productId: string, newQty: number, m: StockMovement,
): Promise<void> {
  const sb = client();
  await must('Stock sync failed', sb.from('stock_balances').update({ quantity: newQty, updated_at: m.created_at }).eq('branch_id', c.branch).eq('product_id', productId));
  await must('Movement sync failed', sb.from('stock_movements').insert(movRow(c, m)));
}

export async function persistProduct(c: PersistCtx, p: Product, isNew: boolean, stockRow?: StockBalance): Promise<void> {
  const sb = client();
  const row = {
    id: p.id, organization_id: c.org, category_id: p.category_id || null,
    brand_id: p.brand_id || null, name: p.name, sku: p.sku, description: p.description || null,
    unit_id: p.unit_id || null, cost_price: p.cost_price, selling_price: p.selling_price,
    wholesale_price: p.wholesale_price ?? null, minimum_price: p.minimum_price ?? null,
    reorder_level: p.reorder_level, reorder_quantity: p.reorder_quantity,
    track_stock: p.track_stock, allow_negative_stock: p.allow_negative_stock,
    is_active: p.is_active, image_url: p.image_url ?? null,
  };
  if (isNew) {
    await must('Product sync failed', sb.from('products').insert(row));
    if (p.barcode) {
      await must('Barcode sync failed', sb.from('product_barcodes').insert({ product_id: p.id, barcode: p.barcode, is_primary: true }));
    }
    if (stockRow) {
      await must('Stock sync failed', sb.from('stock_balances').insert({
        id: stockRow.id, organization_id: c.org, branch_id: c.branch, product_id: p.id,
        quantity: 0, reserved_quantity: 0, average_cost: p.cost_price,
      }));
    }
  } else {
    await must('Product sync failed', sb.from('products').update(row).eq('id', p.id));
  }
}

export async function persistCustomer(c: PersistCtx, cu: Customer, isNew: boolean): Promise<void> {
  const sb = client();
  const row = {
    id: cu.id, organization_id: c.org, customer_code: cu.customer_code, name: cu.name,
    phone: cu.phone, email: cu.email || null, address: cu.address || null,
    date_of_birth: cu.date_of_birth ?? null, gender: cu.gender ?? null,
    group_id: cu.group_id ?? null, credit_limit: cu.credit_limit,
    current_balance: cu.current_balance, loyalty_points: cu.loyalty_points,
    notes: cu.notes || null, is_active: cu.is_active,
  };
  if (isNew) await must('Customer sync failed', sb.from('customers').insert(row));
  else await must('Customer sync failed', sb.from('customers').update(row).eq('id', cu.id));
}

export async function persistDue(_c: PersistCtx, customerId: string, newBalance: number): Promise<void> {
  await must('Due sync failed', client().from('customers').update({ current_balance: newBalance }).eq('id', customerId));
}

export async function persistSupplier(c: PersistCtx, s: Supplier, isNew: boolean): Promise<void> {
  const sb = client();
  const row = {
    id: s.id, organization_id: c.org, name: s.name, contact_person: s.contact_person,
    phone: s.phone, email: s.email || null, address: s.address || null,
    tax_number: s.tax_number || null, notes: s.notes || null,
    credit_limit: s.credit_limit ?? null, is_active: s.is_active,
  };
  if (isNew) await must('Supplier sync failed', sb.from('suppliers').insert(row));
  else await must('Supplier sync failed', sb.from('suppliers').update(row).eq('id', s.id));
}

export async function persistPurchase(
  c: PersistCtx, order: PurchaseOrder, items: PurchaseItem[],
  movs: StockMovement[], stockAfter: { product_id: string; quantity: number; average_cost: number }[],
): Promise<void> {
  const sb = client();
  await must('Purchase sync failed', sb.from('purchase_orders').insert({
    id: order.id, organization_id: c.org, branch_id: order.branch_id, supplier_id: order.supplier_id,
    purchase_number: order.purchase_number, status: order.status, subtotal: order.subtotal,
    discount: order.discount, tax: order.tax, total: order.total, paid_amount: order.paid_amount,
    due_amount: order.due_amount, ordered_at: order.ordered_at, received_at: order.received_at ?? null,
    created_by: c.by,
  }));
  await must('Purchase items sync failed', sb.from('purchase_items').insert(items.map((i) => ({
    id: i.id, purchase_order_id: i.purchase_order_id, product_id: i.product_id,
    quantity: i.quantity, received_quantity: i.received_quantity, unit_cost: i.unit_cost,
    discount: i.discount, total: i.total,
  }))));
  if (movs.length) {
    await must('Stock sync failed', sb.from('stock_movements').insert(movs.map((m) => movRow(c, m))));
    for (const s of stockAfter) {
      await must('Stock sync failed', sb.from('stock_balances').update({ quantity: s.quantity, average_cost: s.average_cost }).eq('branch_id', c.branch).eq('product_id', s.product_id));
    }
  }
}

export async function persistPurchaseStatus(
  c: PersistCtx, id: string, status: string, receivedAt: string | null | undefined,
  movs: StockMovement[], stockAfter: { product_id: string; quantity: number; average_cost: number }[],
): Promise<void> {
  const sb = client();
  await must('Status sync failed', sb.from('purchase_orders').update({ status, received_at: receivedAt ?? null }).eq('id', id));
  if (movs.length) {
    await must('Stock sync failed', sb.from('stock_movements').insert(movs.map((m) => movRow(c, m))));
    for (const s of stockAfter) {
      await must('Stock sync failed', sb.from('stock_balances').update({ quantity: s.quantity, average_cost: s.average_cost }).eq('branch_id', c.branch).eq('product_id', s.product_id));
    }
  }
}

export async function persistReturn(
  c: PersistCtx, ret: SaleReturn, movs: StockMovement[],
  stockAfter: { product_id: string; quantity: number }[],
): Promise<void> {
  const sb = client();
  await must('Return sync failed', sb.from('sale_returns').insert({
    id: ret.id, organization_id: c.org, sale_id: ret.sale_id, items: ret.items,
    refund_amount: ret.refund_amount, refund_method: ret.refund_method, created_by: c.by,
  }));
  await must('Stock sync failed', sb.from('stock_movements').insert(movs.map((m) => movRow(c, m))));
  for (const s of stockAfter) {
    await must('Stock sync failed', sb.from('stock_balances').update({ quantity: s.quantity }).eq('branch_id', c.branch).eq('product_id', s.product_id));
  }
}

export async function persistExpense(c: PersistCtx, e: Expense): Promise<void> {
  await must('Expense sync failed', client().from('expenses').insert({
    id: e.id, organization_id: c.org, branch_id: e.branch_id, category: e.category,
    amount: e.amount, payment_method: e.payment_method, description: e.description,
    expense_date: e.expense_date.slice(0, 10), created_by: c.by,
  }));
}

export async function persistSessionOpen(c: PersistCtx, s: RegisterSession): Promise<void> {
  await must('Register sync failed', client().from('register_sessions').insert({
    id: s.id, organization_id: c.org, branch_id: s.branch_id, user_id: c.by,
    opening_cash: s.opening_cash, opened_at: s.opened_at, status: 'open',
  }));
}

export async function persistSessionClose(
  id: string, patch: { closing_cash: number; expected_cash: number; cash_difference: number; closed_at: string },
): Promise<void> {
  await must('Register sync failed', client().from('register_sessions').update({ ...patch, status: 'closed' }).eq('id', id));
}

// ─── staff & roles (owner-gated via RLS) ────────────────────────────────
export async function fetchStaff(orgId: string): Promise<StaffRow[]> {
  const sb = client();
  const rows = await must<Record<string, unknown>[] | null>(
    'Staff list failed',
    sb.from('organization_members')
      .select('id, organization_id, user_id, role_id, branch_id, email, display_name, is_active, roles(name), branches(name)')
      .eq('organization_id', orgId)
      .order('display_name'),
  );
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    organization_id: String(r.organization_id),
    user_id: String(r.user_id),
    role_id: (r.role_id as string | null) ?? null,
    branch_id: (r.branch_id as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    display_name: (r.display_name as string | null) ?? null,
    is_active: Boolean(r.is_active),
    role_name: ((r.roles as { name?: string } | null)?.name) ?? '—',
    branch_name: ((r.branches as { name?: string } | null)?.name) ?? null,
  }));
}

export interface RoleRow {
  id: string;
  name: string;
  permissions: string[];
}

export async function fetchRolesList(orgId: string): Promise<RoleRow[]> {
  const sb = client();
  const rows = await must<{ id: string; name: string; permissions: unknown }[] | null>(
    'Roles list failed',
    sb.from('roles').select('id, name, permissions').eq('organization_id', orgId).order('name'),
  );
  return (rows ?? []).map((r) => ({
    id: r.id, name: r.name,
    permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
  }));
}

export async function fetchBranchesList(orgId: string): Promise<Branch[]> {
  return must<Branch[] | null>(
    'Branches list failed',
    client().from('branches').select('*').eq('organization_id', orgId).order('name'),
  ).then((rows) => rows ?? []);
}

export async function linkMember(input: {
  org: string; userId: string; email: string; displayName: string;
  roleId: string; branchId: string;
}): Promise<void> {
  await must('Link failed', client().from('organization_members').insert({
    organization_id: input.org, user_id: input.userId, role_id: input.roleId,
    branch_id: input.branchId, email: input.email, display_name: input.displayName,
    is_active: true,
  }));
}

export async function updateMember(
  id: string, patch: { role_id?: string; branch_id?: string; is_active?: boolean },
): Promise<void> {
  await must('Staff update failed', client().from('organization_members').update(patch).eq('id', id));
}

export async function updateRolePerms(roleId: string, permissions: string[]): Promise<void> {
  await must('Role update failed', client().from('roles').update({ permissions }).eq('id', roleId));
}
