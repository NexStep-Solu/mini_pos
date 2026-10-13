-- ═══════════════════════════════════════════════════════════════════
-- Demo logins — run AFTER seed.sql
--
-- STEP 1: In Supabase Dashboard → Authentication → Users → "Add user" →
--         "Create new user". Create these 5 (use any strong password,
--         e.g. Demo1234! — check "Auto Confirm User"):
--           owner@demo.mm | manager@demo.mm | cashier@demo.mm
--           inventory@demo.mm | viewer@demo.mm
-- STEP 2: Copy each user's UUID (open the user → copy UID) and paste below.
-- STEP 3: Run this whole file in SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

-- ↓↓↓ Edit the five literal UUIDs directly in the INSERT below, then run it. ↓↓↓

insert into public.organization_members (organization_id, user_id, role_id, branch_id, email, display_name, is_active)
select o.id, x.user_id, r.id, b.id, x.email, x.display_name, true
from public.organizations o
cross join public.branches b
cross join (
  values
    ('1ad0ddc4-14b8-428f-bc53-92ba98e6b915'::uuid, 'owner', 'thura3.shine33@gmail.com', 'Owner')
    -- add more rows as you create the users, e.g.:
    -- , ('MANAGER_UUID_HERE'::uuid, 'manager', 'manager@demo.mm', 'U Manager')
    -- , ('CASHIER_UUID_HERE'::uuid, 'cashier', 'cashier@demo.mm', 'Ma Cashier')
    -- , ('INVENTORY_UUID_HERE'::uuid, 'inventory', 'inventory@demo.mm', 'Ko Inventory')
    -- , ('VIEWER_UUID_HERE'::uuid, 'viewer', 'viewer@demo.mm', 'U Viewer')
) as x(user_id, role_name, email, display_name)
join public.roles r
  on r.organization_id = o.id and r.name = x.role_name
where o.slug = 'shwe-mini-mart'
  and b.organization_id = o.id
  and b.code = 'KM-01'
on conflict (organization_id, user_id) do update
  set role_id = excluded.role_id, branch_id = excluded.branch_id,
      email = excluded.email, display_name = excluded.display_name, is_active = true;

-- optional: friendly display names (postgres role in SQL Editor can do this)
-- update auth.users set raw_user_meta_data = raw_user_meta_data || '{"name":"Daw Owner"}'
-- where email = 'owner@demo.mm';
