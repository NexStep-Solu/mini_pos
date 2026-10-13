import { useMemo, useState } from 'react';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useStore } from '../../store/AppStore';
import { fmtMoney, downloadCSV } from '../../lib/formatters';
import { useDark, chartTheme } from '../../hooks/use-dark';
import { Button, Card, PageHeader, Pager, usePagination, Tabs, TabsList, TabsTrigger, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui';

type Tab = 'sales' | 'inventory' | 'purchases' | 'customers' | 'profit';

export function ReportsPage() {
  const { db } = useStore();
  const [tab, setTab] = useState<Tab>('sales');
  const dark = useDark();
  const ct = chartTheme(dark);

  const salesByProduct = useMemo(() => {
    const m = new Map<string, { qty: number; rev: number; cost: number }>();
    for (const i of db.saleItems) {
      const e = m.get(i.product_id) ?? { qty: 0, rev: 0, cost: 0 };
      e.qty += i.quantity; e.rev += i.total; e.cost += i.cost_price * i.quantity;
      m.set(i.product_id, e);
    }
    return [...m.entries()].map(([pid, v]) => ({
      name: db.products.find((p) => p.id === pid)?.name ?? pid,
      ...v, profit: v.rev - v.cost,
    })).sort((a, b) => b.rev - a.rev);
  }, [db.saleItems, db.products]);

  const salesByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of db.saleItems) {
      const p = db.products.find((x) => x.id === i.product_id);
      const c = db.categories.find((c) => c.id === p?.category_id)?.name ?? 'Other';
      m.set(c, (m.get(c) ?? 0) + i.total);
    }
    return [...m.entries()].map(([name, total]) => ({ name, total }));
  }, [db.saleItems, db.products, db.categories]);

  const cashierPerf = useMemo(() => {
    const m = new Map<string, { orders: number; total: number }>();
    for (const s of db.sales) {
      const e = m.get(s.cashier_id) ?? { orders: 0, total: 0 };
      e.orders++; e.total += s.total;
      m.set(s.cashier_id, e);
    }
    return [...m.entries()].map(([id, v]) => ({ id, ...v }));
  }, [db.sales]);

  const perfPg = usePagination(salesByProduct.length, 15);
  const invPg = usePagination(db.products.length, 20);
  const custList = db.customers.filter((c) => c.id !== 'cu-walkin');
  const custPg = usePagination(custList.length, 20);

  const gross = salesByProduct.reduce((a, r) => a + r.rev, 0);
  const cogs = salesByProduct.reduce((a, r) => a + r.cost, 0);
  const discounts = db.sales.reduce((a, s) => a + s.discount, 0);
  const expenses = db.expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <div>
      <PageHeader
        title="Reports"
        icon={<BarChart3 aria-hidden />}
        sub="Sales · inventory · purchases · customers · profit"
        actions={<Button variant="outline" onClick={() => downloadCSV('product-performance.csv', salesByProduct)}>Export</Button>}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-3">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="profit">Profit</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'sales' && (
        <div className="grid gap-2.5">
          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold">Revenue by category</p>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByCategory}><CartesianGrid strokeDasharray="3 3" stroke={ct.grid} /><XAxis dataKey="name" tick={{ fill: ct.muted, fontSize: 11 }} interval={0} angle={-15} height={60} /><YAxis tick={{ fill: ct.muted, fontSize: 11 }} /><Tooltip contentStyle={ct.tooltip} formatter={(v) => fmtMoney(Number(v ?? 0))} /><Bar dataKey="total" fill={ct.fg} radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer></div>
          </Card>
          <Card><Table className="w-full min-w-[640px] text-[13px]">
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Profit</TableHead></TableRow></TableHeader>
            <TableBody>{salesByProduct.slice(perfPg.start, perfPg.start + perfPg.size).map((r) => (
              <TableRow key={r.name}><TableCell>{r.name}</TableCell><TableCell className="text-right">{r.qty}</TableCell><TableCell className="text-right font-semibold">{fmtMoney(r.rev)}</TableCell><TableCell className="text-right font-semibold">{fmtMoney(r.profit)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
            <Pager page={perfPg.page} pages={perfPg.pages} total={salesByProduct.length} size={perfPg.size} onPage={perfPg.setPage} onSize={perfPg.setSize} />
          </Card>
          <Card className="p-4"><p className="mb-2 text-sm font-semibold">Cashier performance</p>
            {cashierPerf.map((c) => <div key={c.id} className="flex justify-between border-b border-zinc-100 py-1.5 text-sm dark:border-zinc-800"><span className="font-mono">{c.id}</span><span>{c.orders} orders · <b>{fmtMoney(c.total)}</b></span></div>)}
          </Card>
        </div>
      )}

      {tab === 'inventory' && (
        <Card><Table className="w-full min-w-[640px] text-[13px]">
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Unit cost</TableHead><TableHead className="text-right">Stock value</TableHead></TableRow></TableHeader>
          <TableBody>{db.products.slice(invPg.start, invPg.start + invPg.size).map((p) => {
            const q = db.stock.find((s) => s.product_id === p.id)?.quantity ?? 0;
            return <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell className="text-right">{q}</TableCell><TableCell className="text-right">{fmtMoney(p.cost_price)}</TableCell><TableCell className="text-right font-semibold">{fmtMoney(q * p.cost_price)}</TableCell></TableRow>;
          })}</TableBody>
        </Table>
          <Pager page={invPg.page} pages={invPg.pages} total={db.products.length} size={invPg.size} onPage={invPg.setPage} onSize={invPg.setSize} />
        </Card>
      )}

      {tab === 'purchases' && (
        <Card><Table className="w-full min-w-[560px] text-[13px]">
          <TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{db.purchases.map((p) => (
            <TableRow key={p.id}><TableCell className="font-mono text-xs">{p.purchase_number || p.id.slice(-6)}</TableCell><TableCell>{db.suppliers.find((s) => s.id === p.supplier_id)?.name}</TableCell><TableCell className="text-right font-semibold">{fmtMoney(p.total)}</TableCell><TableCell>{p.status}</TableCell></TableRow>
          ))}{db.purchases.length === 0 && <TableRow><TableCell className="px-4 py-6 text-center text-zinc-500" colSpan={4}>No purchases yet — seed data focuses on sales; create a PO in Purchases.</TableCell></TableRow>}</TableBody>
        </Table></Card>
      )}

      {tab === 'customers' && (
        <Card><Table className="w-full min-w-[560px] text-[13px]">
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Spent</TableHead><TableHead className="text-right">Points</TableHead></TableRow></TableHeader>
          <TableBody>{custList.slice(custPg.start, custPg.start + custPg.size).map((c) => {
            const h = db.sales.filter((s) => s.customer_id === c.id);
            return <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="text-right">{h.length}</TableCell><TableCell className="text-right font-semibold">{fmtMoney(h.reduce((a, s) => a + s.total, 0))}</TableCell><TableCell className="text-right">{c.loyalty_points}</TableCell></TableRow>;
          })}</TableBody>
        </Table>
          <Pager page={custPg.page} pages={custPg.pages} total={custList.length} size={custPg.size} onPage={custPg.setPage} onSize={custPg.setSize} />
        </Card>
      )}

      {tab === 'profit' && (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {[
            ['Gross sales', gross], ['Discounts', -discounts], ['COGS', -cogs],
            ['Gross profit', gross - discounts - cogs], ['Expenses', -expenses],
            ['Net profit (est.)', gross - discounts - cogs - expenses],
          ].map(([label, v]) => {
            const positive = (v as number) >= 0;
            return (
              <Card key={label as string} className="flex items-center justify-between gap-3 p-4">
                <span className="flex items-center gap-2 text-sm text-zinc-600">
                  <span className="rounded-md border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900">
                    {positive
                      ? <TrendingUp size={14} aria-hidden />
                      : <TrendingDown size={14} aria-hidden />}
                  </span>
                  {label as string}
                </span>
                <span className="text-lg font-bold tabular-nums">{fmtMoney(v as number)}</span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
