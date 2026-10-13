import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout, Protected } from '../components/layout';
import { POSLayout } from '../components/pos-layout';
import { DisplayPage } from '../features/pos/DisplayPage';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { POSPage } from '../features/pos/POSPage';
import { ProductsPage } from '../features/catalog/ProductsPage';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { PurchasesPage, SuppliersPage } from '../features/purchasing/PurchasingPages';
import { CustomersPage } from '../features/customers/CustomersPage';
import { SalesPage } from '../features/sales/SalesPage';
import { RegisterPage } from '../features/register/RegisterPage';
import { ExpensesPage, StaffPage, RolesPage, SettingsPage, AuditPage } from '../features/ops/OpsPages';
import { ReportsPage } from '../features/reports/ReportsPage';

function Guard({ children }: { children: React.ReactNode }) {
  return <Protected>{children}</Protected>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Guard><DashboardPage /></Guard> },
      { path: 'products', element: <Guard><ProductsPage /></Guard> },
      { path: 'products/create', element: <Guard><ProductsPage /></Guard> },
      { path: 'categories', element: <Guard><ProductsPage /></Guard> },
      { path: 'brands', element: <Guard><ProductsPage /></Guard> },
      { path: 'units', element: <Guard><ProductsPage /></Guard> },
      { path: 'inventory', element: <Guard><InventoryPage /></Guard> },
      { path: 'inventory/movements', element: <Guard><InventoryPage /></Guard> },
      { path: 'inventory/stocktake', element: <Guard><InventoryPage /></Guard> },
      { path: 'inventory/adjustments', element: <Guard><InventoryPage /></Guard> },
      { path: 'purchases', element: <Guard><PurchasesPage /></Guard> },
      { path: 'purchases/create', element: <Guard><PurchasesPage /></Guard> },
      { path: 'suppliers', element: <Guard><SuppliersPage /></Guard> },
      { path: 'customers', element: <Guard><CustomersPage /></Guard> },
      { path: 'sales', element: <Guard><SalesPage /></Guard> },
      { path: 'returns', element: <Guard><SalesPage /></Guard> },
      { path: 'register', element: <Guard><RegisterPage /></Guard> },
      { path: 'register/history', element: <Guard><RegisterPage /></Guard> },
      { path: 'expenses', element: <Guard><ExpensesPage /></Guard> },
      { path: 'reports', element: <Guard><ReportsPage /></Guard> },
      { path: 'reports/sales', element: <Guard><ReportsPage /></Guard> },
      { path: 'reports/inventory', element: <Guard><ReportsPage /></Guard> },
      { path: 'reports/purchases', element: <Guard><ReportsPage /></Guard> },
      { path: 'reports/customers', element: <Guard><ReportsPage /></Guard> },
      { path: 'reports/profit', element: <Guard><ReportsPage /></Guard> },
      { path: 'staff', element: <Guard><StaffPage /></Guard> },
      { path: 'roles', element: <Guard><RolesPage /></Guard> },
      { path: 'settings', element: <Guard><SettingsPage /></Guard> },
      { path: 'audit-logs', element: <Guard><AuditPage /></Guard> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
  {
    // POS runs full-screen (no management sidebar) — see POSLayout
    path: '/pos',
    element: <POSLayout />,
    children: [
      { index: true, element: <Guard><POSPage /></Guard> },
      { path: 'held', element: <Guard><POSPage /></Guard> },
    ],
  },
  {
    // Customer-facing display — chromeless, synced live from POS
    path: '/display',
    element: <Guard><DisplayPage /></Guard>,
  },
]);
