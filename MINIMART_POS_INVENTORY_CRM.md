# Mini Mart POS + Inventory + CRM

## 1. Product Vision

Build a modern, customizable **Mini Mart Management System** for small
and medium retail shops.

The first version is a polished demo product that can be shown to real
business owners. It should solve the daily workflow:

> Buy stock → receive stock → store stock → sell through POS → update
> inventory → manage customers → track cash → analyze sales → reorder.

The architecture must remain reusable so the same core can later be
customized for pharmacies, cosmetics shops, electronics shops,
convenience stores, and other retail businesses.

### Target users

-   Shop owner
-   Manager
-   Cashier
-   Inventory staff
-   Purchasing staff
-   Accountant/report viewer
-   Future: multi-branch administrator

### Product goals

1.  Extremely fast POS workflow.
2.  Simple inventory management.
3.  Useful customer/CRM features without unnecessary complexity.
4.  Accurate stock movement history.
5.  Clear daily/monthly business reporting.
6.  Role-based access.
7.  Strong Supabase Row Level Security.
8.  Responsive management interface.
9.  Demo-ready realistic sample data.
10. Architecture ready for future multi-branch/custom client
    deployments.

------------------------------------------------------------------------

# 2. Recommended Stack

## Frontend

-   React
-   Vite
-   TypeScript
-   Tailwind CSS
-   shadcn/ui
-   Lucide React
-   React Router
-   TanStack Query
-   React Hook Form
-   Zod
-   Recharts
-   date-fns
-   Sonner
-   PWA support

## Backend / Platform

-   Supabase
    -   PostgreSQL
    -   Supabase Auth
    -   Row Level Security
    -   Storage
    -   Realtime
    -   Edge Functions
    -   scheduled jobs where appropriate

## Deployment

-   Vercel
-   GitHub

## Recommended principle

Keep business logic close to the database where data integrity matters.

Use:

-   SQL functions / RPC for transactional operations
-   RLS for authorization boundaries
-   Edge Functions for privileged or external integrations
-   React only for UI state and presentation

Do not put sensitive service-role keys in Vite client code.

------------------------------------------------------------------------

# 3. Architecture

``` text
React + Vite
     │
     ├── UI / POS
     ├── Forms
     ├── Dashboards
     └── Reports
     │
     ↓
TanStack Query
     │
     ↓
Supabase
     ├── Auth
     ├── PostgreSQL
     ├── RLS
     ├── Storage
     ├── Realtime
     └── Edge Functions
     │
     ↓
Vercel
```

Future:

``` text
                    Mini Mart Platform
                           │
          ┌────────────────┼────────────────┐
          │                │                │
        Retail          Pharmacy        Electronics
          │                │                │
       POS/Core          POS/Core         POS/Core
       Inventory         Inventory        Inventory
       CRM/Core          CRM/Core         CRM/Core
```

------------------------------------------------------------------------

# 4. Core Modules

## Phase 1 --- Foundation

-   Authentication
-   User profile
-   Organization/store
-   Roles
-   Permissions
-   Branch
-   Settings
-   Audit logs
-   Dashboard shell
-   Navigation
-   Theme
-   Notifications

## Phase 2 --- Product & Inventory

-   Products
-   Categories
-   Brands
-   Units
-   Barcodes
-   Product variants
-   Purchase cost
-   Selling price
-   Minimum stock
-   Current stock
-   Stock movements
-   Stock adjustments
-   Stocktake
-   Inventory valuation
-   Low-stock alerts

## Phase 3 --- Purchasing

-   Suppliers
-   Purchase orders
-   Receiving
-   Purchase invoices
-   Purchase returns
-   Supplier balances
-   Purchase history

## Phase 4 --- POS

-   Product search
-   Barcode scanning
-   Cart
-   Quantity
-   Price override permission
-   Discounts
-   Customer selection
-   Payment
-   Split payment
-   Receipt
-   Hold/resume sale
-   Returns
-   Refunds
-   Cash drawer/session

## Phase 5 --- CRM

-   Customers
-   Customer groups
-   Purchase history
-   Loyalty points
-   Customer balance
-   Credit/due sales
-   Notes
-   Tags
-   Birthday/important dates
-   Customer lifetime value

## Phase 6 --- Reports

