import { useEffect, useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import type { PaymentMethod } from '../../types';
import { useStore } from '../../store/AppStore';
import { fmtMoney, fmtDateTime, downloadCSV } from '../../lib/formatters';
import { Button, Card, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Modal, PageHeader, Pager, usePagination, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, SortHead } from '../../components/ui';
import { ReceiptView } from '../pos/POSPage';
import { toast } from 'sonner';

export function SalesPage() {
  const { db, createReturn, user, canDo } = useStore();
  const [q, setQ] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [retSale, setRetSale] = useState<string | null>(null);
  const [retQty, setRetQty] = useState<Record<string, string>>({});
  const [retReason, setRetReason] = useState('Customer return');
  const [retMethod, setRetMethod] = useState<PaymentMethod>('cash');

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return db.sales.filter((x) => !s || x.invoice_number.toLowerCase().includes(s));
  }, [db.sales, q]);

  const [sort, setSort] = useState<{ key: 'date' | 'total'; dir: 1 | -1 } | null>(null);
  const flip = (key: 'date' | 'total') => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
    pg.setPage(1);
  };
  const dirOf = (key: 'date' | 'total'): 0 | 1 | -1 => (sort?.key === key ? sort.dir : 0);
  const sorted = useMemo(() => {
    if (!sort) return list;
    const arr = [...list];
    if (sort.key === 'date') arr.sort((a, b) => a.sold_at.localeCompare(b.sold_at));
    if (sort.key === 'total') arr.sort((a, b) => a.total - b.total);
    if (sort.dir === -1) arr.reverse();
    return arr;
  }, [list, sort]);
  const pg = usePagination(sorted.length, 20);
  useEffect(() => { pg.reset(); }, [q]);
  const rows = sorted.slice(pg.start, pg.start + pg.size);

  const viewed = db.sales.find((s) => s.id === viewId);
  const viewedItems = viewed ? db.saleItems.filter((i) => i.sale_id === viewed.id) : [];
  const prodName = (pid: string) => db.products.find((p) => p.id === pid)?.name ?? pid;

  const doReturn = () => {
    if (!retSale) return;
    const items = Object.entries(retQty)
      .filter(([, v]) => Number(v) > 0)
      .map(([pid, v]) => ({ product_id: pid, quantity: Number(v), reason: retReason }));
    if (!items.length) { toast.error('Enter return quantities'); return; }
    createReturn(retSale, items, retMethod);
    toast.success('Return recorded — stock increased, refund logged');
    setRetSale(null); setRetQty({});
  };

  const canRefund = !!user && canDo('sales.refund');

  return (
    <div>
      <PageHeader
        title="Sales"
        icon={<Receipt aria-hidden />}
        sub={`${db.sales.length} transactions`}
        actions={<Button variant="outline" onClick={() => downloadCSV('sales.csv', db.sales.slice(0, 500).map((s) => ({ invoice: s.invoice_number, date: s.sold_at, total: s.total, status: s.status })))}>Export CSV</Button>}
      />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice…" className="mb-3 max-w-sm" />
      <Card><Table className="w-full min-w-[760px] text-[13px]">
        <TableHeader><TableRow>
          <TableHead>Invoice</TableHead><TableHead><SortHead label="Date" dir={dirOf('date')} onClick={() => flip('date')} /></TableHead><TableHead>Customer</TableHead>
          <TableHead className="text-right"><SortHead label="Total" dir={dirOf('total')} onClick={() => flip('total')} /></TableHead><TableHead>Pay</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>{rows.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-mono text-xs">{s.invoice_number}</TableCell>
            <TableCell className="text-xs">{fmtDateTime(s.sold_at)}</TableCell>
            <TableCell>{db.customers.find((c) => c.id === s.customer_id)?.name ?? 'Walk-in'}</TableCell>
            <TableCell className="text-right font-semibold">{fmtMoney(s.total)}</TableCell>
            <TableCell><span className="flex flex-wrap gap-1">{s.payments.map((p, i) => <Badge key={i}>{p.method.replace('_', ' ')}</Badge>)}</span></TableCell>
            <TableCell><Badge tone={s.status === 'completed' ? 'green' : s.status === 'cancelled' ? 'red' : 'amber'}>{s.status}</Badge></TableCell>
            <TableCell className="text-right">
              <button onClick={() => setViewId(s.id)} className="text-xs text-zinc-900 hover:underline">View</button>
              {canRefund && <> · <button onClick={() => setRetSale(s.id)} className="text-xs text-zinc-900 hover:underline">Return</button></>}
            </TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
        <Pager page={pg.page} pages={pg.pages} total={sorted.length} size={pg.size} onPage={pg.setPage} onSize={pg.setSize} />
      </Card>

      <Modal open={!!viewed} onClose={() => setViewId(null)} title={viewed ? `Sale ${viewed.invoice_number}` : ''}>
        {viewed && (
          <div>
            <div className="mb-2 space-y-0.5 text-sm">
              {viewedItems.map((i) => (
                <div key={i.id} className="flex justify-between"><span>{prodName(i.product_id)} x{i.quantity}</span><b>{fmtMoney(i.total)}</b></div>
              ))}
            </div>
            <ReceiptView saleId={viewed.id} />
          </div>
        )}
      </Modal>

      <Modal open={!!retSale} onClose={() => setRetSale(null)} title="Return / refund">
        {retSale && (
          <div className="grid gap-2">
            {db.saleItems.filter((i) => i.sale_id === retSale).map((i) => (
              <div key={i.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{prodName(i.product_id)} (bought x{i.quantity})</span>
                <Input value={retQty[i.product_id] ?? ''} onChange={(e) => setRetQty((m) => ({ ...m, [i.product_id]: e.target.value }))} placeholder="0" className="w-20 text-center" />
              </div>
            ))}
            <Select value={retReason} onValueChange={setRetReason}>
              <SelectTrigger aria-label="Return reason"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Customer return', 'Damaged', 'Wrong product', 'Duplicate sale', 'Other'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={retMethod} onValueChange={(v) => setRetMethod(v as PaymentMethod)}>
              <SelectTrigger aria-label="Refund method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Refund: cash</SelectItem>
                <SelectItem value="mobile_wallet">Refund: mobile wallet</SelectItem>
                <SelectItem value="card">Refund: card</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={doReturn}>Confirm return & refund</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
