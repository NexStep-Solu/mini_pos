import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area,
} from 'recharts';
import {
  ShoppingCart, AlertTriangle, Wallet, TrendingUp, TrendingDown, Minus,
  LayoutDashboard, ArrowRight, PackageX,
} from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { fmtMoney } from '../../lib/formatters';
import { useDark, chartTheme } from '../../hooks/use-dark';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { PageHeader, Meter, Badge } from '../../components/ui';
import { cn } from '../../lib/utils';

type Range = 'today' | '7d' | '30d';
const RANGE_DAYS: Record<Range, number> = { today: 1, '7d': 7, '30d': 30 };
const RANGE_LABEL: Record<Range, string> = { today: 'Today', '7d': '7 days', '30d': '30 days' };

function pct(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 100);
}

function Delta({ value, invert, tone }: { value: number | null; invert?: boolean; tone?: 'card' | 'hero' }) {
  const strong = tone === 'hero' ? 'text-zinc-100 dark:text-zinc-800' : 'text-zinc-800 dark:text-zinc-200';
  if (value === null) {
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-400">
        <Minus size={12} aria-hidden /> no prior data
      </span>
    );
  }
  const up = invert ? value < 0 : value > 0;
  const flat = value === 0;
  return (
    <span className={cn('flex items-center gap-1 text-xs font-semibold tabular-nums', flat ? 'text-zinc-400' : strong)}>
      {flat ? <Minus size={12} aria-hidden /> : up ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
      {flat ? '—' : `${up ? '+' : ''}${value}%`}
      <span className="font-normal text-zinc-400">vs prior</span>
    </span>
  );
}