-   Daily sales
-   Monthly sales
-   Gross profit
-   Net sales
-   Product performance
-   Category performance
-   Cashier performance
-   Payment methods
-   Inventory value
-   Low stock
-   Dead stock
-   Purchase reports
-   Customer reports
-   Expenses
-   Profit trends

------------------------------------------------------------------------

# 5. Roles

## Owner

Full access.

## Manager

-   Dashboard
-   Sales
-   Inventory
-   Purchasing
-   Customers
-   Reports
-   Staff management where permitted

## Cashier

-   POS
-   Customers
-   Own sales
-   Register/session
-   Returns only with permission

## Inventory Staff

-   Products
-   Stock
-   Receiving
-   Stocktake
-   Transfers
-   Suppliers

## Accountant / Viewer

-   Reports
-   Sales
-   Purchases
-   Expenses
-   Financial summaries

Permissions should be granular:

``` text
products.view
products.create
products.update
products.delete

inventory.view
inventory.adjust
inventory.stocktake

sales.create
sales.refund
sales.discount
sales.price_override

customers.view
customers.create
customers.update

reports.view
reports.export

settings.manage
users.manage
```

------------------------------------------------------------------------

# 6. Database Design

Use UUID primary keys.

Every business-owned record should be associated with an organization.

For future multi-branch support, use:

``` text
organizations
branches
users
organization_members
```

## organizations

``` text
id
name
slug
logo_url
phone
email
address
currency
timezone
created_at
updated_at
```

## branches

``` text
id
organization_id
name
code
phone
address
is_active
created_at
updated_at
```

## organization_members

``` text
id
organization_id
user_id
role_id
branch_id nullable
is_active
created_at
updated_at
```

------------------------------------------------------------------------

# 7. Products

## products

``` text
id
organization_id
category_id
brand_id nullable
name
sku
barcode nullable
description
unit_id
cost_price
selling_price
wholesale_price nullable
minimum_price nullable
reorder_level
reorder_quantity
track_stock
allow_negative_stock
is_active
image_url nullable
created_at
updated_at
```

## categories

``` text
id
organization_id
name
description
parent_id nullable
is_active
```

## brands

``` text
id
organization_id
name
is_active
```

## units

``` text
id
organization_id
name
short_name
allow_decimal
```

Future examples:

-   piece
-   bottle
-   box
-   pack
-   kg
-   g
-   litre

------------------------------------------------------------------------

# 8. Barcodes

Support:

-   Product barcode
-   Multiple barcodes per product
-   Internal SKU
-   Future weighted barcode

Table:

``` text
product_barcodes
id
product_id
barcode
is_primary
created_at
```

Barcode search must be indexed.

------------------------------------------------------------------------

# 9. Inventory

## stock_balances

``` text
id
organization_id
branch_id
product_id
quantity
reserved_quantity
average_cost
updated_at
```

Unique:

``` text
(branch_id, product_id)
```

## stock_movements

``` text
id
organization_id
branch_id
product_id
movement_type
quantity
unit_cost
reference_type
reference_id
notes
created_by
created_at
```

Movement types:

``` text
purchase
sale
sale_return
purchase_return
adjustment_in
adjustment_out
transfer_in
transfer_out
stocktake
opening_balance
damage
expired
```

Never directly modify stock without recording a stock movement.

------------------------------------------------------------------------

# 10. Stocktake

Workflow:

``` text
Create Stocktake
      ↓
System snapshot
      ↓
Staff counts physical stock
      ↓
Enter counted quantity
      ↓
Calculate variance
      ↓
Manager confirms
      ↓
Create adjustment movements
```

Show:

-   System quantity
-   Counted quantity
-   Variance
-   Cost impact
-   User
-   Date

------------------------------------------------------------------------

# 11. Low Stock

Product should have:

``` text
reorder_level
reorder_quantity
```

When:

``` text
current_stock <= reorder_level
```

create an alert.

Future:

-   Automatic reorder suggestions
-   Supplier recommendation
-   Purchase order generation

------------------------------------------------------------------------

# 12. Suppliers

## suppliers

``` text
id
organization_id
name
contact_person
phone
email
address
tax_number nullable
notes
credit_limit nullable
is_active
```

Support:

-   Supplier balance
-   Purchase history
-   Payment history
-   Outstanding invoices

------------------------------------------------------------------------

# 13. Purchasing

## purchase_orders

``` text
id
organization_id
branch_id
supplier_id
purchase_number
status
subtotal
discount
tax
total
paid_amount
due_amount
ordered_at
received_at nullable
created_by
```

