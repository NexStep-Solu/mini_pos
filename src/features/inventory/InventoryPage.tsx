import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Warehouse } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { fmtMoney, fmtDateTime, downloadCSV, uid, todayISO } from '../../lib/formatters';
import { Button, Card, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, PageHeader, Field, Empty, Pager, usePagination, Tabs, TabsList, TabsTrigger, Meter, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, SortHead } from '../../components/ui';
import { toast } from 'sonner';

export function InventoryPage() {
  const { db, stockOf, adjustStock } = useStore();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'balances' | 'movements' | 'adjust' | 'stocktake'>('balances');
  const [adjPid, setAdjPid] = useState('');
  const [adjQty, setAdjQty] = useState('');
  const [adjNote, setAdjNote] = useState('');

  const balances = useMemo(() => {
    const s = q.toLowerCase();
    return db.products
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s))
      .map((p) => ({ p, qty: stockOf(p.id) }));
  }, [db.products, q, stockOf]);

  const movs = useMemo(() => db.movements, [db.movements]);

  const [balSort, setBalSort] = useState<{ key: 'name' | 'qty'; dir: 1 | -1 } | null>(null);
  const balFlip = (key: 'name' | 'qty') => {
    setBalSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
    balPg.setPage(1);
  };
  const balDir = (key: 'name' | 'qty'): 0 | 1 | -1 => (balSort?.key === key ? balSort.dir : 0);
  const balSorted = useMemo(() => {
    if (!balSort) return balances;
    const arr = [...balances];
    if (balSort.key === 'name') arr.sort((a, b) => a.p.name.localeCompare(b.p.name));
    if (balSort.key === 'qty') arr.sort((a, b) => a.qty - b.qty);
    if (balSort.dir === -1) arr.reverse();
    return arr;
  }, [balances, balSort]);
  const balPg = usePagination(balSorted.length, 20);
  const movPg = usePagination(movs.length, 20);
  useEffect(() => { balPg.reset(); }, [q]);
  const balRows = balSorted.slice(balPg.start, balPg.start + balPg.size);
  const movRows = movs.slice(movPg.start, movPg.start + movPg.size);

  const doAdjust = () => {
    if (!adjPid || !adjQty) { toast.error('Pick product and quantity'); return; }
    adjustStock(adjPid, Number(adjQty), adjNote || 'Manual adjustment');
    toast.success('Stock adjusted with movement record');
    setAdjPid(''); setAdjQty(''); setAdjNote('');
  };

  const prodName = (pid: string) => db.products.find((p) => p.id === pid)?.name ?? pid;

  return (
    <div>
      <PageHeader
        title="Inventory"
        sub="Every stock change has a movement record — never edit stock silently"
        icon={<Warehouse aria-hidden />}
        actions={<Button variant="outline" onClick={() => downloadCSV('stock.csv', db.products.map((p) => ({ sku: p.sku, name: p.name, qty: stockOf(p.id) })))}>Export stock</Button>}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-3">
        <TabsList>
          <TabsTrigger value="balances">Stock balances</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="adjust">Adjustments</TabsTrigger>
          <TabsTrigger value="stocktake">Stocktake</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'balances' && (
        <>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="mb-3 max-w-sm" />
          <Card><Table className="w-full min-w-[700px] text-[13px]">
            <TableHeader><TableRow>
              <TableHead><SortHead label="Product" dir={balDir('name')} onClick={() => balFlip('name')} /></TableHead><TableHead className="text-right"><SortHead label="On hand" dir={balDir('qty')} onClick={() => balFlip('qty')} /></TableHead>
              <TableHead className="text-right">Reorder at</TableHead><TableHead className="text-right">Value (cost)</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>{balRows.map(({ p, qty }) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}<span className="ml-2 font-mono text-xs text-zinc-400">{p.sku}</span></TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-bold tabular-nums">{qty}</span>
                    <span className="w-16"><Meter value={qty} max={Math.max(1, p.reorder_level * 3)} tone={qty <= p.reorder_level ? 'solid' : 'faint'} /></span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{p.reorder_level}</TableCell>
                <TableCell className="text-right">{fmtMoney(qty * p.cost_price)}</TableCell>
                <TableCell>{qty === 0 ? <Badge tone="red">Out of stock</Badge> : qty <= p.reorder_level ? <Badge tone="amber">Low</Badge> : <Badge tone="green">OK</Badge>}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
            <Pager page={balPg.page} pages={balPg.pages} total={balSorted.length} size={balPg.size} onPage={balPg.setPage} onSize={balPg.setSize} />
          </Card>
        </>
      )}

      {tab === 'movements' && (
        <Card><Table className="w-full min-w-[720px] text-[13px]">
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Type</TableHead>
            <TableHead className="text-right">Qty</TableHead><TableHead>Ref</TableHead>
          </TableRow></TableHeader>
          <TableBody>{movRows.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="text-xs">{fmtDateTime(m.created_at)}</TableCell>
              <TableCell>{prodName(m.product_id)}</TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  {m.quantity >= 0
                    ? <ArrowUpRight size={13} aria-hidden className="shrink-0 text-zinc-500" />
                    : <ArrowDownRight size={13} aria-hidden className="shrink-0 text-zinc-800 dark:text-zinc-200" />}
                  <Badge tone={m.quantity >= 0 ? 'green' : 'red'}>{m.movement_type}</Badge>
                </span>
              </TableCell>
              <TableCell className={`px-3 py-1.5 text-right font-bold ${m.quantity >= 0 ? 'text-zinc-800' : 'text-zinc-900'}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</TableCell>
              <TableCell className="font-mono text-xs">{m.reference_type}:{m.reference_id.slice(-6)}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
          <Pager page={movPg.page} pages={movPg.pages} total={movs.length} size={movPg.size} onPage={movPg.setPage} onSize={movPg.setSize} />
        </Card>
      )}

      {tab === 'adjust' && (
        <Card className="max-w-xl p-5">
          <div className="grid gap-2.5">
            <Field label="Product"><Select value={adjPid || 'none'} onValueChange={(v) => setAdjPid(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select…</SelectItem>
                {db.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} (now {stockOf(p.id)})</SelectItem>)}
              </SelectContent>
            </Select></Field>
            <Field label="Quantity change (+in / −out)"><Input type="number" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} placeholder="e.g. 10 or -5" /></Field>
            <Field label="Reason / notes"><Input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="Damage, found stock, correction…" /></Field>
            <Button onClick={doAdjust}>Record adjustment</Button>
          </div>
        </Card>
      )}

      {tab === 'stocktake' && <StocktakePanel />}
    </div>
  );
}

function StocktakePanel() {
  const { db, save } = useStore();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const lines = db.products.slice(0, 20).map((p) => ({
    p, sys: db.stock.find((s) => s.product_id === p.id)?.quantity ?? 0,
  }));
  const confirm = () => {
    const now = todayISO();
    const movs = lines
      .map(({ p, sys }) => ({ p, counted: counts[p.id] === undefined || counts[p.id] === '' ? sys : Number(counts[p.id]) }))
      .filter((l) => l.counted !== db.stock.find((s) => s.product_id === l.p.id)?.quantity)
      .map((l) => ({
        id: uid('mv'), organization_id: l.p.organization_id, branch_id: 'demo-branch-001',
        product_id: l.p.id, movement_type: 'stocktake' as const,
        quantity: l.counted - (db.stock.find((s) => s.product_id === l.p.id)?.quantity ?? 0),
        unit_cost: l.p.cost_price, reference_type: 'stocktake', reference_id: 'ST-001',
        notes: 'Stocktake count', created_by: 'manager', created_at: now,
      }));
    save({
      movements: [...movs, ...db.movements],
      stock: db.stock.map((s) => {
        const c = counts[s.product_id];
        return c === undefined || c === '' ? s : { ...s, quantity: Number(c), updated_at: now };
      }),
    });
    setDone(true);
    toast.success(`Stocktake confirmed · ${movs.length} variances recorded`);
  };
  if (done) return <Empty title="Stocktake confirmed" sub="Variances were recorded as stock movements." />;
  return (
    <Card className="p-4">
      <p className="mb-1 text-sm font-semibold">Stocktake — count first 20 products (demo)</p>
      <p className="mb-3 text-xs text-zinc-500">System qty → counted qty → variance. Confirming writes adjustment movements.</p>
      <div className="space-y-1.5">
        {lines.map(({ p, sys }) => {
          const c = counts[p.id] === undefined || counts[p.id] === '' ? sys : Number(counts[p.id]);
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-zinc-100 px-3 py-1.5 text-sm dark:border-zinc-800">
              <span className="flex-1">{p.name}</span>
              <span className="text-zinc-500">sys {sys}</span>
              <Input value={counts[p.id] ?? ''} onChange={(e) => setCounts((m) => ({ ...m, [p.id]: e.target.value }))} placeholder={String(sys)} className="w-20 text-center" />
              <Badge tone={c === sys ? 'green' : 'amber'}>{c - sys >= 0 ? '+' : ''}{c - sys}</Badge>
            </div>
          );
        })}
      </div>
      <Button className="mt-3" onClick={confirm}>Confirm stocktake</Button>
    </Card>
  );
}

