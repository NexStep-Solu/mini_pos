-- ═══════════════════════════════════════════════════════════════════
-- FIX: recreate the RLS helper + every policy (idempotent — safe to re-run)
--
-- Why: in schema.sql the is_org_member() helper was created BEFORE the
-- organization_members table, so its creation failed with
--   42P01: relation "public.organization_members" does not exist
-- The editor kept going (tables exist) but the helper and all policies
-- that call it were never created. Run THIS file once to repair.
-- (schema.sql itself is fixed too — helper now lives after the tables.)
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.is_active = true
  );
$$;

drop policy if exists org_member_read on public.organizations;
create policy org_member_read on public.organizations for select using (
  exists (select 1 from public.organization_members m where m.organization_id = organizations.id and m.user_id = auth.uid() and m.is_active)
);

drop policy if exists branches_rw on public.branches;
create policy branches_rw on public.branches for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists members_read on public.organization_members;
create policy members_read on public.organization_members for select using (public.is_org_member(organization_id));

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select using (public.is_org_member(organization_id));

drop policy if exists cat_rw on public.categories;
create policy cat_rw on public.categories for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists brand_rw on public.brands;
create policy brand_rw on public.brands for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists unit_rw on public.units;
create policy unit_rw on public.units for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists prod_rw on public.products;
create policy prod_rw on public.products for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists pbc_read on public.product_barcodes;
create policy pbc_read on public.product_barcodes for all using (
  exists (select 1 from public.products p where p.id = product_barcodes.product_id and public.is_org_member(p.organization_id))
);

drop policy if exists stock_rw on public.stock_balances;
create policy stock_rw on public.stock_balances for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists mov_rw on public.stock_movements;
create policy mov_rw on public.stock_movements for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists sup_rw on public.suppliers;
create policy sup_rw on public.suppliers for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists po_rw on public.purchase_orders;
create policy po_rw on public.purchase_orders for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists pi_rw on public.purchase_items;
create policy pi_rw on public.purchase_items for all using (
  exists (select 1 from public.purchase_orders o where o.id = purchase_items.purchase_order_id and public.is_org_member(o.organization_id))
);

drop policy if exists reg_rw on public.register_sessions;
create policy reg_rw on public.register_sessions for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists sales_rw on public.sales;
create policy sales_rw on public.sales for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists si_rw on public.sale_items;
create policy si_rw on public.sale_items for all using (
  exists (select 1 from public.sales s where s.id = sale_items.sale_id and public.is_org_member(s.organization_id))
);

drop policy if exists sr_rw on public.sale_returns;
create policy sr_rw on public.sale_returns for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists cg_rw on public.customer_groups;
create policy cg_rw on public.customer_groups for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists cust_rw on public.customers;
create policy cust_rw on public.customers for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists loy_rw on public.loyalty_transactions;
create policy loy_rw on public.loyalty_transactions for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists exp_rw on public.expenses;
create policy exp_rw on public.expenses for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists audit_r on public.audit_logs;
create policy audit_r on public.audit_logs for select using (public.is_org_member(organization_id));

drop policy if exists audit_w on public.audit_logs;
create policy audit_w on public.audit_logs for insert with check (public.is_org_member(organization_id));

-- verification: expect helper + ~24 policies
select 'helper' as kind, proname as name from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'is_org_member'
union all
select 'policy', policyname from pg_policies where schemaname = 'public' order by 1, 2;