Statuses:

``` text
draft
ordered
partially_received
received
cancelled
```

## purchase_items

``` text
id
purchase_order_id
product_id
quantity
received_quantity
unit_cost
discount
total
```

Receiving stock must create stock movements.

------------------------------------------------------------------------

# 14. POS

The POS must prioritize speed.

Recommended layout:

``` text
┌───────────────────────────────────────────────┐
│ Search / Scan Barcode                         │
├───────────────────────┬───────────────────────┤
│                       │                       │
│ Product Grid          │ Cart                  │
│                       │                       │
│ Coca Cola             │ Coca Cola x2          │
│ Coffee                │ Coffee x1             │
│ Bread                 │                       │
│ Milk                  │                       │
│                       │ Subtotal              │
│                       │ Discount              │
│                       │ TOTAL                 │
│                       │                       │
│                       │ [PAY]                 │
└───────────────────────┴───────────────────────┘
```

## POS requirements

-   Barcode scanner
-   Keyboard-first workflow
-   Search by SKU
-   Search by barcode
-   Search by name
-   Category filtering
-   Product quick buttons
-   Quantity editing
-   Remove item
-   Discount
-   Customer
-   Notes
-   Hold sale
-   Resume sale
-   Price override
-   Tax if required
-   Payment
-   Receipt printing
-   Reprint receipt
-   Return
-   Refund

------------------------------------------------------------------------

# 15. Payment Methods

Start with:

``` text
cash
card
bank_transfer
mobile_wallet
credit
```

Make payment methods configurable.

Future:

-   QR payments
-   Multiple local wallets
-   Payment gateway integration
-   Split payment

Example:

``` text
Total: 25,000

Cash: 10,000
Card: 15,000
```

------------------------------------------------------------------------

# 16. Sales Database

## sales

``` text
id
organization_id
branch_id
register_session_id
customer_id nullable
invoice_number
status
subtotal
discount
tax
total
paid_amount
due_amount
change_amount
cashier_id
sold_at
```

Statuses:

``` text
completed
partially_paid
credit
returned
cancelled
```

## sale_items

``` text
id
sale_id
product_id
quantity
unit_price
cost_price
discount
tax
total
```

Store the cost price at the time of sale so historical profit remains
accurate.

------------------------------------------------------------------------

# 17. Returns

Support:

``` text
full return
partial return
```

Workflow:

``` text
Original Sale
     ↓
Select items
     ↓
Return quantity
     ↓
Reason
     ↓
Refund
     ↓
Stock movement
```

Return reasons:

-   Customer return
-   Damaged
-   Wrong product
-   Duplicate sale
-   Other

------------------------------------------------------------------------

# 18. Cash Register

## register_sessions

``` text
id
organization_id
branch_id
user_id
opening_cash
closing_cash
expected_cash
cash_difference
opened_at
closed_at
status
```

Workflow:

``` text
Open Register
     ↓
Sales
     ↓
Cash in/out
     ↓
Close Register
     ↓
Count cash
     ↓
Compare expected vs actual
```

Support cash movements:

-   Cash sale
-   Cash refund
-   Cash expense
-   Cash in
-   Cash out

------------------------------------------------------------------------

# 19. Expenses

## expenses

``` text
id
organization_id
branch_id
category_id
amount
payment_method
description
expense_date
created_by
```

Examples:

-   Electricity
-   Rent
-   Transport
-   Packaging
-   Staff expense
-   Maintenance
-   Other

------------------------------------------------------------------------

# 20. CRM

## customers

``` text
id
organization_id
customer_code
name
phone
email
address
date_of_birth nullable
gender nullable
group_id nullable
credit_limit
current_balance
loyalty_points
notes
is_active
created_at
updated_at
```

Avoid collecting unnecessary personal information.

------------------------------------------------------------------------

# 21. Customer Groups

Examples:

``` text
Walk-in
Regular
VIP
Wholesale
Staff
Business
```

Groups can later control:

-   Pricing
-   Discounts
-   Loyalty multipliers
-   Credit limits
-   Promotions

------------------------------------------------------------------------

# 22. Loyalty

Basic version:

``` text
1 currency unit = configurable points
```

Example:

``` text
Purchase: 50,000
Points: 500
```

Tables:

``` text
loyalty_accounts
loyalty_transactions
loyalty_rewards
```

Never silently change a customer's points.

