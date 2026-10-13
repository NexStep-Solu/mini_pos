import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  AuditLog, Branch, Brand, CartLine, Category, Customer, DemoUser, Expense,
  HeldSale, Organization, PaymentMethod, Product, PurchaseItem, PurchaseOrder,
  RegisterSession, Sale, SaleItem, SaleReturn, StockBalance, StockMovement,
  Stocktake, Supplier, Unit,
} from '../types';
import { BRANCH, ORG, buildSeedCustomers, buildSeedProducts, openingStockQty, seedBrands, seedCategories, seedSuppliers, seedUnits } from '../data/seed';
import { invoiceNo, poNo, todayISO, uid } from '../lib/formatters';
import { ORG_ID, BRANCH_ID, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { GRANTS } from '../lib/permissions';
import {
  fetchAll, fetchMembership, fetchSale, friendly, insertAudit,
  persistAdjust, persistCustomer, persistDue, persistExpense, persistProduct,
  persistPurchase, persistPurchaseStatus, persistReturn, persistSessionClose,
  persistSessionOpen, persistSupplier, rid, rpcCreateSale, updateRow,
  type Membership, type PersistCtx,
} from './remote';

export const DEMO_USERS: DemoUser[] = [
  { id: 'u-owner', email: 'owner@demo.mm', name: 'Daw Owner', role: 'owner' },
  { id: 'u-manager', email: 'manager@demo.mm', name: 'U Manager', role: 'manager' },
  { id: 'u-cashier', email: 'cashier@demo.mm', name: 'Ma Cashier', role: 'cashier' },
  { id: 'u-inv', email: 'inventory@demo.mm', name: 'Ko Inventory', role: 'inventory' },
  { id: 'u-viewer', email: 'viewer@demo.mm', name: 'U Viewer', role: 'viewer' },
];

interface DB {
  v: number;
  seqSale: number;
  seqPO: number;
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
  held: HeldSale[];
  audit: AuditLog[];
  stocktakes: Stocktake[];
}

const KEY = 'mm-pos-v1';
const KEY_REMOTE = 'mm-pos-remote-v1';

export const isRemote = isSupabaseConfigured;

function emptyDB(): DB {
  return {
    v: 1, seqSale: 1, seqPO: 1,
    org: { id: '', name: '', slug: '', phone: '', email: '', address: '', currency: 'MMK', timezone: 'Asia/Yangon' } as Organization,
    branch: { id: '', organization_id: '', name: '', code: '', phone: '', address: '', is_active: true } as Branch,
    categories: [], brands: [], units: [], products: [], stock: [], movements: [],
    suppliers: [], purchases: [], purchaseItems: [], sales: [], saleItems: [], returns: [],
    customers: [], sessions: [], expenses: [], held: [], audit: [], stocktakes: [],
  };
}

function loadRemoteCache(userId: string, orgId: string): DB | null {
  try {
    const raw = localStorage.getItem(KEY_REMOTE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId: string; orgId: string; savedAt: string; db: DB };
    if (parsed.userId === userId && parsed.orgId === orgId && parsed.db?.v === 1) return parsed.db;
    return null;
  } catch { return null; }
}

function seedDB(): DB {
  const products = buildSeedProducts();
  const now = new Date();
  const stock: StockBalance[] = products.map((p) => ({
    id: uid('sb'),
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    product_id: p.id,
    quantity: openingStockQty(p.id),
    reserved_quantity: 0,
    average_cost: p.cost_price,
    updated_at: now.toISOString(),
  }));
  const movements: StockMovement[] = products.map((p) => ({
    id: uid('mv'),
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    product_id: p.id,
    movement_type: 'opening_balance',
    quantity: openingStockQty(p.id),
    unit_cost: p.cost_price,
    reference_type: 'opening',
    reference_id: 'OPENING',
    notes: 'Opening balance',
    created_by: 'u-owner',
    created_at: now.toISOString(),
  }));

  // historical sales: 500 over last 30 days
  const customers = buildSeedCustomers();
  const sales: Sale[] = [];
  const saleItems: SaleItem[] = [];
  const methods: PaymentMethod[] = ['cash', 'cash', 'cash', 'mobile_wallet', 'card', 'bank_transfer'];
  let seq = 1;
  const stockMap = new Map(stock.map((s) => [s.product_id, s.quantity]));
  for (let d = 29; d >= 0; d--) {
    const dayCount = 12 + Math.floor(Math.random() * 10);
    for (let k = 0; k < dayCount && sales.length < 520; k++) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - d);
      dt.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
      const nLines = 1 + Math.floor(Math.random() * 4);
      const lines: { p: Product; qty: number }[] = [];
      for (let l = 0; l < nLines; l++) {
        const p = products[Math.floor(Math.random() * products.length)];
        const qty = 1 + Math.floor(Math.random() * 3);
        lines.push({ p, qty });
      }
      const subtotal = lines.reduce((s, l) => s + l.p.selling_price * l.qty, 0);
      const discount = Math.random() < 0.12 ? Math.round(subtotal * 0.05) : 0;
      const total = subtotal - discount;
      const method = methods[Math.floor(Math.random() * methods.length)];
      const cust = Math.random() < 0.3 ? customers[1 + Math.floor(Math.random() * 100)] : null;
      const id = uid('sale');
      sales.push({
        id, organization_id: ORG_ID, branch_id: BRANCH_ID,
        customer_id: cust?.id ?? null,
        invoice_number: invoiceNo(seq++),
        status: 'completed', subtotal, discount, tax: 0, total,
        paid_amount: total, due_amount: 0, change_amount: 0,
        payments: [{ method, amount: total }],
        cashier_id: ['u-cashier', 'u-manager'][Math.floor(Math.random() * 2)],
        sold_at: dt.toISOString(),
      });
      lines.forEach((l) => {
        saleItems.push({
          id: uid('si'), sale_id: id, product_id: l.p.id, quantity: l.qty,
          unit_price: l.p.selling_price, cost_price: l.p.cost_price,
          discount: 0, tax: 0, total: l.p.selling_price * l.qty,
        });
        movements.push({
          id: uid('mv'), organization_id: ORG_ID, branch_id: BRANCH_ID,
          product_id: l.p.id, movement_type: 'sale', quantity: -l.qty,
          unit_cost: l.p.cost_price, reference_type: 'sale', reference_id: id,
          created_by: 'u-cashier', created_at: dt.toISOString(),
        });
        stockMap.set(l.p.id, (stockMap.get(l.p.id) ?? 0) - l.qty);
      });
    }
  }
  stock.forEach((s) => { s.quantity = Math.max(0, stockMap.get(s.product_id) ?? 0); });

  const expenses: Expense[] = [
    { id: uid('ex'), organization_id: ORG_ID, branch_id: BRANCH_ID, category: 'Rent', amount: 1500000, payment_method: 'bank_transfer', description: 'Monthly shop rent', expense_date: now.toISOString(), created_by: 'u-owner' },
    { id: uid('ex'), organization_id: ORG_ID, branch_id: BRANCH_ID, category: 'Electricity', amount: 185000, payment_method: 'mobile_wallet', description: 'EPC bill', expense_date: now.toISOString(), created_by: 'u-manager' },
    { id: uid('ex'), organization_id: ORG_ID, branch_id: BRANCH_ID, category: 'Transport', amount: 120000, payment_method: 'cash', description: 'Stock delivery transport', expense_date: now.toISOString(), created_by: 'u-manager' },
  ];

  return {
    v: 1, seqSale: seq, seqPO: 12,
    org: { ...ORG, id: ORG_ID, currency: 'MMK', timezone: 'Asia/Yangon', slug: ORG.slug, logo_url: undefined } as Organization,
    branch: { ...BRANCH } as Branch,
    categories: seedCategories, brands: seedBrands, units: seedUnits,
    products, stock, movements,
    suppliers: seedSuppliers,
    purchases: [], purchaseItems: [],
    sales, saleItems, returns: [],
    customers, sessions: [], expenses, held: [],
    audit: [{ id: uid('a'), organization_id: ORG_ID, user_id: 'system', action: 'demo.seeded', entity_type: 'system', entity_id: 'demo', created_at: now.toISOString() }],
    stocktakes: [],
  };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.v === 1) return db;
    }
  } catch { /* ignore */ }
  const db = seedDB();
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ }
  return db;
}

