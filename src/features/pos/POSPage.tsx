import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Plus, Minus, Trash2, Pause, Play, Printer, RotateCcw, X,
  Banknote, CreditCard, Smartphone, Landmark, NotebookText,
  ShoppingCart, UserRound, CornerDownLeft,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { CartLine, Customer, PaymentMethod, Product, Sale } from '../../types';
import { useStore } from '../../store/AppStore';
import { fmtMoney } from '../../lib/formatters';
import { publishDisplay } from '../../lib/display-sync';

import { cn } from '../../lib/utils';
import { Button, Card, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Modal } from '../../components/ui';
import { toast } from 'sonner';

const METHODS: { id: PaymentMethod; label: string; hint: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Cash', hint: 'Notes & coins', icon: Banknote },
  { id: 'mobile_wallet', label: 'Mobile wallet', hint: 'KBZPay / Wave', icon: Smartphone },
  { id: 'card', label: 'Card', hint: 'Debit / credit', icon: CreditCard },
  { id: 'bank_transfer', label: 'Bank transfer', hint: 'Direct transfer', icon: Landmark },
  { id: 'credit', label: 'On credit', hint: 'Pay later', icon: NotebookText },
];

const QUICK_CASH = [1000, 5000, 10000, 20000, 50000];

export function POSPage() {
  const { db, user, canDo, stockOf, createSale, holdSale, resumeHeld, removeHeld } = useStore();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [payments, setPayments] = useState<{ method: PaymentMethod; amount: number }[]>([{ method: 'cash', amount: 0 }]);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [showHeld, setShowHeld] = useState(location.pathname.endsWith('/held'));
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (location.pathname.endsWith('/held')) setShowHeld(true);
  }, [location.pathname]);
  const closeHeld = () => {
    setShowHeld(false);
    if (location.pathname.endsWith('/held')) navigate('/pos');
  };

  const prodMap = useMemo(() => new Map(db.products.map((p) => [p.id, p])), [db.products]);

  // "/" focuses search anywhere; Enter quick-adds first match
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of db.products) {
      if (!p.is_active) continue;
      m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1);
    }
    return m;
  }, [db.products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.products
      .filter((p) => p.is_active)
      .filter((p) => (cat === 'all' ? true : p.category_id === cat))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 48);
  }, [db.products, query, cat]);

  const lines = useMemo(
    () => cart.map((l) => ({ ...l, product: prodMap.get(l.product_id)! })).filter((l) => l.product),
    [cart, prodMap],
  );
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity - l.discount, 0);
  const total = Math.max(0, subtotal - cartDiscount);
  const paidSum = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const remaining = Math.max(0, total - paidSum);

  const add = (p: Product) => {
    const stock = stockOf(p.id);
    const inCart = cart.find((l) => l.product_id === p.id)?.quantity ?? 0;
    if (p.track_stock && !p.allow_negative_stock && inCart + 1 > stock) {
      toast.error(`Only ${stock} in stock — ${p.name}`);
      return;
    }
    setCart((c) => {
      const ex = c.find((l) => l.product_id === p.id);
      if (ex) return c.map((l) => (l.product_id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { product_id: p.id, quantity: 1, unit_price: p.selling_price, discount: 0 }];
    });
    setJustAdded(p.id);
    window.setTimeout(() => setJustAdded((id) => (id === p.id ? null : id)), 450);
  };

  const setQty = (pid: string, qty: number) => {
    if (qty <= 0) return setCart((c) => c.filter((l) => l.product_id !== pid));
    const p = prodMap.get(pid)!;
    if (p.track_stock && !p.allow_negative_stock && qty > stockOf(pid)) {
      toast.error(`Only ${stockOf(pid)} in stock`);
      return;
    }
    setCart((c) => c.map((l) => (l.product_id === pid ? { ...l, quantity: qty } : l)));
  };

  const setPrice = (pid: string, price: number) => {
    if (!user || !canDo('sales.price_override')) { toast.error('Price override needs manager permission'); return; }
    const p = prodMap.get(pid)!;
    if (price < (p.minimum_price ?? 0)) { toast.error(`Below minimum ${fmtMoney(p.minimum_price ?? 0)}`); return; }
    setCart((c) => c.map((l) => (l.product_id === pid ? { ...l, unit_price: price } : l)));
  };

  const checkout = () => {
    if (!cart.length) return;
    setPayments([{ method: 'cash', amount: total }]);
    setPayOpen(true);
  };

  const [paying, setPaying] = useState(false);
  const confirmPay = async () => {
    if (paying) return;
    if (paidSum < total && !payments.some((p) => p.method === 'credit')) {
      toast.error(`Short by ${fmtMoney(total - paidSum)} — add payment or use On credit`);
      return;
    }
    setPaying(true);
    try {
      const sale = await createSale({ lines: cart, customer_id: customerId, discount: cartDiscount, payments });
      publishDisplay({
        status: 'complete',
        lines: [], subtotal, discount: cartDiscount, total, itemCount,
        customerName: customer?.name ?? null,
        invoice: sale.invoice_number,
        change: sale.change_amount,
        methods: sale.payments.map((pm: { method: string }) => pm.method),
      });
      setReceipt(sale);
      setCart([]); setCartDiscount(0); setCustomerId(null); setPayOpen(false);
      toast.success(`Sale ${sale.invoice_number} completed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed — sale was not recorded');
    } finally {
      setPaying(false);
    }
  };

  const hold = () => {
    if (!cart.length) return;
    holdSale({ cart, customer_id: customerId, discount: cartDiscount, held_by: user?.id ?? '?' });
    setCart([]); setCartDiscount(0); setCustomerId(null);
    toast.success('Sale held — resume it anytime');
  };

  const customer: Customer | null = db.customers.find((c) => c.id === customerId) ?? null;
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  // live customer display (second window / Supabase Realtime)
  useEffect(() => {
    publishDisplay({
      status: payOpen ? 'paying' : lines.length > 0 ? 'cart' : 'idle',
      lines: lines.map((l) => ({ name: l.product.name, qty: l.quantity, total: l.unit_price * l.quantity - l.discount })),
      subtotal, discount: cartDiscount, total, itemCount,
      customerName: customer?.name ?? null,
    });
  }, [lines, subtotal, cartDiscount, total, itemCount, customer, payOpen]);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="grid min-h-0 w-full min-w-0 flex-1 gap-2.5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── catalog ── */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
          <div className="relative">
            <Search size={16} aria-hidden className="absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length > 0) { add(filtered[0]); setQuery(''); }
              }}
              placeholder="Search name, SKU, or scan barcode…"
              className="h-11 rounded-xl pr-24 pl-10 text-[14px] shadow-xs"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 items-center gap-1 text-[11px] text-zinc-400 sm:flex">
              <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono dark:border-zinc-700 dark:bg-zinc-900">Enter</kbd>
              quick add
            </span>
          </div>

          <div className="flex w-full min-w-0 gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Categories">
            <CatPill active={cat === 'all'} onClick={() => setCat('all')} label="All" count={db.products.filter((p) => p.is_active).length} />
            {db.categories.map((c) => (
              <CatPill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.name} count={counts.get(c.id) ?? 0} />
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-14 text-center dark:border-zinc-700 dark:bg-zinc-950">
              <Search size={20} aria-hidden className="mx-auto text-zinc-300 dark:text-zinc-600" />
              <p className="mt-2 text-[13px] font-medium">No products match “{query}”</p>
              <p className="text-xs text-zinc-500">Try a different name, SKU, or barcode</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto pb-1">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((p, i) => {
                const st = stockOf(p.id);
                const out = st <= 0 && p.track_stock;
                const low = !out && st <= p.reorder_level;
                const fillPct = Math.max(6, Math.min(100, Math.round((st / Math.max(1, p.reorder_level * 3)) * 100)));
                return (
                  <button
                    key={p.id}
                    onClick={() => add(p)}
                    disabled={out}
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                    className={cn(
                      'group min-w-0 animate-in fade-in slide-in-from-bottom-2 cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-white p-2.5 text-left shadow-xs transition-all duration-200 outline-none fill-mode-both',
                      'hover:-translate-y-0.5 hover:border-zinc-900 hover:shadow-md focus-visible:ring-2 focus-visible:ring-zinc-950 active:translate-y-0 active:scale-[.98]',
                      'dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-100',
                      out && 'cursor-not-allowed opacity-45 hover:translate-y-0 hover:shadow-xs',
                      justAdded === p.id && 'border-zinc-900 shadow-md dark:border-zinc-100',
                    )}
                  >
                    <span className="flex items-start justify-between gap-1.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] leading-snug font-semibold">{p.name}</span>
                        <span className="block truncate font-mono text-[11px] text-zinc-400">{p.sku}</span>
                      </span>
                      <span
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white transition-transform duration-200 group-hover:scale-110 group-active:scale-95 dark:bg-zinc-50 dark:text-zinc-950',
                          justAdded === p.id && 'scale-125',
                        )}
                        aria-hidden
                      >
                        <Plus size={14} />
                      </span>
                    </span>
                    <span className="mt-1.5 flex items-end justify-between gap-2">
                      <span className="text-[13px] font-bold tabular-nums">{fmtMoney(p.selling_price)}</span>
                      {out ? (
                        <Badge tone="red">Out</Badge>
                      ) : low ? (
                        <Badge tone="amber">{st} left</Badge>
                      ) : (
                        <span className="text-[11px] text-zinc-400 tabular-nums">{st}</span>
                      )}
                    </span>
                    {!out && (
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
                        <span
                          className={cn('block h-full rounded-full transition-all duration-300', low ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-600')}
                          style={{ width: `${fillPct}%` }}
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="pt-1.5 text-[11px] text-zinc-400">
              Showing {filtered.length} products · press <kbd className="rounded border border-zinc-200 bg-white px-1 font-mono dark:border-zinc-700 dark:bg-zinc-900">/</kbd> to search
            </p>
            </div>
          )}
        </div>

        {/* ── cart ── */}

        {/* ── cart ── */}
        <Card className="flex max-h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3.5 py-2.5 dark:border-zinc-800">
            <div className="min-w-0">
              <p className="text-[13px] font-bold">Current sale</p>
              <p className="text-[11px] text-zinc-500">{itemCount} item{itemCount === 1 ? '' : 's'} · {lines.length} lines</p>
            </div>
            <div className="relative ml-auto w-40">
              <UserRound size={13} aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-400" />
              <Select value={customerId ?? 'walkin'} onValueChange={(v) => setCustomerId(v === 'walkin' ? null : v)}>
                <SelectTrigger className="h-8 pl-7 text-xs" aria-label="Customer">
                  <SelectValue placeholder="Walk-in" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walkin">Walk-in</SelectItem>
                  {db.customers.filter((c) => c.id !== 'cu-walkin').slice(0, 100).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {customer && (
            <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-3.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="font-semibold">{customer.name}</span>
              <Badge tone="blue">{customer.loyalty_points} pts</Badge>
              {customer.current_balance > 0 && (
                <span className="ml-auto font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                  owes {fmtMoney(customer.current_balance)}
                </span>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-1.5 overflow-auto p-2.5">
            {lines.length === 0 && (
              <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-xl bg-zinc-50 py-10 text-center dark:bg-zinc-900">
                <ShoppingCart size={22} aria-hidden className="text-zinc-300 dark:text-zinc-600" />
                <p className="mt-2 text-[13px] font-medium text-zinc-600 dark:text-zinc-300">Cart is empty</p>
                <p className="text-xs text-zinc-400">Tap any product to add it here</p>
              </div>
            )}
            {lines.map((l) => (
              <div
                key={l.product_id}
                className="animate-in slide-in-from-right-2 fade-in rounded-xl border border-zinc-200 bg-white p-2 duration-200 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-[13px] leading-snug font-semibold">{l.product.name}</p>
                  <button
                    onClick={() => setCart((c) => c.filter((x) => x.product_id !== l.product_id))}
                    aria-label={`Remove ${l.product.name}`}
                    className="cursor-pointer rounded-md p-1 text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-1">
                  <Stepper onMinus={() => setQty(l.product_id, l.quantity - 1)} onPlus={() => setQty(l.product_id, l.quantity + 1)}>
                    <input
                      value={l.quantity}
                      onChange={(e) => setQty(l.product_id, Number(e.target.value) || 0)}
                      aria-label="Quantity"
                      className="h-7 w-10 border-x border-zinc-200 bg-transparent text-center text-[13px] font-semibold tabular-nums outline-none dark:border-zinc-700"
                    />
                  </Stepper>
                  <span className="text-[11px] text-zinc-400">×</span>
                  <input
                    value={l.unit_price}
                    onChange={(e) => setPrice(l.product_id, Number(e.target.value) || 0)}
                    aria-label="Unit price"
                    title="Unit price (manager override)"
                    className="h-7 w-20 rounded-md border border-transparent bg-transparent px-1 text-right text-[13px] tabular-nums outline-none transition-colors hover:border-zinc-200 focus:border-zinc-900 dark:hover:border-zinc-700"
                  />
                  <span className="ml-auto text-[13px] font-bold tabular-nums">{fmtMoney(l.unit_price * l.quantity - l.discount)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1 border-t border-zinc-200 bg-zinc-50/60 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between text-[13px] text-zinc-500">
              <span>Subtotal</span>
              <span className="font-semibold text-zinc-800 tabular-nums dark:text-zinc-200">{fmtMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px] text-zinc-500">
              <span>Discount{user && !canDo('sales.discount') ? ' · manager only' : ''}</span>
              <span className="flex items-center gap-1">
                <Input
                  value={cartDiscount || ''}
                  onChange={(e) => {
                    if (user && !canDo('sales.discount')) { toast.error('Discount needs manager permission'); return; }
                    setCartDiscount(Number(e.target.value) || 0);
                  }}
                  placeholder="0"
                  inputMode="numeric"
                  aria-label="Cart discount"
                  className="h-7 w-24 text-right tabular-nums"
                />
              </span>
            </div>
            <div className="flex items-end justify-between pt-0.5">
              <span className="pb-1 text-[13px] font-medium text-zinc-500">Total</span>
              <span key={total} className="animate-in fade-in text-2xl font-extrabold tracking-tight tabular-nums duration-200">
                {fmtMoney(total)}
              </span>
            </div>
            <div className="flex gap-1.5 pt-1">
              <Button variant="outline" className="h-10 flex-1" onClick={hold} disabled={!cart.length} title="Hold sale">
                <Pause size={15} /> Hold
              </Button>
              <Button className="h-10 flex-[2] text-[15px] font-bold" onClick={checkout} disabled={!cart.length}>
                <CornerDownLeft size={16} /> Pay · {fmtMoney(total)}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* ── payment ── */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Collect payment" wide>
        <p className="text-center text-3xl font-extrabold tracking-tight tabular-nums">{fmtMoney(total)}</p>
        <p className="mt-0.5 text-center text-xs text-zinc-500">{itemCount} items{customer ? ` · ${customer.name}` : ' · Walk-in'}</p>

        <div className="mt-3 space-y-1.5">
          {payments.map((p, i) => {
            const M = METHODS.find((m) => m.id === p.method)!;
            return (
              <div key={i} className="animate-in slide-in-from-bottom-1 fade-in flex items-center gap-2 rounded-xl border border-zinc-200 p-2 duration-200 dark:border-zinc-700">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950">
                  <M.icon size={16} aria-hidden />
                </span>
                <Select
                  value={p.method}
                  onValueChange={(v) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: v as PaymentMethod } : x)))}
                >
                  <SelectTrigger className="h-9 w-36" aria-label="Payment method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m.id} value={m.id}><span>{m.label}</span><span className="ml-auto pl-4 text-[11px] text-zinc-400">{m.hint}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={p.amount || ''}
                  placeholder="0"
                  autoFocus={i === 0}
                  onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)))}
                  className="h-9 text-right font-semibold tabular-nums"
                  aria-label={`${M.label} amount`}
                />
                {payments.length > 1 && (
                  <Button variant="ghost" onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))} aria-label="Remove payment">
                    <X size={15} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {payments.length === 1 && payments[0].method === 'cash' && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <QuickTender label="Exact" onClick={() => setPayments([{ method: 'cash', amount: total }])} />
            {QUICK_CASH.filter((q) => q >= total).slice(0, 3).map((q) => (
              <QuickTender key={q} label={fmtMoney(q)} onClick={() => setPayments([{ method: 'cash', amount: q }])} />
            ))}
          </div>
        )}

        <button
          onClick={() => setPayments((ps) => [...ps, { method: 'card', amount: remaining }])}
          className="mt-2 w-full cursor-pointer rounded-xl border border-dashed border-zinc-300 py-2 text-[13px] font-medium text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-50"
        >
          + Split payment
        </button>

        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-xl bg-zinc-100 py-2 dark:bg-zinc-900">
            <p className="text-[11px] text-zinc-500">Tendered</p>
            <p className="text-sm font-bold tabular-nums">{fmtMoney(paidSum)}</p>
          </div>
          <div className="rounded-xl bg-zinc-100 py-2 dark:bg-zinc-900">
            <p className="text-[11px] text-zinc-500">Remaining</p>
            <p className="text-sm font-bold tabular-nums">{fmtMoney(remaining)}</p>
          </div>
          <div className="rounded-xl bg-zinc-950 py-2 text-white dark:bg-zinc-50 dark:text-zinc-950">
            <p className="text-[11px] opacity-70">Change</p>
            <p className="text-sm font-bold tabular-nums">{fmtMoney(Math.max(0, paidSum - total))}</p>
          </div>
        </div>

        <Button className="mt-3 h-11 w-full text-[15px] font-bold" onClick={confirmPay} disabled={paying}>
          Confirm payment · {fmtMoney(total)}
        </Button>
      </Modal>

      {/* ── held ── */}
      <Modal open={showHeld} onClose={closeHeld} title={`Held sales (${db.held.length})`}>
        <div className="space-y-1.5">
          {db.held.length === 0 && <p className="py-6 text-center text-[13px] text-zinc-500">Nothing on hold right now.</p>}
          {db.held.map((h) => (
            <div key={h.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-sm dark:border-zinc-700">
              <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 font-bold tabular-nums dark:bg-zinc-800">
                {h.cart.reduce((s, l) => s + l.quantity, 0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{h.cart.length} lines</span>
                <span className="block text-xs text-zinc-400">{new Date(h.held_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · held</span>
              </span>
              <Button variant="outline" onClick={() => { const r = resumeHeld(h.id); if (r) { setCart(r.cart); setCustomerId(r.customer_id ?? null); setCartDiscount(r.discount); } closeHeld(); }}>
                <Play size={14} /> Resume
              </Button>
              <Button variant="ghost" onClick={() => removeHeld(h.id)} aria-label="Discard held sale"><X size={15} /></Button>
            </div>
          ))}
        </div>
      </Modal>

      {/* ── receipt ── */}
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Receipt">
        {receipt && <ReceiptView saleId={receipt.id} />}
      </Modal>
    </div>
  );
}

function CatPill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all duration-200 outline-none active:scale-95',
        active
          ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50',
      )}
    >
      {label}
      <span className={cn(
        'rounded-full px-1.5 text-[11px] tabular-nums',
        active ? 'bg-white/20 dark:bg-zinc-950/10' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
      )}>
        {count}
      </span>
    </button>
  );
}

function Stepper({ children, onMinus, onPlus }: { children: React.ReactNode; onMinus: () => void; onPlus: () => void }) {
  const btn = 'flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-950 active:scale-90 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-50';
  return (
    <span className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
      <button onClick={onMinus} className={btn} aria-label="Decrease quantity"><Minus size={13} aria-hidden /></button>
      {children}
      <button onClick={onPlus} className={btn} aria-label="Increase quantity"><Plus size={13} aria-hidden /></button>
    </span>
  );
}

function QuickTender({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-all hover:border-zinc-900 active:scale-95 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-100"
    >
      {label}
    </button>
  );
}

export function ReceiptView({ saleId }: { saleId: string }) {
  const { db } = useStore();
  const sale = db.sales.find((s) => s.id === saleId)!;
  const items = db.saleItems.filter((i) => i.sale_id === saleId);
  const prodMap = new Map(db.products.map((p) => [p.id, p]));
  const cust = db.customers.find((c) => c.id === sale.customer_id);
  return (
    <div>
      <div className="mx-auto max-w-xs rounded-xl border border-zinc-200 bg-white p-5 font-mono text-xs text-zinc-900">
        <p className="text-center text-sm font-bold tracking-wide">SHWE MINI MART</p>
        <p className="mt-0.5 text-center text-zinc-500">Pyay Road, Kamayut, Yangon</p>
        <p className="text-center text-zinc-500">+95 9 123 456789</p>
        <div className="my-2.5 border-t border-dashed border-zinc-300" />
        <div className="flex justify-between text-zinc-500"><span>{sale.invoice_number}</span></div>
        <p className="text-zinc-500">{new Date(sale.sold_at).toLocaleString()}</p>
        {cust && <p>Customer: {cust.name}</p>}
        <div className="my-2.5 border-t border-dashed border-zinc-300" />
        {items.map((i) => (
          <div key={i.id} className="flex justify-between gap-2 py-px">
            <span className="min-w-0">{prodMap.get(i.product_id)?.name} <span className="text-zinc-500">×{i.quantity}</span></span>
            <span className="shrink-0 tabular-nums">{fmtMoney(i.total)}</span>
          </div>
        ))}
        <div className="my-2.5 border-t border-dashed border-zinc-300" />
        <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span className="tabular-nums">{fmtMoney(sale.subtotal)}</span></div>
        <div className="flex justify-between text-zinc-500"><span>Discount</span><span className="tabular-nums">{fmtMoney(sale.discount)}</span></div>
        <div className="mt-1 flex justify-between text-sm font-bold"><span>TOTAL</span><span className="tabular-nums">{fmtMoney(sale.total)}</span></div>
        <div className="mt-1 text-zinc-500">
          {sale.payments.map((p, i) => (
            <div key={i} className="flex justify-between"><span>{p.method.replace('_', ' ')}</span><span className="tabular-nums">{fmtMoney(p.amount)}</span></div>
          ))}
        </div>
        <div className="flex justify-between"><span>Change</span><span className="tabular-nums">{fmtMoney(sale.change_amount)}</span></div>
        <div className="my-2.5 border-t border-dashed border-zinc-300" />
        <p className="text-center font-bold">Thank you, come again!</p>
      </div>
      <div className="no-print mt-3 flex gap-1.5">
        <Button className="flex-1" variant="outline" onClick={() => window.print()}><Printer size={15} /> Print</Button>
        <Button className="flex-1" variant="ghost" onClick={() => window.print()}><RotateCcw size={15} /> Reprint</Button>
      </div>
    </div>
  );
}
