import { useState } from 'react';
import { Plus, Truck, Store, X } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { fmtMoney, fmtDateTime, todayISO, uid } from '../../lib/formatters';
import { Button, Card, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Modal, PageHeader, Field, Empty, Avatar, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui';
import { toast } from 'sonner';
import { ORG_ID, BRANCH_ID } from '../../lib/supabase';

export function SuppliersPage() {
  const { db, upsertSupplier } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');

  const create = () => {
    if (!name.trim() || !phone.trim()) { toast.error('Name and phone are required'); return; }
    upsertSupplier({
      id: uid('s'), organization_id: ORG_ID, name: name.trim(), contact_person: contact.trim(),
      phone: phone.trim(), email: '', address: '', is_active: true,
    });
    toast.success('Supplier added');
    setOpen(false); setName(''); setContact(''); setPhone('');
  };

  return (
    <div>
      <PageHeader title="Suppliers" sub={`${db.suppliers.length} suppliers`} icon={<Store aria-hidden />} actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> New supplier</Button>} />
      <div className="grid gap-2.5 md:grid-cols-2">
        {db.suppliers.map((s) => {
          const orders = db.purchases.filter((p) => p.supplier_id === s.id);
          const spent = orders.reduce((a, o) => a + o.total, 0);
          return (
            <Card key={s.id} className="p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start gap-3">
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{s.name}</p>
                <p className="text-xs text-zinc-500">{s.contact_person} · {s.phone}</p>
                <p className="truncate text-xs text-zinc-500">{s.address}</p></div>
                <Badge tone="slate">{orders.length} POs</Badge>
              </div>
              <div className="mt-2.5 flex items-end justify-between border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800">
                <span className="text-xs text-zinc-500">Total purchased</span>
                <b className="tabular-nums">{fmtMoney(spent)}</b>
              </div>
            </Card>
          );
        })}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New supplier">
        <div className="grid gap-2.5">
          <Field label="Supplier name *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="City FMCG Distribution" /></Field>
          <Field label="Contact person"><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="U Min Khant" /></Field>
          <Field label="Phone *"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+95 9 ..." /></Field>
          <Button onClick={create}>Add supplier</Button>
        </div>
      </Modal>
    </div>
  );
}

export function PurchasesPage() {
  const { db, user, receivePurchase, updatePurchaseStatus } = useStore();
  const [open, setOpen] = useState(false);
  const [supId, setSupId] = useState('');
  const [lines, setLines] = useState<{ product_id: string; quantity: string; unit_cost: string }[]>([{ product_id: '', quantity: '10', unit_cost: '' }]);

  const submit = () => {
    if (!supId) { toast.error('Select supplier'); return; }
    const items = lines.filter((l) => l.product_id).map((l) => {
      const p = db.products.find((x) => x.id === l.product_id)!;
      const qty = Number(l.quantity) || 0;
      const cost = Number(l.unit_cost) || p.cost_price;
      return { purchase_order_id: '', product_id: l.product_id, quantity: qty, received_quantity: qty, unit_cost: cost, discount: 0, total: qty * cost };
    });
    if (!items.length) { toast.error('Add at least one item'); return; }
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    receivePurchase({
      organization_id: ORG_ID, branch_id: BRANCH_ID, supplier_id: supId,
      status: 'received', subtotal, discount: 0, tax: 0, total: subtotal,
      paid_amount: subtotal, due_amount: 0,
      ordered_at: todayISO(), received_at: todayISO(), created_by: user?.id ?? 'system',
    }, items);
    toast.success('Purchase received — stock increased');
    setOpen(false); setLines([{ product_id: '', quantity: '10', unit_cost: '' }]);
  };

  return (
    <div>
      <PageHeader title="Purchases" sub="Buy stock → receive → inventory increases" icon={<Truck aria-hidden />} actions={<Button onClick={() => { setSupId(db.suppliers[0]?.id ?? ''); setOpen(true); }}><Plus size={15} /> New purchase</Button>} />
      <Card>
        {db.purchases.length === 0
          ? <Empty title="No purchase orders yet" sub="Create your first purchase to receive stock." />
          : <Table className="w-full min-w-[700px] text-[13px]">
            <TableHeader><TableRow>
              <TableHead>PO No</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>{db.purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">{p.purchase_number}</TableCell>
                <TableCell>{db.suppliers.find((s) => s.id === p.supplier_id)?.name}</TableCell>
                <TableCell className="text-xs">{fmtDateTime(p.ordered_at)}</TableCell>
                <TableCell className="text-right font-semibold">{fmtMoney(p.total)}</TableCell>
                <TableCell><Badge tone={p.status === 'received' ? 'green' : 'amber'}>{p.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Select value={p.status} onValueChange={(v) => updatePurchaseStatus(p.id, v as never)}>
                    <SelectTrigger className="h-8 w-36 text-xs" aria-label="Purchase status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">draft</SelectItem>
                      <SelectItem value="ordered">ordered</SelectItem>
                      <SelectItem value="partially_received">partially_received</SelectItem>
                      <SelectItem value="received">received</SelectItem>
                      <SelectItem value="cancelled">cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New purchase — receive stock" wide>
        <div className="grid gap-2.5">
          <Field label="Supplier"><Select value={supId} onValueChange={setSupId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {db.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select></Field>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Select value={l.product_id || 'none'} onValueChange={(v) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, product_id: v === 'none' ? '' : v, unit_cost: String(db.products.find((p) => p.id === v)?.cost_price ?? '') } : x)))}>
                <SelectTrigger aria-label="Product">
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select product…</SelectItem>
                  {db.products.slice(0, 80).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} placeholder="Qty" className="w-24" />
              <Input type="number" value={l.unit_cost} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, unit_cost: e.target.value } : x)))} placeholder="Unit cost" className="w-32" />
              <Button variant="ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove line"><X size={15} /></Button>
            </div>
          ))}
          <Button variant="outline" onClick={() => setLines((ls) => [...ls, { product_id: '', quantity: '10', unit_cost: '' }])}>+ Add line</Button>
          <Button onClick={submit}>Receive purchase (adds stock)</Button>
        </div>
      </Modal>
    </div>
  );
}

// re-export uid to satisfy strict lint if referenced elsewhere
export const _u = uid;
