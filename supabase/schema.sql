-- ═══════════════════════════════════════════════════════════════════
-- Shwe Mini Mart · POS + Inventory + CRM — Supabase schema (Phase 1 MVP)
-- Spec: MINIMART_POS_INVENTORY_CRM.md §6–§30
-- Run in Supabase SQL Editor. UUID PKs, org-scoped rows, RLS everywhere.
-- ═══════════════════════════════════════════════════════════════════

-- extensions
create extension if not exists "pgcrypto";

-- NOTE: is_org_member() is created in the RLS section below, AFTER the
-- tables — SQL functions validate referenced relations at creation time.

-- ═══ org / branch / membership ══════════════════════════════════════
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  phone text, email text, address text,
  currency text not null default 'MMK',
  timezone text not null default 'Asia/Yangon',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, code text not null,
  phone text, address text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, code)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, -- owner/manager/cashier/inventory/viewer
  permissions jsonb not null default '[]',
  unique (organization_id, name)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid references public.roles(id),
  branch_id uuid references public.branches(id),
  email text,
  display_name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, user_id)
);

-- ═══ catalog ═════════════════════════════════════════════════════════
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, description text,
  parent_id uuid references public.categories(id),
  is_active boolean default true
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, is_active boolean default true,
  unique (organization_id, name)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, short_name text not null, allow_decimal boolean default false
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.categories(id),
  brand_id uuid references public.brands(id),
  name text not null, sku text not null,
  barcode text, description text,
  unit_id uuid references public.units(id),
  cost_price numeric(14,2) not null check (cost_price >= 0),
  selling_price numeric(14,2) not null check (selling_price >= 0),
  wholesale_price numeric(14,2),
  minimum_price numeric(14,2),
  reorder_level numeric(14,2) default 0,
  reorder_quantity numeric(14,2) default 0,
  track_stock boolean default true,
  allow_negative_stock boolean default false,
  is_active boolean default true,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, sku)
);
create index idx_products_org on public.products(organization_id);
create index idx_products_sku on public.products(sku);
create index idx_products_barcode on public.products(barcode);

create table public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  barcode text not null,
  is_primary boolean default false,
  created_at timestamptz default now(),
  unique (barcode)
);
create index idx_pbarcodes_barcode on public.product_barcodes(barcode);

-- ═══ inventory ═══════════════════════════════════════════════════════
create table public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(14,3) not null default 0,
  reserved_quantity numeric(14,3) default 0,
  average_cost numeric(14,2) default 0,
  updated_at timestamptz default now(),
  unique (branch_id, product_id)
);
create index idx_stock_branch on public.stock_balances(branch_id);
create index idx_stock_product on public.stock_balances(product_id);

do $$ begin
  create type movement_type as enum ('purchase','sale','sale_return','purchase_return','adjustment_in','adjustment_out','transfer_in','transfer_out','stocktake','opening_balance','damage','expired');
exception when duplicate_object then null; end $$;

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null,
  quantity numeric(14,3) not null,
  unit_cost numeric(14,2) default 0,
  reference_type text, reference_id text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create index idx_mov_product on public.stock_movements(product_id);
create index idx_mov_created on public.stock_movements(created_at desc);

-- ═══ suppliers / purchasing ══════════════════════════════════════════
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, contact_person text, phone text, email text,
  address text, tax_number text, notes text,
  credit_limit numeric(14,2), is_active boolean default true
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  purchase_number text not null,
  status text not null default 'draft' check (status in ('draft','ordered','partially_received','received','cancelled')),
  subtotal numeric(14,2) default 0, discount numeric(14,2) default 0,
  tax numeric(14,2) default 0, total numeric(14,2) default 0,
  paid_amount numeric(14,2) default 0, due_amount numeric(14,2) default 0,
  ordered_at timestamptz default now(), received_at timestamptz,
  created_by uuid references auth.users(id),
  unique (organization_id, purchase_number)
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  received_quantity numeric(14,3) default 0,
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  discount numeric(14,2) default 0, total numeric(14,2) default 0
);