function mapAuthError(msg: string): string {
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email or password — did you run supabase/demo-users.sql?';
  if (/Email not confirmed/i.test(msg)) return 'Email not confirmed — enable “Auto Confirm User” when creating demo users.';
  return msg;
}

// ─── context ────────────────────────────────────────────────────────────────
interface Store {
  db: DB;
  user: DemoUser | null;
  mode: 'local' | 'remote';
  authReady: boolean;
  authPending: boolean;
  remoteError: string | null;
  login: (email: string) => boolean;
  logout: () => void;
  supaLogin: (email: string, password: string) => Promise<string | null>;
  supaLogout: () => Promise<void>;
  refreshRemote: () => Promise<void>;
  resetDemo: () => void;
  stockOf: (productId: string) => number;
  lowStock: { product: Product; qty: number }[];
  rolePerms: string[];
  canDo: (perm: string) => boolean;
  createSale: (args: {
    lines: CartLine[]; customer_id?: string | null; discount: number;
    payments: { method: PaymentMethod; amount: number }[]; notes?: string;
  }) => Sale | Promise<Sale>;
  createReturn: (saleId: string, items: { product_id: string; quantity: number; reason: string }[], refundMethod: PaymentMethod) => void;
  adjustStock: (productId: string, diff: number, notes: string) => void;
  receivePurchase: (po: Omit<PurchaseOrder, 'id' | 'purchase_number'>, items: Omit<PurchaseItem, 'id' | 'purchase_order_id'>[]) => PurchaseOrder;
  updatePurchaseStatus: (id: string, status: PurchaseOrder['status']) => void;
  upsertProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  upsertCustomer: (c: Customer) => void;
  upsertSupplier: (s: Supplier) => void;
  collectDue: (customerId: string, amount: number, method: PaymentMethod) => void;
  holdSale: (h: Omit<HeldSale, 'id' | 'held_at'>) => void;
  resumeHeld: (id: string) => HeldSale | null;
  removeHeld: (id: string) => void;
  openRegister: (openingCash: number) => RegisterSession;
  closeRegister: (closingCash: number) => void;
  addExpense: (e: Omit<Expense, 'id'>) => void;
  addMovement: (m: Omit<StockMovement, 'id' | 'created_at'>) => void;
  audit: (action: string, entity_type: string, entity_id: string, extra?: { old?: unknown; next?: unknown }) => void;
  save: (patch: Partial<DB>) => void;
}

