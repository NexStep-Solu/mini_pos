-- ═══════════════════════════════════════════════════════════════════
-- Migration 003 — Staff management (idempotent, safe to re-run)
--   1. email + display_name on organization_members (staff list needs them;
--      auth.users is not readable via the API)
--   2. is_org_owner() helper + owner-only write policies on memberships
--      (link / change role / deactivate) and on roles (permission matrix)
-- Run AFTER migration-002. Then re-run demo-users.sql to backfill emails.
-- ═══════════════════════════════════════════════════════════════════

alter table public.organization_members
  add column if not exists email text;
alter table public.organization_members
  add column if not exists display_name text;

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

drop policy if exists members_admin on public.organization_members;
create policy members_admin on public.organization_members for update
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));

drop policy if exists members_link on public.organization_members;
create policy members_link on public.organization_members for insert
  with check (public.is_org_owner(organization_id));

drop policy if exists members_unlink on public.organization_members;
create policy members_unlink on public.organization_members for delete
  using (public.is_org_owner(organization_id));

drop policy if exists roles_admin on public.roles;
create policy roles_admin on public.roles for update
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