Record:

``` text
earned
redeemed
expired
adjusted
```

------------------------------------------------------------------------

# 23. CRM Analytics

Customer profile should show:

``` text
Total purchases
Total spending
Average order value
Last purchase
Purchase frequency
Top categories
Top products
Current due
Loyalty points
```

Future:

``` text
Customer Lifetime Value
Churn risk
Inactive customers
High-value customers
Frequent buyers
Promotion response
```

------------------------------------------------------------------------

# 24. Discounts & Promotions

Basic:

-   Item discount
-   Cart discount
-   Percentage
-   Fixed amount
-   Manager-only discount

Future:

``` text
Buy 1 Get 1
Buy X Get Y
Category promotion
Customer group pricing
Happy hour
Date-based promotion
Coupon codes
Loyalty redemption
```

Promotion rules must be deterministic and auditable.

------------------------------------------------------------------------

# 25. Dashboard

Owner dashboard:

``` text
Today's Sales
Today's Orders
Today's Profit
Customers
Low Stock
Outstanding Credit
```

Charts:

-   Sales by day
-   Sales by payment method
-   Top products
-   Top categories
-   Gross profit
-   Purchase trend
-   Customer growth

Add date filters:

``` text
Today
Yesterday
7 days
30 days
This month
Last month
Custom
```

------------------------------------------------------------------------

# 26. Reports

## Sales

-   Sales summary
-   Sales by product
-   Sales by category
-   Sales by cashier
-   Sales by customer
-   Sales by branch
-   Sales by payment method
-   Returns

## Inventory

-   Current stock
-   Stock valuation
-   Stock movement
-   Low stock
-   Out of stock
-   Dead stock
-   Fast-moving products
-   Slow-moving products
-   Stock adjustment

## Purchasing

-   Purchases
-   Supplier purchases
-   Purchase returns
-   Supplier balances

## CRM

-   Customer growth
-   Customer spending
-   Top customers
-   Inactive customers
-   Loyalty activity

## Financial

-   Gross sales
-   Discounts
-   Returns
-   Cost of goods sold
-   Gross profit
-   Expenses
-   Net profit estimate

------------------------------------------------------------------------

# 27. Audit Logs

Important actions must be logged.

Examples:

``` text
product.created
product.updated
product.deleted

sale.created
sale.refunded
sale.cancelled

stock.adjusted
purchase.received

customer.updated
discount.applied

user.created
permission.changed
settings.changed
```

Audit fields:

``` text
id
organization_id
user_id
action
entity_type
entity_id
old_values
new_values
ip_address nullable
user_agent nullable
created_at
```

Do not expose sensitive audit information to ordinary cashiers.

------------------------------------------------------------------------

# 28. Notifications

Start with:

-   Low stock
-   Out of stock
-   Register not closed
-   Large discount
-   Large refund
-   Credit limit exceeded

Future:

-   Expiring products
-   Unusual sales activity
-   Supplier payment due
-   Daily summary
-   Weekly owner summary

------------------------------------------------------------------------

# 29. Security

Supabase RLS is mandatory.

Every organization-owned table must prevent cross-organization access.

Core rule:

``` text
User can only access data belonging to organizations
where the user is an active member.
```

Branch-level users should additionally be restricted to assigned
branches where applicable.

Never use:

``` text
SUPABASE_SERVICE_ROLE_KEY
```

in the browser.

Use service-role credentials only in secure server-side environments
such as Edge Functions.

Validate all important operations both client-side and
server-side/database-side.

------------------------------------------------------------------------

# 30. Database Integrity

Use database constraints for:

-   Positive/valid quantities
-   Valid prices
-   Unique SKU per organization
-   Unique barcode where required
-   Unique invoice numbers
-   Foreign keys
-   Unique organization/branch combinations
-   Valid enum/status values

Use database transactions for:

``` text
sale creation
sale return
purchase receiving
stock adjustment
stock transfer
register closing
```

A POS sale should not succeed if its inventory transaction fails.

------------------------------------------------------------------------

# 31. Supabase Realtime

Use realtime selectively.

Good candidates:

-   Register/session state
-   Stock changes
-   New orders
-   Notifications
-   Multi-user dashboard updates

Do not subscribe every client to every table.

Prefer targeted subscriptions and normal queries for static data.

------------------------------------------------------------------------

# 32. Storage

Supabase Storage buckets:

``` text
product-images
organization-assets
receipts
documents
```

Use secure policies.

Product images can be public only if the business explicitly chooses
public assets.

Private documents should use authenticated access/signed URLs.

------------------------------------------------------------------------

# 33. PWA / Offline Strategy

POS can eventually support limited offline operation.

Phase 1:

-   Online-first
-   Detect connection
-   Show offline status

Phase 2:

-   Cache product/catalog data
-   Cache POS shell
-   Local cart

Phase 3:

-   IndexedDB transaction queue
-   Offline sales
-   Sync when online
-   Conflict handling

Do not claim a sale is safely synchronized until the backend confirms
it.

Offline mode is a future feature and should not compromise stock
integrity.

------------------------------------------------------------------------

# 34. Import / Export

Support CSV import for:

-   Products
-   Customers
-   Suppliers
-   Opening stock

Exports:

-   Sales
-   Inventory
-   Customers
-   Purchases
-   Reports

Import flow:

``` text
Upload CSV
 ↓
Map columns
 ↓
Validate
 ↓
Preview errors
 ↓
Confirm
 ↓
Import
```

Never import directly without validation.

------------------------------------------------------------------------

# 35. Demo Data

The demo must feel like a real Mini Mart.

Create realistic sample data:

### Categories

-   Beverages
-   Snacks
-   Grocery
-   Dairy
-   Household
-   Personal Care
-   Frozen Food
-   Bakery

### Products

Examples:

-   Coca-Cola 330ml
-   Pepsi 330ml
-   Myanmar Coffee Mix
-   Instant Noodles
-   Jasmine Rice
-   Cooking Oil
-   Milk
-   Bread
-   Potato Chips
-   Bottled Water

Create:

-   100+ products
-   10+ suppliers
-   100+ customers
-   500+ sales
-   purchases
-   returns
-   expenses
-   stock adjustments
-   loyalty activity

The demo should look populated immediately.

------------------------------------------------------------------------

# 36. Demo Accounts

Create:

``` text
Owner
Manager
Cashier
Inventory Staff
Viewer
```

Provide a demo login screen with role descriptions.

Do not expose real production credentials.

------------------------------------------------------------------------

# 37. UI / UX

## Design direction

Modern business application.

Avoid making every section look like a collection of cards.

Use:

-   Clean tables
-   Compact forms
-   Strong hierarchy
-   Clear typography
-   shadcn/ui components
-   Responsive layouts
-   Keyboard-friendly POS
-   Good empty states
-   Skeleton loading
-   Confirmation dialogs for destructive actions

## POS

Prioritize:

1.  Search
2.  Barcode
3.  Cart
4.  Payment
5.  Receipt

Do not bury the POS under navigation.

------------------------------------------------------------------------

# 38. Responsive Design

Management screens:

-   Desktop
-   Tablet
-   Mobile

POS:

-   Desktop optimized
-   Tablet supported
-   Touch-friendly controls

Mobile should focus on:

-   Dashboard
-   Inventory lookup
-   Customer lookup
-   Reports
-   Notifications

------------------------------------------------------------------------

# 39. Recommended Routes

``` text
/login

/dashboard

/pos
/pos/held

/products
/products/create
/products/:id

/categories
/brands
/units

/inventory
/inventory/movements
/inventory/stocktake
/inventory/adjustments
/inventory/transfers

/purchases
/purchases/create
/purchases/:id

/suppliers
/suppliers/:id

/customers
/customers/:id
/customers/:id/history

/sales
/sales/:id
/returns

/register
/register/history

/expenses

/reports/sales
/reports/inventory
/reports/purchases
/reports/customers
/reports/profit

/staff
/roles
/settings
/audit-logs
```

------------------------------------------------------------------------

# 40. Suggested Folder Structure

``` text
src/
├── app/
│   ├── router/
│   ├── providers/
│   └── config/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── tables/
│   ├── forms/
│   └── charts/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── pos/
│   ├── products/
│   ├── inventory/
│   ├── purchasing/
│   ├── suppliers/
│   ├── customers/
│   ├── loyalty/
│   ├── expenses/
│   ├── reports/
│   ├── staff/
│   └── settings/
│
├── hooks/
├── lib/
│   ├── supabase.ts
│   ├── permissions.ts
│   ├── formatters.ts
│   └── validators.ts
│
├── types/
├── integrations/
└── pages/
```

