import crypto from 'node:crypto';
import fs from 'node:fs';

// Usage:
//   1. node_modules/.bin/esbuild src/data/seed.ts --bundle --platform=node \
//        --format=cjs --outfile=.tmp-seed-bundle.cjs \
//        --define:import.meta.env.VITE_SUPABASE_URL='"x"' \
//        --define:import.meta.env.VITE_SUPABASE_ANON_KEY='"x"' --log-level=error
//   2. node scripts/emit-seed-sql.mjs > supabase/seed.sql
//
// All ids are deterministic (sha256 of the natural key) so the file is
// idempotent: every statement is ON CONFLICT DO NOTHING and re-running the
// same generated file is a safe no-op.

const bundlePath = process.argv[2] ?? '.tmp-seed-bundle.cjs';
const seed = await import('file://' + process.cwd() + '/' + bundlePath).then(
  (m) => m.default ?? m,
);

const uuidFor = (...parts) => {
  const h = crypto.createHash('sha256').update(parts.join('|')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const esc = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v === null || v === undefined ? 'NULL' : String(v));
const bool = (v) => (v ? 'TRUE' : 'FALSE');
const js = (v) => esc(JSON.stringify(v));

const out = [];
const ins = (table, cols, rows, conflict) => {
  if (!rows.length) return;
  out.push(`insert into public.${table} (${cols.join(', ')}) values`);
  out.push(rows.map((r) => `  (${r.join(', ')})`).join(',\n'));
  out.push(`on conflict ${conflict} do nothing;\n`);
};

const GRANTS = {
  owner: ['*'],
  manager: ['products.view', 'products.create', 'products.update', 'inventory.view', 'inventory.adjust', 'inventory.stocktake', 'sales.create', 'sales.refund', 'sales.discount', 'sales.price_override', 'customers.view', 'customers.create', 'customers.update', 'reports.view', 'reports.export', 'purchases.view', 'purchases.create'],
  cashier: ['products.view', 'sales.create', 'customers.view', 'customers.create', 'reports.view'],
  inventory: ['products.view', 'products.create', 'products.update', 'inventory.view', 'inventory.adjust', 'inventory.stocktake', 'purchases.view', 'purchases.create'],
  viewer: ['products.view', 'inventory.view', 'reports.view', 'reports.export'],
};

out.push('-- ═══════════════════════════════════════════════════════════════');
out.push('-- Shwe Mini Mart demo seed — generated, deterministic, idempotent.');
out.push('-- Run ONCE in Supabase SQL Editor AFTER schema.sql (+ migration-002).');
out.push('-- ═══════════════════════════════════════════════════════════════\n');

// org + branch
const orgId = uuidFor('org', seed.ORG.slug);
ins('organizations',
  ['id', 'name', 'slug', 'logo_url', 'phone', 'email', 'address', 'currency', 'timezone'],
  [[esc(orgId), esc(seed.ORG.name), esc(seed.ORG.slug), 'NULL', esc(seed.ORG.phone), esc(seed.ORG.email), esc(seed.ORG.address), esc('MMK'), esc('Asia/Yangon')]],
  '(slug)');
const branchId = uuidFor('branch', seed.ORG.slug, seed.BRANCH.code);
ins('branches',
  ['id', 'organization_id', 'name', 'code', 'phone', 'address', 'is_active'],
  [[esc(branchId), esc(orgId), esc(seed.BRANCH.name), esc(seed.BRANCH.code), esc(seed.BRANCH.phone), esc(seed.BRANCH.address), bool(true)]],
  '(organization_id, code)');

// roles
ins('roles', ['id', 'organization_id', 'name', 'permissions'],
  Object.entries(GRANTS).map(([name, perms]) => [esc(uuidFor('role', seed.ORG.slug, name)), esc(orgId), esc(name), js(perms)]),
  '(organization_id, name)');

// catalog
const catId = (c) => uuidFor('cat', seed.ORG.slug, c.name);
ins('categories', ['id', 'organization_id', 'name', 'description', 'parent_id', 'is_active'],
  seed.seedCategories.map((c) => [esc(catId(c)), esc(orgId), esc(c.name), esc(c.description ?? null), 'NULL', bool(c.is_active)]),
  '(id)');
const unitId = (u) => uuidFor('unit', seed.ORG.slug, u.short_name);
ins('units', ['id', 'organization_id', 'name', 'short_name', 'allow_decimal'],
  seed.seedUnits.map((u) => [esc(unitId(u)), esc(orgId), esc(u.name), esc(u.short_name), bool(u.allow_decimal)]),
  '(id)');
const brandId = (b) => uuidFor('brand', seed.ORG.slug, b.name);
ins('brands', ['id', 'organization_id', 'name', 'is_active'],
  seed.seedBrands.map((b) => [esc(brandId(b)), esc(orgId), esc(b.name), bool(b.is_active)]),
  '(organization_id, name)');

// customer groups
ins('customer_groups', ['id', 'organization_id', 'name', 'discount_pct'],
  seed.seedGroups.map((g) => [esc(uuidFor('grp', seed.ORG.slug, g.name)), esc(orgId), esc(g.name), num(g.discount_pct)]),
  '(id)');
const groupById = Object.fromEntries(seed.seedGroups.map((g) => [g.id, uuidFor('grp', seed.ORG.slug, g.name)]));

// suppliers
ins('suppliers',
  ['id', 'organization_id', 'name', 'contact_person', 'phone', 'email', 'address', 'tax_number', 'notes', 'credit_limit', 'is_active'],
  seed.seedSuppliers.map((s) => [esc(uuidFor('sup', seed.ORG.slug, s.name)), esc(orgId), esc(s.name), esc(s.contact_person), esc(s.phone), esc(s.email), esc(s.address), 'NULL', 'NULL', num(s.credit_limit ?? null), bool(s.is_active)]),
  '(id)');

// customers
const customers = seed.buildSeedCustomers();
ins('customers',
  ['id', 'organization_id', 'customer_code', 'name', 'phone', 'email', 'address', 'date_of_birth', 'gender', 'group_id', 'credit_limit', 'current_balance', 'loyalty_points', 'notes', 'is_active'],
  customers.map((c) => [esc(uuidFor('cus', seed.ORG.slug, c.customer_code)), esc(orgId), esc(c.customer_code), esc(c.name), esc(c.phone), esc(c.email ?? null), esc(c.address ?? null), 'NULL', 'NULL', c.group_id && groupById[c.group_id] ? esc(groupById[c.group_id]) : 'NULL', num(c.credit_limit), num(0), num(c.loyalty_points), 'NULL', bool(c.is_active)]),
  '(organization_id, customer_code)');

// products (+ primary barcode, stock, opening movement)
const products = seed.buildSeedProducts();
const catById = Object.fromEntries(seed.seedCategories.map((c) => [c.id, catId(c)]));
const brandById = Object.fromEntries(seed.seedBrands.map((b) => [b.id, brandId(b)]));
const unitById = Object.fromEntries(seed.seedUnits.map((u) => [u.id, unitId(u)]));
const prodId = (p) => uuidFor('prod', seed.ORG.slug, p.sku);
ins('products',
  ['id', 'organization_id', 'category_id', 'brand_id', 'name', 'sku', 'barcode', 'description', 'unit_id', 'cost_price', 'selling_price', 'wholesale_price', 'minimum_price', 'reorder_level', 'reorder_quantity', 'track_stock', 'allow_negative_stock', 'is_active', 'image_url'],
  products.map((p) => [esc(prodId(p)), esc(orgId), esc(catById[p.category_id]), p.brand_id && brandById[p.brand_id] ? esc(brandById[p.brand_id]) : 'NULL', esc(p.name), esc(p.sku), esc(p.barcode ?? null), esc(p.description || null), esc(unitById[p.unit_id]), num(p.cost_price), num(p.selling_price), 'NULL', num(p.minimum_price ?? null), num(p.reorder_level), num(p.reorder_quantity), bool(p.track_stock), bool(p.allow_negative_stock), bool(p.is_active), 'NULL']),
  '(organization_id, sku)');
ins('product_barcodes', ['id', 'product_id', 'barcode', 'is_primary'],
  products.filter((p) => p.barcode).map((p) => [esc(uuidFor('bc', p.barcode)), esc(prodId(p)), esc(p.barcode), bool(true)]),
  '(barcode)');
ins('stock_balances', ['id', 'organization_id', 'branch_id', 'product_id', 'quantity', 'reserved_quantity', 'average_cost'],
  products.map((p) => {
    const q = seed.openingStockQty(p.id);
    return [esc(uuidFor('sb', branchId, p.sku)), esc(orgId), esc(branchId), esc(prodId(p)), num(q), num(0), num(p.cost_price)];
  }),
  '(branch_id, product_id)');
ins('stock_movements',
  ['id', 'organization_id', 'branch_id', 'product_id', 'movement_type', 'quantity', 'unit_cost', 'reference_type', 'reference_id', 'notes', 'created_by'],
  products.map((p) => {
    const q = seed.openingStockQty(p.id);
    return [esc(uuidFor('mv-open', p.sku)), esc(orgId), esc(branchId), esc(prodId(p)), esc('opening_balance'), num(q), num(p.cost_price), esc('opening'), esc('OPENING'), esc('Opening balance'), 'NULL'];
  }),
  '(id)');

out.push('-- verification');
out.push(`select 'organizations' t, count(*) from public.organizations where slug = ${esc(seed.ORG.slug)};`);
out.push(`select 'products' t, count(*) from public.products where organization_id = ${esc(orgId)};`);
out.push(`select 'customers' t, count(*) from public.customers where organization_id = ${esc(orgId)};`);
out.push(`select 'stock_balances' t, count(*) from public.stock_balances where organization_id = ${esc(orgId)};`);

fs.writeFileSync(1, out.join('\n') + '\n');