function Spark({ data, kind, color }: { data: number[]; kind: 'area' | 'bar'; color: string }) {
  const pts = data.map((v, i) => ({ i, v }));
  return (
    <div className="mt-2 h-10" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'area' ? (
          <AreaChart data={pts} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.14} isAnimationActive={false} dot={false} />
          </AreaChart>
        ) : (
          <BarChart data={pts} margin={{ top: 2, bottom: 0, left: 0, right: 0 }} barCategoryGap="28%">
            <Bar dataKey="v" fill={color} fillOpacity={0.85} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ label, value, delta, sub, icon, spark, sparkKind, hero, action }: {
  label: string; value: string; delta: number | null; sub: string; icon: React.ReactNode;
  spark?: number[]; sparkKind?: 'area' | 'bar'; hero?: boolean;
  action?: { label: string; to: string };
}) {
  return (
    <Card className={cn('p-3.5', hero && 'bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950')}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn('min-w-0 truncate text-[11px] font-semibold tracking-wider uppercase', hero ? 'text-zinc-400' : 'text-zinc-500 dark:text-zinc-400')}>{label}</p>
        <span className={cn(
          'shrink-0 rounded-md border p-1 [&_svg]:size-3.5',
          hero
            ? 'border-white/15 bg-white/10 text-zinc-200 dark:border-zinc-950/15 dark:bg-zinc-950/10 dark:text-zinc-700'
            : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
        )}>{icon}</span>
      </div>
      <p className={cn('mt-1 truncate font-bold tracking-tight tabular-nums', hero ? 'text-[26px] leading-8' : 'text-xl')}>{value}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <Delta value={delta} tone={hero ? 'hero' : 'card'} />
        <span className="truncate text-[11px] text-zinc-400">{sub}</span>
      </div>
      {spark && sparkKind && (
        <Spark data={spark} kind={sparkKind} color={hero ? '#a1a1aa' : '#18181b'} />
      )}
      {action && (
        <Link to={action.to} className="mt-2 flex items-center gap-1 text-xs font-semibold hover:underline">
          {action.label} <ArrowRight size={12} aria-hidden />
        </Link>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const { db, lowStock } = useStore();
  const dark = useDark();
  const ct = chartTheme(dark);
  const [range, setRange] = useState<Range>('today');
  const days = RANGE_DAYS[range];

  const data = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);
    const inR = (iso: string, from: Date, to: Date) => {
      const t = new Date(iso).getTime();
      return t >= from.getTime() && t < to.getTime();
    };
    const cur = db.sales.filter((s) => s.status !== 'cancelled' && inR(s.sold_at, start, now));
    const prev = db.sales.filter((s) => s.status !== 'cancelled' && inR(s.sold_at, prevStart, start));
    const sum = (ss: typeof cur) => ss.reduce((a, s) => a + s.total, 0);
    const costOf = (ss: typeof cur) => ss.reduce((a, s) => {
      const items = db.saleItems.filter((i) => i.sale_id === s.id);
      return a + items.reduce((x, i) => x + i.cost_price * i.quantity, 0);
    }, 0);
    const revenue = sum(cur), pRevenue = sum(prev);
    const profit = revenue - costOf(cur), pProfit = pRevenue - costOf(prev);
    const orders = cur.length, pOrders = prev.length;
    const aov = orders ? revenue / orders : 0, pAov = pOrders ? pRevenue / pOrders : 0;
    const credit = db.customers.reduce((a, c) => a + c.current_balance, 0);
    return { cur, revenue, profit, orders, aov, credit, dRev: pct(revenue, pRevenue), dProfit: pct(profit, pProfit), dOrders: pct(orders, pOrders), dAov: pct(aov, pAov) };
  }, [db.sales, db.saleItems, db.customers, days]);

  // per-bucket series: hourly for today, daily otherwise
  const series = useMemo(() => {
    const costBySale = new Map<string, number>();
    for (const i of db.saleItems) {
      costBySale.set(i.sale_id, (costBySale.get(i.sale_id) ?? 0) + i.cost_price * i.quantity);
    }
    const keys: string[] = [];
    if (range === 'today') {
      for (let h = 0; h < 24; h++) keys.push(`${String(h).padStart(2, '0')}:00`);
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        keys.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
      }
    }
    const keyOf = (iso: string) => (range === 'today'
      ? `${String(new Date(iso).getHours()).padStart(2, '0')}:00`
      : new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
    const agg = new Map(keys.map((k) => [k, { revenue: 0, profit: 0, orders: 0 }]));
    for (const s of data.cur) {
      const k = keyOf(s.sold_at);
      const b = agg.get(k);
      if (!b) continue;
      b.revenue += s.total;
      b.profit += s.total - (costBySale.get(s.id) ?? 0);
      b.orders += 1;
    }
    return keys.map((label) => ({ label, ...agg.get(label)! }));
  }, [data.cur, db.saleItems, days, range]);

  const buckets = useMemo(
    () => series.map(({ label, revenue }) => ({ label, total: Math.round(revenue / 1000) })),
    [series],
  );
  const sparkRev = series.map((b) => Math.round(b.revenue / 1000));
  const sparkProfit = series.map((b) => Math.round(b.profit / 1000));
  const sparkOrders = series.map((b) => b.orders);

  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data.cur) for (const p of s.payments) m.set(p.method, (m.get(p.method) ?? 0) + p.amount);
    const total = [...m.values()].reduce((a, v) => a + v, 0) || 1;
    return [...m.entries()].map(([name, value]) => ({ name: name.replace('_', ' '), value, share: Math.round((value / total) * 100) }));
  }, [data.cur]);

  const topProducts = useMemo(() => {
    const ids = new Set(data.cur.map((s) => s.id));
    const qty = new Map<string, { qty: number; rev: number }>();
    for (const i of db.saleItems) {
      if (!ids.has(i.sale_id)) continue;
      const e = qty.get(i.product_id) ?? { qty: 0, rev: 0 };
      e.qty += i.quantity; e.rev += i.total;
      qty.set(i.product_id, e);
    }
    const rows = [...qty.entries()]
      .map(([pid, v]) => ({ name: db.products.find((p) => p.id === pid)?.name ?? pid, ...v }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 6);
    const top = rows[0]?.rev ?? 1;
    return rows.map((r) => ({ ...r, pct: Math.max(4, Math.round((r.rev / top) * 100)) }));
  }, [data.cur, db.saleItems, db.products]);

  const recent = useMemo(() => data.cur.slice(0, 7), [data.cur]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        sub={`Kamayut Main Branch · ${RANGE_LABEL[range]} performance`}
        icon={<LayoutDashboard aria-hidden />}
        actions={(
          <>
            <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="7d">7D</TabsTrigger>
                <TabsTrigger value="30d">30D</TabsTrigger>
              </TabsList>
            </Tabs>
            <Link to="/pos"><Button>Open POS</Button></Link>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="col-span-2">
          <Kpi hero label="Revenue" value={fmtMoney(data.revenue)} delta={data.dRev} sub={`${data.orders} orders · ${RANGE_LABEL[range].toLowerCase()}`} icon={<ShoppingCart size={18} />} spark={sparkRev} sparkKind="area" />
        </div>
        <Kpi label="Profit" value={fmtMoney(data.profit)} delta={data.dProfit} sub="Revenue − COGS" icon={<TrendingUp size={18} />} spark={sparkProfit} sparkKind="area" />
        <Kpi label="Orders" value={String(data.orders)} delta={data.dOrders} sub="Transactions" icon={<ShoppingCart size={18} />} spark={sparkOrders} sparkKind="bar" />
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <Kpi label="Avg order" value={fmtMoney(Math.round(data.aov))} delta={data.dAov} sub="Per transaction" icon={<TrendingUp size={18} />} />
        <Kpi label="Low stock" value={String(lowStock.length)} delta={null} sub="Need reorder" icon={<AlertTriangle size={18} />} action={lowStock.length > 0 ? { label: 'Review inventory', to: '/inventory' } : undefined} />
        <Kpi label="Credit due" value={fmtMoney(data.credit)} delta={null} sub="Customer balances" icon={<Wallet size={18} />} action={data.credit > 0 ? { label: 'View customers', to: '/customers' } : undefined} />
      </div>

      <div className="mt-2.5 grid gap-2.5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Sales trend</CardTitle>
            <CardDescription>{range === 'today' ? 'Hourly revenue (Ks ’000)' : `Daily revenue, last ${days} days (Ks ’000)`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ left: -12, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: ct.muted, fontSize: 10 }} interval={range === 'today' ? 3 : Math.max(0, Math.floor(days / 8))} />
                  <YAxis tick={{ fill: ct.muted, fontSize: 11 }} />
                  <Tooltip contentStyle={ct.tooltip} cursor={{ fill: ct.grid, opacity: 0.4 }} />
                  <Bar dataKey="total" fill={ct.fg} radius={[5, 5, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payment mix</CardTitle>
            <CardDescription>Share of revenue by method</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byMethod} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2} strokeWidth={0}>
                      {byMethod.map((_, i) => <Cell key={i} fill={ct.ramp[i % ct.ramp.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={ct.tooltip} formatter={(v) => fmtMoney(Number(v ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5">
                {byMethod.length === 0 && <li className="text-[13px] text-zinc-500">No sales in range.</li>}
                {byMethod.map((m, i) => (
                  <li key={m.name} className="flex items-center gap-2 text-[13px]">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: ct.ramp[i % ct.ramp.length] }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate capitalize">{m.name}</span>
                    <b className="tabular-nums">{m.share}%</b>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-2.5 grid gap-2.5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Top products</CardTitle>
              <CardDescription>By revenue in range</CardDescription>
            </div>
            <Link to="/reports" className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50">
              Reports <ArrowRight size={12} aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 && <p className="py-6 text-center text-[13px] text-zinc-500">No sales in range.</p>}
            <ol className="space-y-2.5">
              {topProducts.map((r, i) => (
                <li key={r.name}>
                  <div className="flex items-baseline gap-2 text-[13px]">
                    <span className="w-4 shrink-0 font-mono text-xs text-zinc-400 tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                    <span className="shrink-0 text-xs text-zinc-400 tabular-nums">×{r.qty}</span>
                    <b className="shrink-0 tabular-nums">{fmtMoney(r.rev)}</b>
                  </div>
                  <div className="mt-1 ml-6"><Meter value={r.pct} max={100} tone={i === 0 ? 'solid' : 'faint'} /></div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent sales</CardTitle>
              <CardDescription>Latest transactions in range</CardDescription>
            </div>
            <Link to="/sales" className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50">
              View all <ArrowRight size={12} aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 && <p className="py-6 text-center text-[13px] text-zinc-500">No sales in range.</p>}
            <ul className="space-y-1.5">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[13px] dark:bg-zinc-900">
                  <span className="font-mono text-xs text-zinc-500">{s.invoice_number}</span>
                  <Badge tone={s.status === 'completed' ? 'green' : 'amber'}>{s.status}</Badge>
                  <span className="ml-auto font-bold tabular-nums">{fmtMoney(s.total)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className={cn(lowStock.length > 0 ? 'border-zinc-900 dark:border-zinc-100' : '')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              {lowStock.length > 0
                ? <AlertTriangle size={14} aria-hidden />
                : <PackageX size={14} aria-hidden className="text-zinc-400" />}
              Low stock
            </CardTitle>
            <CardDescription>
              {lowStock.length > 0 ? `${lowStock.length} items at or below reorder level` : 'Everything is stocked up'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 && <p className="py-4 text-center text-[13px] text-zinc-500">Nothing to reorder.</p>}
            <ul className="max-h-52 space-y-2 overflow-auto">
              {lowStock.slice(0, 8).map(({ product, qty }) => (
                <li key={product.id}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-medium">{product.name}</span>
                    <Badge tone={qty === 0 ? 'red' : 'amber'}>{qty} left</Badge>
                  </div>
                  <div className="mt-1"><Meter value={qty} max={Math.max(1, product.reorder_level * 3)} tone="solid" /></div>
                </li>
              ))}
            </ul>
            {lowStock.length > 0 && (
              <Link to="/inventory">
                <Button variant="outline" className="mt-3 w-full">Review inventory</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