const Ctx = createContext<Store | null>(null);

const mode: 'local' | 'remote' = isRemote ? 'remote' : 'local';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(() => (isRemote ? emptyDB() : load()));
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('mm-pos-user') ?? 'u-owner');
  // remote-mode auth
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [authReady, setAuthReady] = useState(!isRemote);
  const [authPending, setAuthPending] = useState(isRemote);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (isRemote) {
        localStorage.setItem(KEY_REMOTE, JSON.stringify({ userId: session?.user.id ?? null, orgId: membership?.organization_id ?? null, savedAt: new Date().toISOString(), db }));
      } else {
        localStorage.setItem(KEY, JSON.stringify(db));
      }
    } catch { /* ignore */ }
  }, [db, session, membership]);

  // supabase session lifecycle
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (!s) {
        setMembership(null);
        setAuthPending(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // hydrate from server once we know who the user is
  const hydrate = useCallback(async (user_id: string) => {
    if (!supabase) return;
    setRemoteError(null);
    setAuthPending(true);
    try {
      const m = await fetchMembership(user_id);
      setMembership(m);
      const cached = loadRemoteCache(user_id, m.organization_id);
      if (cached) setDb(cached);
      const h = await fetchAll(m.organization_id, m.branch_id, m);
      setDb((d) => ({
        ...d,
        org: h.org, branch: h.branch,
        categories: h.categories, brands: h.brands, units: h.units,
        products: h.products, stock: h.stock, movements: h.movements,
        suppliers: h.suppliers, purchases: h.purchases, purchaseItems: h.purchaseItems,
        sales: h.sales, saleItems: h.saleItems, returns: h.returns,
        customers: h.customers, sessions: h.sessions, expenses: h.expenses, audit: h.audit,
      }));
    } catch (e) {
      setRemoteError(friendly(e));
    } finally {
      setAuthPending(false);
    }
  }, []);

  useEffect(() => {
    if (!isRemote) return;
    if (session?.user) void hydrate(session.user.id);
    else { setMembership(null); setDb(emptyDB()); }
  }, [session, hydrate]);

  const user = useMemo<DemoUser | null>(() => {
    if (isRemote) {
      if (!session?.user || !membership) return null;
      const email = session.user.email ?? '';
      const meta = session.user.user_metadata as Record<string, unknown> | null;
      const name = typeof meta?.name === 'string' && meta.name ? meta.name : email.split('@')[0];
      return { id: session.user.id, email, name, role: membership.role };
    }
    return DEMO_USERS.find((u) => u.id === userId) ?? null;
  }, [userId, session, membership]);

  const audit = useCallback((action: string, entity_type: string, entity_id: string, extra?: { old?: unknown; next?: unknown }) => {
    const entry = { id: isRemote ? rid() : uid('a'), organization_id: isRemote ? (membership?.organization_id ?? '') : ORG_ID, user_id: isRemote ? (session?.user.id ?? 'system') : (userId ?? 'system'), action, entity_type, entity_id, old_values: extra?.old, new_values: extra?.next, created_at: todayISO() };
    setDb((d) => ({ ...d, audit: [entry as AuditLog, ...d.audit].slice(0, 500) }));
    if (isRemote && membership && session?.user) {
      insertAudit(entry.organization_id, session.user.id, action, entity_type, entity_id, extra?.next).catch(() => { /* toast at call site */ });
    }
  }, [userId, membership, session]);

  const save = useCallback((patch: Partial<DB>) => {
    setDb((d) => ({ ...d, ...patch }));
  }, []);

  const login = useCallback((email: string) => {
    const u = DEMO_USERS.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!u) return false;
    setUserId(u.id);
    localStorage.setItem('mm-pos-user', u.id);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUserId(null);
    localStorage.removeItem('mm-pos-user');
  }, []);

  // ── remote auth (Supabase Auth + membership) ──
  const supaLogin = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return 'Supabase is not configured';
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return mapAuthError(error.message);
    if (!data.user) return 'Sign-in failed — try again';
    try {
      await fetchMembership(data.user.id);
      return null;
    } catch (e) {
      await supabase.auth.signOut();
      return friendly(e);
    }
  }, []);

  const supaLogout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setMembership(null);
    setDb(emptyDB());
  }, []);

  const refreshRemote = useCallback(async () => {
    if (!isRemote || !session?.user) return;
    await hydrate(session.user.id);
  }, [session, hydrate]);

  // client id shared by local state + server row in remote mode
  const nid = (_prefix: string): string => (isRemote ? rid() : uid(_prefix));
  const syncErr = (e: unknown): void => {
    toast.error('Saved locally — cloud sync failed: ' + friendly(e));
  };

  const rctx = (): PersistCtx | null =>
    isRemote && membership
      ? { org: membership.organization_id, branch: membership.branch_id, by: session?.user.id ?? null }
      : null;

  const resetDemo = useCallback(() => {
    const fresh = seedDB();
    setDb(fresh);
    try { localStorage.setItem(KEY, JSON.stringify(fresh)); } catch { /* ignore */ }
  }, []);

  const stockMap = useMemo(() => new Map(db.stock.map((s) => [s.product_id, s])), [db.stock]);

  const stockOf = useCallback((pid: string) => stockMap.get(pid)?.quantity ?? 0, [stockMap]);

  const lowStock = useMemo(() => {
    const out: { product: Product; qty: number }[] = [];
    for (const p of db.products) {
      if (!p.is_active || !p.track_stock) continue;
      const q = stockMap.get(p.id)?.quantity ?? 0;
      if (q <= p.reorder_level) out.push({ product: p, qty: q });
    }
    return out.sort((a, b) => a.qty - b.qty);
  }, [db.products, stockMap]);

  const createSale: Store['createSale'] = useCallback((args) => {
    const ctx = rctx();
    if (isRemote && ctx) {
      return (async (): Promise<Sale> => {
        const saleId = await rpcCreateSale({
          org: ctx.org, branch: ctx.branch,
          customer: args.customer_id ?? null,
          payments: args.payments, discount: args.discount,
          items: args.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price, discount: l.discount })),
          register: db.sessions.find((s) => s.status === 'open')?.id ?? null,
        });
        const { sale, items } = await fetchSale(saleId);
        const at = sale.sold_at;
        const movs: StockMovement[] = items.map((it) => ({
          id: rid(), organization_id: ctx.org, branch_id: ctx.branch,
          product_id: it.product_id, movement_type: 'sale', quantity: -it.quantity,
          unit_cost: it.cost_price, reference_type: 'sale', reference_id: saleId,
          created_by: ctx.by ?? 'system', created_at: at,
        }));
        setDb((d) => ({
          ...d,
          sales: [sale, ...d.sales], saleItems: [...items, ...d.saleItems],
          movements: [...movs, ...d.movements],
          stock: d.stock.map((s) => {
            const line = args.lines.find((l) => l.product_id === s.product_id);
            return line ? { ...s, quantity: s.quantity - line.quantity, updated_at: at } : s;
          }),
          customers: d.customers.map((c) =>
            c.id === args.customer_id
              ? { ...c, loyalty_points: c.loyalty_points + Math.floor(sale.total / 100), current_balance: c.current_balance + sale.due_amount, updated_at: at }
              : c,
          ),
          audit: [{ id: rid(), organization_id: ctx.org, user_id: ctx.by ?? 'system', action: 'sale.created', entity_type: 'sale', entity_id: saleId, new_values: { total: sale.total }, created_at: at }, ...d.audit].slice(0, 500),
        }));
        insertAudit(ctx.org, ctx.by, 'sale.created', 'sale', saleId, { total: sale.total }).catch(() => {});
        return sale;
      })();
    }
    const prodMap = new Map(db.products.map((p) => [p.id, p]));
    const subtotal = args.lines.reduce((s, l) => {
      const p = prodMap.get(l.product_id);
      return s + (p ? l.unit_price * l.quantity - l.discount : 0);
    }, 0);
    const total = Math.max(0, subtotal - args.discount);
    const paid = args.payments.reduce((s, p) => s + p.amount, 0);
    const id = uid('sale');
    const seq = db.seqSale;
    const sale: Sale = {
      id, organization_id: ORG_ID, branch_id: BRANCH_ID,
      register_session_id: db.sessions.find((s) => s.status === 'open')?.id ?? null,
      customer_id: args.customer_id ?? null,
      invoice_number: invoiceNo(seq),
      status: paid >= total ? 'completed' : paid > 0 ? 'partially_paid' : 'credit',
      subtotal, discount: args.discount, tax: 0, total,
      paid_amount: paid, due_amount: Math.max(0, total - paid),
      change_amount: Math.max(0, paid - total),
      payments: args.payments, cashier_id: userId ?? 'u-cashier',
      sold_at: todayISO(), notes: args.notes,
    };
    const items: SaleItem[] = args.lines.map((l) => {
      const p = prodMap.get(l.product_id)!;
      return {
        id: uid('si'), sale_id: id, product_id: l.product_id, quantity: l.quantity,
        unit_price: l.unit_price, cost_price: p.cost_price, discount: l.discount,
        tax: 0, total: l.unit_price * l.quantity - l.discount,
      };
    });
    const movs: StockMovement[] = args.lines.map((l) => {
      const p = prodMap.get(l.product_id)!;
      return {
        id: uid('mv'), organization_id: ORG_ID, branch_id: BRANCH_ID,
        product_id: l.product_id, movement_type: 'sale', quantity: -l.quantity,
        unit_cost: p.cost_price, reference_type: 'sale', reference_id: id,
        created_by: userId ?? 'u-cashier', created_at: sale.sold_at,
      };
    });
    setDb((d) => {
      const nextStock = d.stock.map((s) => {
        const line = args.lines.find((l) => l.product_id === s.product_id);
        if (!line) return s;
        return { ...s, quantity: s.quantity - line.quantity, updated_at: sale.sold_at };
      });
      // loyalty: 1 pt per 100 MMK
      const nextCustomers = d.customers.map((c) =>
        c.id === args.customer_id
          ? { ...c, loyalty_points: c.loyalty_points + Math.floor(total / 100), current_balance: c.current_balance + Math.max(0, total - paid), updated_at: sale.sold_at }
          : c,
      );
      return {
        ...d, seqSale: d.seqSale + 1,
        sales: [sale, ...d.sales], saleItems: [...items, ...d.saleItems],
        movements: [...movs, ...d.movements], stock: nextStock, customers: nextCustomers,
        audit: [{ id: uid('a'), organization_id: ORG_ID, user_id: userId ?? 'system', action: 'sale.created', entity_type: 'sale', entity_id: id, new_values: { total }, created_at: sale.sold_at }, ...d.audit].slice(0, 500),
      };
    });
    return sale;
  }, [db.products, db.seqSale, db.sessions, userId, membership, session]);

  const createReturn: Store['createReturn'] = useCallback((saleId, items, refundMethod) => {
    const sale = db.sales.find((s) => s.id === saleId);
    if (!sale) return;
    const prodMap = new Map(db.products.map((p) => [p.id, p]));
    const refund = items.reduce((s, it) => {
      const p = prodMap.get(it.product_id);
      const si = db.saleItems.find((x) => x.sale_id === saleId && x.product_id === it.product_id);
      return s + (si ? si.unit_price * it.quantity : (p?.selling_price ?? 0) * it.quantity);
    }, 0);
    const ctx = rctx();
    const ret: SaleReturn = { id: nid('rt'), sale_id: saleId, items, refund_amount: refund, refund_method: refundMethod, created_by: userId ?? 'u-cashier', created_at: todayISO() };
    const movs: StockMovement[] = items.map((it) => ({
      id: nid('mv'), organization_id: ctx?.org ?? ORG_ID, branch_id: ctx?.branch ?? BRANCH_ID, product_id: it.product_id,
      movement_type: 'sale_return', quantity: it.quantity, unit_cost: prodMap.get(it.product_id)?.cost_price ?? 0,
      reference_type: 'sale_return', reference_id: ret.id, notes: it.reason,
      created_by: userId ?? 'u-cashier', created_at: ret.created_at,
    }));
    if (ctx) {
      const after = movs.map((m) => ({ product_id: m.product_id, quantity: stockOf(m.product_id) + m.quantity }));
      persistReturn(ctx, ret, movs, after).catch(syncErr);
    }
    setDb((d) => ({
      ...d,
      returns: [ret, ...d.returns],
      movements: [...movs, ...d.movements],
      stock: d.stock.map((s) => {
        const it = items.find((i) => i.product_id === s.product_id);
        return it ? { ...s, quantity: s.quantity + it.quantity, updated_at: ret.created_at } : s;
      }),
      audit: [{ id: nid('a'), organization_id: ctx?.org ?? ORG_ID, user_id: userId ?? 'system', action: 'sale.refunded', entity_type: 'sale', entity_id: saleId, new_values: { refund }, created_at: ret.created_at }, ...d.audit].slice(0, 500),
    }));
  }, [db.products, db.saleItems, db.sales, db.stock, userId, membership, session]);

  const adjustStock: Store['adjustStock'] = useCallback((productId, diff, notes) => {
    const p = db.products.find((x) => x.id === productId);
    if (!p) return;
    const now = todayISO();
    const ctx = rctx();
    const newQty = Math.max(0, stockOf(productId) + diff);
    const mm: StockMovement = {
      id: nid('mv'), organization_id: ctx?.org ?? ORG_ID, branch_id: ctx?.branch ?? BRANCH_ID, product_id: productId,
      movement_type: diff >= 0 ? 'adjustment_in' : 'adjustment_out', quantity: diff,
      unit_cost: p.cost_price, reference_type: 'adjustment', reference_id: nid('adj'),
      notes, created_by: userId ?? 'system', created_at: now,
    };
    if (ctx) persistAdjust(ctx, productId, newQty, mm).catch(syncErr);
    setDb((d) => ({
      ...d,
      stock: d.stock.map((s) => (s.product_id === productId ? { ...s, quantity: Math.max(0, s.quantity + diff), updated_at: now } : s)),
      movements: [mm, ...d.movements],
      audit: [{ id: nid('a'), organization_id: ctx?.org ?? ORG_ID, user_id: userId ?? 'system', action: 'stock.adjusted', entity_type: 'product', entity_id: productId, new_values: { diff, notes }, created_at: now }, ...d.audit].slice(0, 500),
    }));
  }, [db.products, userId, membership, session, stockOf]);

  const receivePurchase: Store['receivePurchase'] = useCallback((po, items) => {
    const ctx = rctx();
    const id = nid('po');
    const order: PurchaseOrder = { ...po, id, purchase_number: poNo(db.seqPO) };
    if (ctx) { order.organization_id = ctx.org; order.branch_id = ctx.branch; }
    const pis: PurchaseItem[] = items.map((it) => ({ ...it, id: nid('pi'), purchase_order_id: id }));
    const now = todayISO();
    // stock moves only when goods are actually received — drafts/orders don't touch inventory
    const received = order.status === 'received' || order.status === 'partially_received';
    const movs: StockMovement[] = received ? pis.map((it) => ({
      id: nid('mv'), organization_id: ctx?.org ?? ORG_ID, branch_id: order.branch_id, product_id: it.product_id,
      movement_type: 'purchase', quantity: it.received_quantity || it.quantity, unit_cost: it.unit_cost,
      reference_type: 'purchase', reference_id: id, created_by: userId ?? 'system', created_at: now,
    })) : [];
    setDb((d) => ({
      ...d, seqPO: d.seqPO + 1,
      purchases: [{ ...order, received_at: received ? now : order.received_at }, ...d.purchases],
      purchaseItems: [...pis, ...d.purchaseItems],
      movements: [...movs, ...d.movements],
      stock: received ? d.stock.map((s) => {
        const it = pis.find((p) => p.product_id === s.product_id);
        return it ? { ...s, quantity: s.quantity + (it.received_quantity || it.quantity), average_cost: it.unit_cost, updated_at: now } : s;
      }) : d.stock,
      audit: [{ id: nid('a'), organization_id: ctx?.org ?? ORG_ID, user_id: userId ?? 'system', action: received ? 'purchase.received' : 'purchase.created', entity_type: 'purchase', entity_id: id, new_values: { total: order.total, status: order.status }, created_at: now }, ...d.audit].slice(0, 500),
    }));
    if (ctx) {
      const after = movs.map((m) => {
        const cur = stockOf(m.product_id);
        const prod = db.products.find((x) => x.id === m.product_id);
        return { product_id: m.product_id, quantity: cur + m.quantity, average_cost: prod?.cost_price ?? m.unit_cost };
      });
      persistPurchase({ ...ctx, branch: order.branch_id }, { ...order, organization_id: ctx.org }, pis, movs, after).catch(syncErr);
    }
    return order;
  }, [db.seqPO, db.products, userId, membership, session, stockOf]);

  const updatePurchaseStatus: Store['updatePurchaseStatus'] = useCallback((id, status) => {
    const order = db.purchases.find((p) => p.id === id);
    if (!order) return;
    const now = todayISO();
    const by = isRemote && session?.user ? session.user.id : (userId ?? 'system');
    const ctx = rctx();
    // receiving later (draft → received) applies the stock exactly once
    const shouldApply = (status === 'received' || status === 'partially_received') && !order.received_at;
    const items = db.purchaseItems.filter((i) => i.purchase_order_id === id);
    const movs: StockMovement[] = shouldApply ? items.map((it) => ({
      id: nid('mv'), organization_id: ctx?.org ?? order.organization_id, branch_id: order.branch_id, product_id: it.product_id,
      movement_type: 'purchase', quantity: it.received_quantity || it.quantity, unit_cost: it.unit_cost,
      reference_type: 'purchase', reference_id: id, created_by: by, created_at: now,
    })) : [];
    const after = shouldApply ? movs.map((m) => {
      const cur = db.stock.find((s) => s.product_id === m.product_id)?.quantity ?? 0;
      const prod = db.products.find((x) => x.id === m.product_id);
      return { product_id: m.product_id, quantity: cur + m.quantity, average_cost: prod?.cost_price ?? m.unit_cost };
    }) : [];
    setDb((d) => ({
      ...d,
      purchases: d.purchases.map((p) => (p.id === id ? { ...p, status, received_at: shouldApply ? now : p.received_at } : p)),
      movements: [...movs, ...d.movements],
      stock: shouldApply ? d.stock.map((s) => {
        const it = items.find((x) => x.product_id === s.product_id);
        return it ? { ...s, quantity: s.quantity + (it.received_quantity || it.quantity), average_cost: it.unit_cost, updated_at: now } : s;
      }) : d.stock,
      audit: [{ id: nid('a'), organization_id: ctx?.org ?? order.organization_id, user_id: by, action: 'purchase.status', entity_type: 'purchase', entity_id: id, old_values: { status: order.status }, new_values: { status }, created_at: now }, ...d.audit].slice(0, 500),
    }));
    if (ctx) persistPurchaseStatus(ctx, id, status, shouldApply ? now : order.received_at ?? null, movs, after).catch(syncErr);
  }, [db.purchases, db.purchaseItems, db.stock, db.products, userId, membership, session]);

  const upsertProduct: Store['upsertProduct'] = useCallback((p) => {
    const ctx = rctx();
    const np = ctx ? { ...p, organization_id: ctx.org } : p;
    const sbRow: StockBalance = { id: nid('sb'), organization_id: ctx?.org ?? ORG_ID, branch_id: ctx?.branch ?? BRANCH_ID, product_id: np.id, quantity: 0, reserved_quantity: 0, average_cost: np.cost_price, updated_at: todayISO() };
    setDb((d) => {
      const exists = d.products.some((x) => x.id === np.id);
      return {
        ...d,
        products: exists ? d.products.map((x) => (x.id === np.id ? np : x)) : [np, ...d.products],
        stock: exists ? d.stock : [...d.stock, sbRow],
      };
    });
    if (ctx) {
      const exists = db.products.some((x) => x.id === np.id);
      persistProduct(ctx, np, !exists, exists ? undefined : sbRow).catch(syncErr);
    }
  }, [db.products, membership, session]);

  const deleteProduct: Store['deleteProduct'] = useCallback((id) => {
    setDb((d) => ({ ...d, products: d.products.map((p) => (p.id === id ? { ...p, is_active: false } : p)) }));
    const ctx = rctx();
    if (ctx) updateRow('products', id, { is_active: false }).catch(syncErr);
  }, [membership, session]);

  const upsertCustomer: Store['upsertCustomer'] = useCallback((c) => {
    const ctx = rctx();
    const nc = ctx ? { ...c, organization_id: ctx.org } : c;
    const isNew = !db.customers.some((x) => x.id === nc.id);
    setDb((d) => {
      const exists = d.customers.some((x) => x.id === nc.id);
      return { ...d, customers: exists ? d.customers.map((x) => (x.id === nc.id ? nc : x)) : [nc, ...d.customers] };
    });
    if (ctx) persistCustomer(ctx, nc, isNew).catch(syncErr);
  }, [db.customers, membership, session]);

  const upsertSupplier: Store['upsertSupplier'] = useCallback((s) => {
    const ctx = rctx();
    const ns = ctx ? { ...s, organization_id: ctx.org } : s;
    const isNew = !db.suppliers.some((x) => x.id === ns.id);
    setDb((d) => {
      const exists = d.suppliers.some((x) => x.id === ns.id);
      return { ...d, suppliers: exists ? d.suppliers.map((x) => (x.id === ns.id ? ns : x)) : [ns, ...d.suppliers] };
    });
    if (ctx) persistSupplier(ctx, ns, isNew).catch(syncErr);
  }, [db.suppliers, membership, session]);

  // collect an outstanding customer due — closes the credit-sale loop
  const collectDue: Store['collectDue'] = useCallback((customerId, amount, method) => {
    const now = todayISO();
    const by = isRemote && session?.user ? session.user.id : (userId ?? 'system');
    const c = db.customers.find((x) => x.id === customerId);
    if (!c || amount <= 0) return;
    const paid = Math.min(amount, c.current_balance);
    const ctx = rctx();
    if (ctx) persistDue(ctx, customerId, c.current_balance - paid).catch(syncErr);
    setDb((d) => ({
      ...d,
      customers: d.customers.map((x) => (x.id === customerId ? { ...x, current_balance: x.current_balance - paid, updated_at: now } : x)),
      audit: [{ id: nid('a'), organization_id: ctx?.org ?? ORG_ID, user_id: by, action: 'customer.due_collected', entity_type: 'customer', entity_id: customerId, new_values: { paid, method }, created_at: now }, ...d.audit].slice(0, 500),
    }));
  }, [db.customers, userId, membership, session]);

  const holdSale: Store['holdSale'] = useCallback((h) => {
    setDb((d) => ({ ...d, held: [...d.held, { ...h, id: uid('held'), held_at: todayISO() }] }));
  }, []);

  const resumeHeld: Store['resumeHeld'] = useCallback((id) => {
    const h = db.held.find((x) => x.id === id) ?? null;
    if (h) setDb((d) => ({ ...d, held: d.held.filter((x) => x.id !== id) }));
    return h;
  }, [db.held]);

  const removeHeld: Store['removeHeld'] = useCallback((id) => {
    setDb((d) => ({ ...d, held: d.held.filter((x) => x.id !== id) }));
  }, []);

  const openRegister: Store['openRegister'] = useCallback((openingCash) => {
    const ctx = rctx();
    const s: RegisterSession = {
      id: nid('reg'), organization_id: ctx?.org ?? ORG_ID, branch_id: ctx?.branch ?? BRANCH_ID,
      user_id: ctx?.by ?? userId ?? 'u-cashier',
      opening_cash: openingCash, opened_at: todayISO(), status: 'open', cash_in: 0, cash_out: 0,
    };
    setDb((d) => ({ ...d, sessions: [s, ...d.sessions] }));
    if (ctx) persistSessionOpen(ctx, s).catch(syncErr);
    return s;
  }, [userId, membership, session]);

  const closeRegister: Store['closeRegister'] = useCallback((closingCash) => {
    const open = db.sessions.find((s) => s.status === 'open');
    if (!open) return;
    const now = todayISO();
    const cashSales = db.sales
      .filter((s) => s.sold_at >= open.opened_at && s.payments.some((p) => p.method === 'cash'))
      .reduce((sum, s) => sum + s.payments.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0), 0);
    const expected = open.opening_cash + cashSales + (open.cash_in ?? 0) - (open.cash_out ?? 0);
    const patch = { closing_cash: closingCash, expected_cash: expected, cash_difference: closingCash - expected, closed_at: now };
    setDb((d) => ({
      ...d,
      sessions: d.sessions.map((s) => (s.id === open.id ? { ...s, status: 'closed' as const, ...patch } : s)),
    }));
    if (rctx()) persistSessionClose(open.id, patch).catch(syncErr);
  }, [db.sessions, db.sales, membership, session]);

  const addExpense: Store['addExpense'] = useCallback((e) => {
    const ctx = rctx();
    const ne: Expense = {
      ...e, id: nid('ex'),
      organization_id: ctx?.org ?? e.organization_id,
      branch_id: ctx?.branch ?? e.branch_id,
      created_by: ctx?.by ?? e.created_by,
    };
    setDb((d) => ({ ...d, expenses: [ne, ...d.expenses] }));
    if (ctx) persistExpense(ctx, ne).catch(syncErr);
  }, [membership, session]);

  const addMovement: Store['addMovement'] = useCallback((m) => {
    setDb((d) => ({ ...d, movements: [{ ...m, id: uid('mv'), created_at: todayISO() }, ...d.movements] }));
  }, []);

  const rolePerms = useMemo<string[]>(() => {
    if (isRemote) return membership?.perms ?? [];
    const r = DEMO_USERS.find((u) => u.id === userId)?.role;
    return r ? GRANTS[r] : [];
  }, [userId, membership]);

  const canDo = useCallback((perm: string): boolean => {
    if (rolePerms.includes('*')) return true;
    return rolePerms.includes(perm);
  }, [rolePerms]);

  const value: Store = {
    db, user, mode, authReady, authPending, remoteError, rolePerms, canDo,
    login, logout, supaLogin, supaLogout, refreshRemote,
    resetDemo, stockOf, lowStock,
    createSale, createReturn, adjustStock, receivePurchase, updatePurchaseStatus,
    upsertProduct, deleteProduct, upsertCustomer, upsertSupplier, collectDue, holdSale, resumeHeld, removeHeld,
    openRegister, closeRegister, addExpense, addMovement, audit, save,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