Keep feature-specific logic inside its feature instead of creating one
huge `utils` folder.

------------------------------------------------------------------------

# 41. TanStack Query

Use TanStack Query for:

-   Products
-   Inventory
-   Customers
-   Suppliers
-   Sales
-   Purchases
-   Reports

Use appropriate:

-   Query keys
-   Cache invalidation
-   Mutations
-   Loading states
-   Error states

Avoid manually duplicating server state across many React contexts.

------------------------------------------------------------------------

# 42. Forms

Use:

``` text
React Hook Form
+
Zod
```

Validate:

-   Product
-   Customer
-   Supplier
-   Purchase
-   Sale
-   Expense
-   User
-   Settings

Show useful field-level errors.

------------------------------------------------------------------------

# 43. Performance

Important indexes:

``` text
products.organization_id
products.sku
products.barcode

stock_balances.branch_id
stock_balances.product_id

stock_movements.product_id
stock_movements.created_at

sales.organization_id
sales.branch_id
sales.sold_at
sales.customer_id

sale_items.sale_id
sale_items.product_id

customers.organization_id
customers.phone
```

Use pagination for large tables.

Do not load thousands of products into the browser unnecessarily.

POS search should use indexed database queries.

------------------------------------------------------------------------

# 44. Phase Roadmap

## Phase 0 --- Project Setup

-   Vite
-   React
-   TypeScript
-   Tailwind
-   shadcn/ui
-   Supabase
-   Vercel
-   GitHub
-   ESLint
-   Prettier
-   environment variables

Acceptance:

-   App runs locally
-   Supabase connected
-   Vercel deployment works
-   Auth works

------------------------------------------------------------------------

## Phase 1 --- MVP

Build:

-   Auth
-   Organization
-   Roles
-   Products
-   Categories
-   Inventory
-   Customers
-   Suppliers
-   POS
-   Sales
-   Payments
-   Basic dashboard

Acceptance:

A user can:

``` text
Login
 ↓
Create product
 ↓
Add stock
 ↓
Open POS
 ↓
Sell product
 ↓
Stock decreases
 ↓
Customer purchase history updates
 ↓
Dashboard updates
```

------------------------------------------------------------------------

## Phase 2 --- Business Ready

Add:

-   Purchases
-   Returns
-   Stocktake
-   Adjustments
-   Register sessions
-   Expenses
-   Discounts
-   Reports
-   Audit logs
-   CSV import/export
-   Better permissions

Acceptance:

A real Mini Mart can run its daily operations using the demo.

------------------------------------------------------------------------

## Phase 3 --- CRM

Add:

-   Customer groups
-   Loyalty
-   Customer analytics
-   Credit/due
-   Purchase frequency
-   Top customers
-   Inactive customers
-   Promotions

Acceptance:

Owner can understand who buys, what they buy, and how valuable they are.

------------------------------------------------------------------------

## Phase 4 --- Multi-Branch

Add:

-   Multiple branches
-   Branch users
-   Branch stock
-   Stock transfers
-   Branch reports
-   Central dashboard

Acceptance:

One organization can operate multiple stores.

------------------------------------------------------------------------

## Phase 5 --- Production-Level

Add:

-   PWA
-   Offline POS
-   Advanced permissions
-   Automated backups/processes
-   Error monitoring
-   Performance monitoring
-   Better audit system
-   Advanced reporting
-   Notification system
-   Receipt printer support
-   Barcode scanner optimization

------------------------------------------------------------------------

# 45. Future Level Features

## Advanced Inventory

-   Batch tracking
-   Expiry tracking
-   Serial numbers
-   Weighted products
-   Multiple warehouses
-   FIFO/weighted-average costing
-   Reorder suggestions
-   Supplier lead time
-   Inventory forecasting

## Advanced CRM

-   Customer segmentation
-   Campaigns
-   Coupons
-   Loyalty tiers
-   Referral system
-   Automated reminders
-   Customer churn prediction

## Advanced POS

-   Layaway
-   Quotations
-   Gift cards
-   Store credit
-   Split bills
-   Suspended transactions
-   Touchscreen mode
-   Customer display
-   Kitchen/order display if needed

## Advanced Business Intelligence

-   Sales forecasting
-   Profit forecasting
-   Best selling time
-   Product affinity
-   Basket analysis
-   Dead stock prediction
-   Reorder recommendations

## AI

Future AI should assist rather than directly control financial
transactions.

