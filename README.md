# Shwe Mini Mart · POS + Inventory + CRM (Phase 1 MVP)

Modern Mini Mart management demo built from `MINIMART_POS_INVENTORY_CRM.md`:
**Buy stock → receive → sell via POS → inventory updates → CRM → cash → reports → reorder.**

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173, auto-redirects to /dashboard
npm run build      # production build (passes)
```

No Supabase keys needed to try it — the app runs in **local demo mode**
(seed: ~80 Myanmar products, 10 suppliers, 101 customers, ~500 sales)
persisted to `localStorage` (`mm-pos-v1`). Reset anytime in **Settings**.

## Demo login (no password)

| Email | Role | Sees |
|---|---|---|
| `owner@demo.mm` | Owner | everything |
| `manager@demo.mm` | Manager | everything except user mgmt |
| `cashier@demo.mm` | Cashier | POS, customers, own sales, register |
| `inventory@demo.mm` | Inventory | products, stock, receiving, suppliers |
| `viewer@demo.mm` | Viewer | reports only |

## MVP workflow (acceptance-tested path)

```
Login → Products (create product) → Inventory (adjust +opening stock)
→ POS (search/scan → cart → discount → customer → PAY split → receipt)
→ stock decreases + movement recorded + loyalty earned + dashboard updates
→ Sales (return/refund) → Purchases (receive → stock up)
→ Register (open/close, cash diff) → Reports (sales/inventory/profit)
```

## Routes (per spec §39)

`/login` · `/dashboard` · `/pos` · `/products` · `/categories` · `/inventory`
· `/purchases` · `/suppliers` · `/customers` · `/sales` · `/returns`
· `/register` · `/expenses` · `/reports/*` · `/staff` · `/roles`
· `/settings` · `/audit-logs`

## Connect Supabase (live mode)

Status: wired. With `.env` present the app boots in **Supabase live** mode:
Supabase Auth login, server hydration, atomic sales via `create_sale` RPC,
and write-through sync (local demo remains the fallback without `.env`).

Run once, in order, in SQL Editor / Dashboard:

1. In Supabase SQL Editor, run **`supabase/schema.sql`**
   (tables + indexes + RLS + `create_sale()` RPC + storage buckets).
2. Copy `.env.example` → `.env` and paste your project values:
   ```
   VITE_SUPABASE_URL=https://xyz.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbG...
   ```
3. Restart `npm run dev`. Settings page will show **“Supabase connected”**.
   The client uses the **anon key only** — never service_role in the browser.

> Current build ships the full schema + RLS + RPC so your Supabase
> can be wired table-for-table; the UI store layer (`src/store/AppStore.tsx`)
> is the single swap point to move reads/writes from localStorage to Supabase.

## Structure

```
src/
  app/router.tsx providers.tsx     # all §39 routes + TanStack Query
  types/index.ts                   # §6–§27 domain types
  lib/supabase.ts permissions.ts formatters.ts
  data/seed.ts                     # MMK Myanmar demo data
  store/AppStore.tsx               # transactional store: sale/return/purchase/adjust/register
  components/ui.tsx layout.tsx
  features/auth dashboard pos catalog inventory purchasing
           suppliers customers sales register ops reports
supabase/schema.sql                # Postgres + RLS + RPC
```

## Notes

- Every stock change writes a `stock_movements` row (§9, principle §51).
- Sales store `cost_price` at sale time so historical profit stays accurate (§16).
- Discounts / price overrides / refunds are permission-gated (§5).
- Currency **MMK**, timezone **Asia/Yangon**.
