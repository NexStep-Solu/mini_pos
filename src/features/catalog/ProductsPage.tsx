import { useEffect, useMemo, useState } from 'react';
import { Plus, Package } from 'lucide-react';
import type { Product } from '../../types';
import { useStore } from '../../store/AppStore';
import { fmtMoney, uid, todayISO, downloadCSV } from '../../lib/formatters';
import { Button, Card, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Modal, PageHeader, Field, Empty, Pager, usePagination, Tabs, TabsList, TabsTrigger, Meter, SortHead, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui';
import { toast } from 'sonner';
import { ORG_ID } from '../../lib/supabase';

const blank: Product = {
  id: '', organization_id: ORG_ID, category_id: '', brand_id: '', name: '', sku: '',
  barcode: '', description: '', unit_id: '', cost_price: 0, selling_price: 0,
  minimum_price: 0, reorder_level: 10, reorder_quantity: 20, track_stock: true,
  allow_negative_stock: false, is_active: true, image_url: null, created_at: '', updated_at: '',
};

export function ProductsPage() {
  const { db, stockOf, upsertProduct, deleteProduct } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [tab, setTab] = useState<'products' | 'categories' | 'brands' | 'units'>('products');

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return db.products
      .filter((p) => (cat === 'all' ? true : p.category_id === cat))
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || (p.barcode ?? '').includes(s));
  }, [db.products, q, cat]);

  const [sort, setSort] = useState<{ key: 'name' | 'price' | 'stock'; dir: 1 | -1 } | null>(null);
  const flip = (key: 'name' | 'price' | 'stock') => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
    pg.setPage(1);
  };
  const dirOf = (key: 'name' | 'price' | 'stock'): 0 | 1 | -1 => (sort?.key === key ? sort.dir : 0);
  const sorted = useMemo(() => {
    if (!sort) return list;
    const arr = [...list];
    if (sort.key === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
    if (sort.key === 'price') arr.sort((a, b) => a.selling_price - b.selling_price);
    if (sort.key === 'stock') arr.sort((a, b) => stockOf(a.id) - stockOf(b.id));
    if (sort.dir === -1) arr.reverse();
    return arr;
  }, [list, sort, stockOf]);
  const pg = usePagination(sorted.length, 20);
  useEffect(() => { pg.reset(); }, [q, cat]);
  const rows = sorted.slice(pg.start, pg.start + pg.size);

  const save = (p: Product) => {
    if (!p.name || !p.sku) { toast.error('Name and SKU are required'); return; }
    const now = todayISO();
    if (!p.id) {
      upsertProduct({ ...p, id: uid('p'), organization_id: ORG_ID, created_at: now, updated_at: now });
      toast.success('Product created');
    } else {
      upsertProduct({ ...p, updated_at: now });
      toast.success('Product updated');
    }
    setEditing(null);
  };

  return (
    <div>
      <PageHeader
        title="Products"
        sub={`${db.products.filter((p) => p.is_active).length} active products`}
        icon={<Package aria-hidden />}
        actions={
          <>
            <Button variant="outline" onClick={() => downloadCSV('products.csv', db.products.map((p) => ({ sku: p.sku, name: p.name, cost: p.cost_price, price: p.selling_price, stock: stockOf(p.id) })))}>Export CSV</Button>
            <Button onClick={() => setEditing({ ...blank, category_id: db.categories[0]?.id ?? '', unit_id: db.units[0]?.id ?? '' })}><Plus size={15} /> New product</Button>
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-3">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'products' && (
        <>
          <div className="mb-3 flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="max-w-sm" />
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-48" aria-label="Category filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {db.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <div className="overflow-auto">
              <Table className="w-full min-w-[760px] text-[13px]">
                <TableHeader><TableRow>
                  <TableHead><SortHead label="Product" dir={dirOf('name')} onClick={() => flip('name')} /></TableHead><TableHead>SKU / Barcode</TableHead>
                  <TableHead className="text-right">Cost</TableHead><TableHead className="text-right"><SortHead label="Price" dir={dirOf('price')} onClick={() => flip('price')} /></TableHead>
                  <TableHead className="text-right"><SortHead label="Stock" dir={dirOf('stock')} onClick={() => flip('stock')} /></TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const st = stockOf(p.id);
                    const catName = db.categories.find((c) => c.id === p.category_id)?.name;
                    return (
                      <TableRow key={p.id}>
                        <TableCell><p className="font-medium">{p.name}</p><p className="text-xs text-zinc-400">{catName}</p></TableCell>
                        <TableCell className="font-mono text-xs">{p.sku}<br />{p.barcode}</TableCell>
                        <TableCell className="text-right">{fmtMoney(p.cost_price)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtMoney(p.selling_price)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Badge tone={st === 0 ? 'red' : st <= p.reorder_level ? 'amber' : 'green'}>{st}</Badge>
                            <span className="w-16"><Meter value={st} max={Math.max(1, p.reorder_level * 3)} tone={st <= p.reorder_level ? 'solid' : 'faint'} /></span>
                          </div>
                        </TableCell>
                        <TableCell>{p.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</TableCell>
                        <TableCell className="text-right">
                          <button onClick={() => setEditing({ ...p })} className="text-xs text-zinc-900 hover:underline">Edit</button>
                          {' · '}<button onClick={() => { deleteProduct(p.id); toast.success('Deactivated'); }} className="text-xs text-zinc-900 hover:underline">Delete</button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {list.length === 0 && <Empty title="No products found" />}
            <Pager page={pg.page} pages={pg.pages} total={sorted.length} size={pg.size} onPage={pg.setPage} onSize={pg.setSize} />
          </Card>
        </>
      )}

      {tab === 'categories' && (
        <Card className="p-4"><div className="grid gap-2 md:grid-cols-2">{db.categories.map((c) => (
          <div key={c.id} className="rounded-lg border border-zinc-200 p-3"><p className="font-medium">{c.name}</p><p className="text-xs text-zinc-500">{c.description} · {db.products.filter((p) => p.category_id === c.id).length} products</p></div>
        ))}</div></Card>
      )}
      {tab === 'brands' && (
        <Card className="p-4"><div className="flex flex-wrap gap-1.5">{db.brands.map((b) => (
          <Badge key={b.id} tone="slate">{b.name}</Badge>
        ))}</div></Card>
      )}
      {tab === 'units' && (
        <Card className="p-4"><div className="flex flex-wrap gap-1.5">{db.units.map((u) => (
          <Badge key={u.id} tone="slate">{u.name} ({u.short_name})</Badge>
        ))}</div></Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit product' : 'New product'} wide>
        {editing && <ProductForm p={editing} setP={setEditing} onSave={save} />}
      </Modal>
    </div>
  );
}

function ProductForm({ p, setP, onSave }: { p: Product; setP: (p: Product) => void; onSave: (p: Product) => void }) {
  const { db } = useStore();
  const set = (k: keyof Product, v: unknown) => setP({ ...p, [k]: v });
  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      <Field label="Name *"><Input value={p.name} onChange={(e) => set('name', e.target.value)} /></Field>
      <Field label="SKU *"><Input value={p.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
      <Field label="Barcode"><Input value={p.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} /></Field>
      <Field label="Category"><Select value={p.category_id} onValueChange={(v) => set('category_id', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{db.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Brand"><Select value={p.brand_id || 'none'} onValueChange={(v) => set('brand_id', v === 'none' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{db.brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Unit"><Select value={p.unit_id} onValueChange={(v) => set('unit_id', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{db.units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Cost price"><Input type="number" value={p.cost_price} onChange={(e) => set('cost_price', Number(e.target.value))} /></Field>
      <Field label="Selling price">
        <Input type="number" value={p.selling_price} onChange={(e) => set('selling_price', Number(e.target.value))} />
        {p.selling_price < p.cost_price && (
          <p className="mt-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">Selling below cost — this sale loses money.</p>
        )}
      </Field>
      <Field label="Minimum price"><Input type="number" value={p.minimum_price ?? 0} onChange={(e) => set('minimum_price', Number(e.target.value))} /></Field>
      <Field label="Reorder level"><Input type="number" value={p.reorder_level} onChange={(e) => set('reorder_level', Number(e.target.value))} /></Field>
      <div className="md:col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={() => onSave({ ...p, is_active: true })}>Save</Button><Button onClick={() => onSave(p)}>Save & close</Button></div>
    </div>
  );
}
