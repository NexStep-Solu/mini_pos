-- ═══════════════════════════════════════════════════════════════════
-- Migration 002 — run AFTER schema.sql (one time, in SQL Editor)
--   1. sale_returns table (POS returns need a home)
--   2. audit_logs INSERT policy (members can write, not just read)
--   3. roles RLS (was unintentionally open) + member read policy
--   4. create_sale v2: partial/credit payments, register link, loyalty,
--      negative-stock guard, server invoice numbers
-- All statements are idempotent (IF NOT EXISTS / OR REPLACE / DROP POLICY).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. sale_returns ──────────────────────────────────────────────────
create table if not exists public.sale_returns (
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
drop policy if exists sr_rw on public.sale_returns;
create policy sr_rw on public.sale_returns for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- ── 2. audit write ───────────────────────────────────────────────────
drop policy if exists audit_w on public.audit_logs;
create policy audit_w on public.audit_logs for insert
  with check (public.is_org_member(organization_id));

-- ── 3. roles lockdown ────────────────────────────────────────────────
alter table public.roles enable row level security;
drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select
  using (public.is_org_member(organization_id));

-- ── 4. create_sale v2 ────────────────────────────────────────────────
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