-- ═══ sales / POS ═════════════════════════════════════════════════════
create table public.register_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  opening_cash numeric(14,2) default 0,
  closing_cash numeric(14,2), expected_cash numeric(14,2), cash_difference numeric(14,2),
  opened_at timestamptz default now(), closed_at timestamptz,
  status text default 'open' check (status in ('open','closed'))
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  register_session_id uuid references public.register_sessions(id),
  customer_id uuid, -- references customers(id), added below
  invoice_number text not null,
  status text default 'completed' check (status in ('completed','partially_paid','credit','returned','cancelled')),
  subtotal numeric(14,2) default 0, discount numeric(14,2) default 0,
  tax numeric(14,2) default 0, total numeric(14,2) default 0,
  paid_amount numeric(14,2) default 0, due_amount numeric(14,2) default 0,
  change_amount numeric(14,2) default 0,
  payments jsonb default '[]',
  cashier_id uuid references auth.users(id),
  sold_at timestamptz default now(),
  unique (organization_id, invoice_number)
);
create index idx_sales_org on public.sales(organization_id);
create index idx_sales_branch on public.sales(branch_id);
create index idx_sales_sold on public.sales(sold_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null, cost_price numeric(14,2) default 0,
  discount numeric(14,2) default 0, tax numeric(14,2) default 0, total numeric(14,2) default 0
);
create index idx_si_sale on public.sale_items(sale_id);

-- ═══ CRM ═════════════════════════════════════════════════════════════
create table public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, discount_pct numeric(5,2) default 0
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_code text not null, name text not null, phone text not null,
  email text, address text, date_of_birth date, gender text,
  group_id uuid references public.customer_groups(id),
  credit_limit numeric(14,2) default 0, current_balance numeric(14,2) default 0,
  loyalty_points integer default 0, notes text,
  is_active boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (organization_id, customer_code)
);
create index idx_cust_org on public.customers(organization_id);
create index idx_cust_phone on public.customers(phone);

alter table public.sales add constraint fk_sales_customer
  foreign key (customer_id) references public.customers(id) on delete set null;

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text check (kind in ('earned','redeemed','expired','adjusted')),
  points integer not null, reference_id text,
  created_at timestamptz default now()
);

-- ═══ expenses / audit ═══════════════════════════════════════════════
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  category text not null, amount numeric(14,2) not null check (amount >= 0),
  payment_method text, description text,
  expense_date date default current_date,
  created_by uuid references auth.users(id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null, entity_type text, entity_id text,
  old_values jsonb, new_values jsonb,
  created_at timestamptz default now()
);

-- ═══ RLS — org members only (no cross-org access) ═══════════════════
-- helper first (all tables above already exist)
create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.is_active = true
  );
$$;

alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.organization_members enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.units enable row level security;
alter table public.products enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_items enable row level security;
alter table public.register_sessions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.customer_groups enable row level security;
alter table public.customers enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;
alter table public.roles enable row level security;

-- members can read their own org row
create policy org_member_read on public.organizations for select using (
  exists (select 1 from public.organization_members m where m.organization_id = organizations.id and m.user_id = auth.uid() and m.is_active)
);
create policy roles_read on public.roles for select using (public.is_org_member(organization_id));
-- org-scoped tables: same pattern
create policy branches_rw on public.branches for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy members_read on public.organization_members for select using (public.is_org_member(organization_id));
create or replace function public.is_org_owner(org_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.organization_members m
    join public.roles r on r.id = m.role_id
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and r.name = 'owner'
  );
$$;
create policy members_admin on public.organization_members for update
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
create policy members_link on public.organization_members for insert
  with check (public.is_org_owner(organization_id));
create policy members_unlink on public.organization_members for delete
  using (public.is_org_owner(organization_id));
create policy roles_admin on public.roles for update
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
create policy cat_rw on public.categories for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy brand_rw on public.brands for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy unit_rw on public.units for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy prod_rw on public.products for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy pbc_read on public.product_barcodes for all using (
  exists (select 1 from public.products p where p.id = product_barcodes.product_id and public.is_org_member(p.organization_id))
);
create policy stock_rw on public.stock_balances for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy mov_rw on public.stock_movements for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy sup_rw on public.suppliers for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy po_rw on public.purchase_orders for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy pi_rw on public.purchase_items for all using (
  exists (select 1 from public.purchase_orders o where o.id = purchase_items.purchase_order_id and public.is_org_member(o.organization_id))
);
create policy reg_rw on public.register_sessions for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy sales_rw on public.sales for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy si_rw on public.sale_items for all using (
  exists (select 1 from public.sales s where s.id = sale_items.sale_id and public.is_org_member(s.organization_id))
);
create policy cg_rw on public.customer_groups for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy cust_rw on public.customers for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy loy_rw on public.loyalty_transactions for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy exp_rw on public.expenses for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy audit_r on public.audit_logs for select using (public.is_org_member(organization_id));
create policy audit_w on public.audit_logs for insert with check (public.is_org_member(organization_id));

