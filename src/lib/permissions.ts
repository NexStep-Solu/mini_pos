import type { Role } from '../types';

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  inventory: 'Inventory Staff',
  viewer: 'Accountant / Viewer',
};

export const GRANTS: Record<Role, string[]> = {
  owner: ['*'],
  manager: [
    'products.view', 'products.create', 'products.update',
    'inventory.view', 'inventory.adjust', 'inventory.stocktake',
    'sales.create', 'sales.refund', 'sales.discount', 'sales.price_override',
    'customers.view', 'customers.create', 'customers.update',
    'reports.view', 'reports.export',
    'purchases.view', 'purchases.create',
  ],
  cashier: [
    'products.view', 'sales.create', 'customers.view', 'customers.create',
    'reports.view',
  ],
  inventory: [
    'products.view', 'products.create', 'products.update',
    'inventory.view', 'inventory.adjust', 'inventory.stocktake',
    'purchases.view', 'purchases.create',
  ],
  viewer: ['products.view', 'inventory.view', 'reports.view', 'reports.export'],
};

export function can(role: Role, perm: string): boolean {
  const g = GRANTS[role];
  if (g.includes('*')) return true;
  return g.includes(perm);
}

export function canDiscount(role: Role): boolean {
  return can(role, 'sales.discount');
}
export function canPriceOverride(role: Role): boolean {
  return can(role, 'sales.price_override');
}
export function canRefund(role: Role): boolean {
  return can(role, 'sales.refund');
}

// Canonical permission catalog (drives the Roles matrix UI + seed).
// Grouped by area; keep in sync with supabase roles.permissions.
export const PERMISSION_GROUPS: { area: string; perms: string[] }[] = [
  { area: 'Products', perms: ['products.view', 'products.create', 'products.update', 'products.delete'] },
  { area: 'Inventory', perms: ['inventory.view', 'inventory.adjust', 'inventory.stocktake'] },
  { area: 'Sales', perms: ['sales.create', 'sales.refund', 'sales.discount', 'sales.price_override'] },
  { area: 'Customers', perms: ['customers.view', 'customers.create', 'customers.update'] },
  { area: 'Purchasing', perms: ['purchases.view', 'purchases.create'] },
  { area: 'Reports', perms: ['reports.view', 'reports.export'] },
  { area: 'System', perms: ['settings.manage', 'users.manage'] },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) => g.perms);