Examples:

> "Which products should I reorder this week?"

> "Why did sales drop this month?"

> "Which customers have not purchased recently?"

> "Show me products with declining sales."

> "Create a promotion idea for slow-moving snacks."

------------------------------------------------------------------------

# 46. Future Integrations

Possible integrations:

-   Payment gateways
-   Local mobile wallets
-   Accounting software
-   E-commerce website
-   Delivery systems
-   WhatsApp/SMS/email providers
-   Barcode scanners
-   Receipt printers
-   Cash drawers
-   Customer display
-   BI tools

Use Edge Functions or a secure integration layer for secrets.

------------------------------------------------------------------------

# 47. API / Integration Layer

Although the first version can primarily use Supabase directly, design
business operations so important workflows can later be exposed through
secure functions/API.

Future API examples:

``` text
POST /sales
POST /sales/:id/refund

POST /purchases
POST /inventory/adjustments

GET /products
GET /inventory
GET /customers
GET /reports/sales
```

Never expose unrestricted database operations as a substitute for an
API.

------------------------------------------------------------------------

# 48. Commercial Customization Strategy

This system should become a reusable foundation for client projects.

When a client asks for a custom Mini Mart system:

``` text
Core Platform
     +
Client Branding
     +
Client Workflow
     +
Client Reports
     +
Client Integrations
     =
Custom Business System
```

Possible customization:

-   Logo
-   Colors/theme
-   Receipt format
-   Invoice format
-   Tax rules
-   Payment methods
-   Product fields
-   Customer fields
-   Reports
-   Permissions
-   Branch structure
-   Local payment integration

------------------------------------------------------------------------

# 49. Demo Sales Strategy

The demo should be more than a technical showcase.

On the company website:

``` text
Business Solutions

Retail POS
Manage sales, inventory, customers and suppliers.

[View Live Demo]

Pharmacy Management
Manage medicines, inventory and expiry.

[View Live Demo]

Electronics Management
Manage products, IMEI, warranty and repairs.

[View Live Demo]
```

For the Mini Mart demo, provide:

``` text
Live Demo
Demo Login
Feature Tour
Screenshots
Business Benefits
Request Customization
```

Primary CTA:

> **Request a Custom System**

------------------------------------------------------------------------

# 50. Acceptance Criteria

The project is considered MVP-complete when:

-   Authentication works.
-   RLS prevents cross-organization data access.
-   Owner can create products.
-   Owner can add opening stock.
-   Cashier can open a register.
-   Cashier can search/scan products.
-   Cashier can complete a sale.
-   Stock decreases after sale.
-   Customer purchase history is recorded.
-   Cash payment is recorded.
-   Receipt can be displayed/printed.
-   Product returns work.
-   Purchases increase stock.
-   Stock adjustments are recorded.
-   Low-stock products are visible.
-   Dashboard shows sales.
-   Basic reports work.
-   Audit logs exist for important actions.
-   Demo data makes the system look realistic.
-   Vercel deployment works.
-   No secret service-role credentials are exposed to the browser.

------------------------------------------------------------------------

# 51. Development Principles

1.  Build the smallest complete workflow first.
2.  Do not build every future feature before validating the core.
3.  Protect financial and stock operations with database-level
    integrity.
4.  Never silently change stock.
5.  Every stock change must have a movement record.
6.  Every sale must preserve historical selling and cost prices.
7.  Use RLS everywhere it is required.
8.  Keep the UI fast for cashiers.
9.  Design reusable modules.
10. Avoid unnecessary complexity.
11. Build realistic demo data.
12. Make customization easy.
13. Keep production deployment separate from demo infrastructure.
14. Never put secrets in Vite client environment variables.
15. Prefer auditable operations over hidden automation.

------------------------------------------------------------------------

# 52. Final Product Vision

The long-term goal is not just:

> "Mini Mart POS."

It is:

> **A reusable business software platform that can be customized for
> different businesses.**

Start:

``` text
Mini Mart
POS + Inventory + CRM
```

Then evolve:

``` text
Retail
Pharmacy
Beauty
Electronics
Fashion
Restaurant
Service Business
```

All using the same core concepts:

``` text
Users
Organizations
Branches
Products
Inventory
Sales
Purchases
Customers
Payments
Reports
Permissions
Audit
```

The Mini Mart product should therefore be developed as the **first
commercial demo/vertical**, not as a throwaway project.