create table public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  items jsonb not null default '[]',
  refund_amount numeric(14,2) default 0,
  refund_method text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.sale_returns enable row level security;
create policy sr_rw on public.sale_returns for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- ═══ transactional sale RPC (stock + sale atomically, v2) ═══════════════
create or replace function public.create_sale(
  p_org uuid,
  p_branch uuid,
  p_customer uuid,
  p_payments jsonb,
  p_discount numeric,
  p_items jsonb, -- [{product_id, quantity, unit_price, discount}]
  p_register uuid default null
) returns uuid language plpgsql security definer as $$
declare
  v_sale uuid; v_total numeric := 0; v_sub numeric := 0;
  v_paid numeric := 0; v_due numeric := 0; v_change numeric := 0;
  v_status text := 'completed';
  it jsonb; v_pid uuid; v_qty numeric; v_price numeric; v_disc numeric := 0;
  v_cost numeric; v_inv text; v_avail numeric; v_allow_neg boolean;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    v_price := (it->>'unit_price')::numeric;
    v_qty := (it->>'quantity')::numeric;
    v_disc := coalesce((it->>'discount')::numeric, 0);
    v_sub := v_sub + v_price * v_qty - v_disc;
  end loop;
  v_total := greatest(0, v_sub - coalesce(p_discount, 0));

  select coalesce(sum((x->>'amount')::numeric), 0) into v_paid
  from jsonb_array_elements(p_payments) x;
  v_due := greatest(0, v_total - v_paid);
  v_change := greatest(0, v_paid - v_total);
  if v_due = 0 then v_status := 'completed';
  elsif v_paid > 0 then v_status := 'partially_paid';
  else v_status := 'credit'; end if;

  v_inv := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.sales
    (organization_id, branch_id, register_session_id, customer_id, invoice_number,
     status, subtotal, discount, total, paid_amount, due_amount, change_amount,
     payments, cashier_id)
  values
    (p_org, p_branch, p_register, p_customer, v_inv,
     v_status, v_sub, coalesce(p_discount,0), v_total, v_paid, v_due, v_change,
     p_payments, auth.uid())
  returning id into v_sale;

  for it in select * from jsonb_array_elements(p_items) loop
    v_pid := (it->>'product_id')::uuid;
    v_qty := (it->>'quantity')::numeric;
    v_price := (it->>'unit_price')::numeric;
    v_disc := coalesce((it->>'discount')::numeric, 0);
    select cost_price, allow_negative_stock into v_cost, v_allow_neg
      from public.products where id = v_pid;
    if not found then
      raise exception 'Product % not found', v_pid;
    end if;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, cost_price, discount, total)
    values (v_sale, v_pid, v_qty, v_price, coalesce(v_cost,0), v_disc, v_price*v_qty - v_disc);

    select quantity into v_avail from public.stock_balances
      where branch_id = p_branch and product_id = v_pid for update;
    if not found then
      raise exception 'No stock row for product % in this branch', v_pid;
    end if;
    if v_avail - v_qty < 0 and coalesce(v_allow_neg, false) = false then
      raise exception 'Insufficient stock for product % (have %, need %)', v_pid, v_avail, v_qty;
    end if;
    update public.stock_balances set quantity = quantity - v_qty, updated_at = now()
      where branch_id = p_branch and product_id = v_pid;

    insert into public.stock_movements
      (organization_id, branch_id, product_id, movement_type, quantity, unit_cost,
       reference_type, reference_id, created_by)
    values
      (p_org, p_branch, v_pid, 'sale', -v_qty, coalesce(v_cost,0), 'sale', v_sale::text, auth.uid());
  end loop;

  if p_customer is not null then
    update public.customers
    set loyalty_points = loyalty_points + floor(v_total / 100)::int,
        current_balance = current_balance + v_due,
        updated_at = now()
    where id = p_customer;
    insert into public.loyalty_transactions (organization_id, customer_id, kind, points, reference_id)
    values (p_org, p_customer, 'earned', floor(v_total / 100)::int, v_sale::text);
  end if;

  return v_sale;
end $$;

-- ═══ storage buckets ═══════════════════════════════════════════════
insert into storage.buckets (id, name, public) values
  ('product-images','product-images', true),
  ('organization-assets','organization-assets', false),
  ('receipts','receipts', false),
  ('documents','documents', false)
on conflict (id) do nothing;
