import { useEffect, useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import type { Customer } from '../../types';
import { useStore } from '../../store/AppStore';
import { fmtMoney, fmtDateTime, uid, todayISO, downloadCSV } from '../../lib/formatters';
import { Button, Card, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Modal, PageHeader, Field, Empty, Pager, usePagination, Avatar, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, SortHead } from '../../components/ui';
import { toast } from 'sonner';
import { ORG_ID } from '../../lib/supabase';

export function CustomersPage() {
  const { db, upsertCustomer, collectDue } = useStore();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return db.customers
      .filter((c) => !s || c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.customer_code.toLowerCase().includes(s));
  }, [db.customers, q]);

  const spentMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of db.sales) {
      if (s.customer_id) m.set(s.customer_id, (m.get(s.customer_id) ?? 0) + s.total);
    }
    return m;
  }, [db.sales]);
  const [sort, setSort] = useState<{ key: 'name' | 'spent'; dir: 1 | -1 } | null>(null);
  const flip = (key: 'name' | 'spent') => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
    pg.setPage(1);
  };
  const dirOf = (key: 'name' | 'spent'): 0 | 1 | -1 => (sort?.key === key ? sort.dir : 0);
  const sorted = useMemo(() => {
    if (!sort) return list;
    const arr = [...list];
    if (sort.key === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
    if (sort.key === 'spent') arr.sort((a, b) => (spentMap.get(a.id) ?? 0) - (spentMap.get(b.id) ?? 0));
    if (sort.dir === -1) arr.reverse();
    return arr;
  }, [list, sort, spentMap]);
  const pg = usePagination(sorted.length, 20);
  useEffect(() => { pg.reset(); }, [q]);
  const rows = sorted.slice(pg.start, pg.start + pg.size);

  const gName = (id?: string | null) => (id ? ` · ${id.replace('g-', '').toUpperCase()}` : '');

  const save = (c: Customer) => {
    if (!c.name || !c.phone) { toast.error('Name and phone required'); return; }
    const finalC = c.id ? c : { ...c, id: uid('cu'), created_at: todayISO(), updated_at: todayISO() };
    upsertCustomer(finalC);
    toast.success('Customer saved');
    setEditing(null);
  };

  const viewed = db.customers.find((c) => c.id === viewId);
  const history = useMemo(() => viewId ? db.sales.filter((s) => s.customer_id === viewId) : [], [viewId, db.sales]);
  const spent = history.reduce((a, s) => a + s.total, 0);

  return (
    <div>
      <PageHeader
        title="Customers — CRM"
        icon={<Users aria-hidden />}
        sub={`${db.customers.length} customers · loyalty: 1 pt per Ks 100`}
        actions={<>
          <Button variant="outline" onClick={() => downloadCSV('customers.csv', db.customers.map((c) => ({ code: c.customer_code, name: c.name, phone: c.phone, points: c.loyalty_points, balance: c.current_balance })))}>Export</Button>
          <Button onClick={() => setEditing({ id: '', organization_id: ORG_ID, customer_code: `C-${String(db.customers.length).padStart(4, '0')}`, name: '', phone: '', group_id: 'g-reg', credit_limit: 50000, current_balance: 0, loyalty_points: 0, is_active: true, created_at: todayISO(), updated_at: todayISO() })}><Plus size={15} /> New customer</Button>
        </>}
      />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / phone / code…" className="mb-3 max-w-sm" />
      <Card><Table className="w-full min-w-[760px] text-[13px]">
        <TableHeader><TableRow>
          <TableHead>Code</TableHead><TableHead><SortHead label="Name" dir={dirOf('name')} onClick={() => flip('name')} /></TableHead><TableHead>Phone</TableHead>
          <TableHead className="text-right">Points</TableHead><TableHead className="text-right">Owes</TableHead><TableHead className="text-right"><SortHead label="Spent" dir={dirOf('spent')} onClick={() => flip('spent')} /></TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>{rows.map((c) => {
          const sp = spentMap.get(c.id) ?? 0;
          return (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.customer_code}</TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <Avatar name={c.name} className="size-7 text-[10px]" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block text-xs text-zinc-400">{gName(c.group_id)}</span>
                  </span>
                </span>
              </TableCell>
              <TableCell>{c.phone}</TableCell>
              <TableCell className="text-right"><Badge tone="blue">{c.loyalty_points} pts</Badge></TableCell>
              <TableCell className={`px-3 py-1.5 text-right font-semibold ${c.current_balance > 0 ? 'text-zinc-900' : ''}`}>{fmtMoney(c.current_balance)}</TableCell>
              <TableCell className="text-right">{fmtMoney(sp)}</TableCell>
              <TableCell className="text-right">
                <button onClick={() => setViewId(c.id)} className="text-xs text-zinc-900 hover:underline">Profile</button>
                {' · '}<button onClick={() => setEditing({ ...c })} className="text-xs text-zinc-600 hover:underline">Edit</button>
              </TableCell>
            </TableRow>
          );
        })}</TableBody>
      </Table>
        <Pager page={pg.page} pages={pg.pages} total={sorted.length} size={pg.size} onPage={pg.setPage} onSize={pg.setSize} />
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Customer">
        {editing && (
          <div className="grid gap-2.5">
            <Field label="Name *"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Phone *"><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            <Field label="Group"><Select value={editing.group_id ?? 'g-reg'} onValueChange={(v) => setEditing({ ...editing, group_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="g-walkin">Walk-in</SelectItem>
                <SelectItem value="g-reg">Regular</SelectItem>
                <SelectItem value="g-vip">VIP</SelectItem>
                <SelectItem value="g-whole">Wholesale</SelectItem>
                <SelectItem value="g-staff">Staff</SelectItem>
              </SelectContent>
            </Select></Field>
            <Field label="Credit limit"><Input type="number" value={editing.credit_limit} onChange={(e) => setEditing({ ...editing, credit_limit: Number(e.target.value) })} /></Field>
            <Field label="Notes"><Input value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
            <Button onClick={() => { if (editing) save(editing); }}>Save customer</Button>
          </div>
        )}
      </Modal>

      <Modal open={!!viewed} onClose={() => setViewId(null)} title={viewed ? `Customer — ${viewed.name}` : ''} wide>
        {viewed && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
                <p><b>Code:</b> {viewed.customer_code}</p>
                <p><b>Phone:</b> {viewed.phone}</p>
                <p><b>Points:</b> {viewed.loyalty_points}</p>
                <p><b>Owes:</b> {fmtMoney(viewed.current_balance)} / limit {fmtMoney(viewed.credit_limit)}</p>
                <p className="mt-2"><b>Lifetime:</b> {history.length} purchases · {fmtMoney(spent)} · AOV {fmtMoney(history.length ? spent / history.length : 0)}</p>
              </div>
              {viewed.current_balance > 0 && (
                <CollectDueForm
                  balance={viewed.current_balance}
                  onCollect={(amt, method) => { collectDue(viewed.id, amt, method); toast.success(`Collected ${fmtMoney(Math.min(amt, viewed.current_balance))}`); }}
                />
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Purchase history</p>
              {history.length === 0 ? <Empty title="No purchases yet" /> : (
                <div className="max-h-64 space-y-1.5 overflow-auto">
                  {history.slice(0, 30).map((s) => (
                    <div key={s.id} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-1.5 text-sm dark:bg-zinc-900">
                      <span className="font-mono text-xs">{s.invoice_number} · {fmtDateTime(s.sold_at)}</span>
                      <b>{fmtMoney(s.total)}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CollectDueForm({ balance, onCollect }: { balance: number; onCollect: (amt: number, method: 'cash' | 'mobile_wallet' | 'card' | 'bank_transfer') => void }) {
  const [amt, setAmt] = useState('');
  const [method, setMethod] = useState<'cash' | 'mobile_wallet' | 'card' | 'bank_transfer'>('cash');
  return (
    <div className="mt-2 rounded-xl border border-zinc-200 p-3">
      <p className="mb-2 text-[13px] font-semibold">Collect due</p>
      <div className="flex gap-1.5">
        <Input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={String(balance)} className="h-8" aria-label="Amount to collect" />
        <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
          <SelectTrigger className="h-8 w-32" aria-label="Payment method"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">cash</SelectItem>
            <SelectItem value="mobile_wallet">wallet</SelectItem>
            <SelectItem value="card">card</SelectItem>
            <SelectItem value="bank_transfer">bank</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className="h-8"
          onClick={() => {
            const n = Number(amt) || 0;
            if (n <= 0) { toast.error('Enter an amount'); return; }
            onCollect(n, method);
            setAmt('');
          }}
        >
          Collect
        </Button>
      </div>
    </div>
  );
}
