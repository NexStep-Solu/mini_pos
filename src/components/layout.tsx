import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, Truck, Users,
  Receipt, Wallet, BarChart3, Settings, LogOut, Store, ClipboardList, UserCog, BookOpen,
  Moon, Sun, AlertTriangle,
} from 'lucide-react';
import { useStore } from '../store/AppStore';
import { ROLE_LABEL } from '../lib/permissions';
import { cn } from '../lib/utils';
import { Toaster } from 'sonner';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger,
} from './ui/sidebar';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'manager', 'viewer'], group: 'Manage' },
  { to: '/pos', label: 'POS', icon: ShoppingCart, roles: ['owner', 'manager', 'cashier'], group: 'Sell' },
  { to: '/products', label: 'Products', icon: Package, roles: ['owner', 'manager', 'inventory', 'viewer'], group: 'Manage' },
  { to: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['owner', 'manager', 'inventory', 'viewer'], group: 'Manage' },
  { to: '/purchases', label: 'Purchases', icon: Truck, roles: ['owner', 'manager', 'inventory'], group: 'Manage' },
  { to: '/suppliers', label: 'Suppliers', icon: Store, roles: ['owner', 'manager', 'inventory'], group: 'Manage' },
  { to: '/customers', label: 'Customers', icon: Users, roles: ['owner', 'manager', 'cashier'], group: 'Manage' },
  { to: '/sales', label: 'Sales', icon: Receipt, roles: ['owner', 'manager', 'cashier', 'viewer'], group: 'Money' },
  { to: '/register', label: 'Register', icon: Wallet, roles: ['owner', 'manager', 'cashier'], group: 'Money' },
  { to: '/expenses', label: 'Expenses', icon: ClipboardList, roles: ['owner', 'manager', 'viewer'], group: 'Money' },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['owner', 'manager', 'viewer'], group: 'Money' },
  { to: '/staff', label: 'Staff', icon: UserCog, roles: ['owner', 'manager'], group: 'System' },
  { to: '/audit-logs', label: 'Audit Logs', icon: BookOpen, roles: ['owner', 'manager'], group: 'System' },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'manager'], group: 'System' },
];

const GROUPS = ['Sell', 'Manage', 'Money', 'System'];

export function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('mm-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('mm-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

function AppSidebar() {
  const { user, logout, supaLogout, mode } = useStore();
  const nav = useNavigate();
  const { pathname } = useLocation();
  if (!user) return null;
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Shwe Mini Mart">
              <Link to="/dashboard">
                <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary font-bold text-sidebar-primary-foreground">S</span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-bold tracking-tight">Shwe Mini Mart</span>
                  <span className="truncate text-[11px] tracking-wider uppercase opacity-60">POS · Inventory · CRM</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {GROUPS.map((g) => {
          const groupItems = items.filter((n) => n.group === g);
          if (!groupItems.length) return null;
          return (
            <SidebarGroup key={g}>
              <SidebarGroupLabel>{g}</SidebarGroupLabel>
              <SidebarMenu>
                {groupItems.map((n) => {
                  const active = pathname === n.to || (n.to !== '/dashboard' && pathname.startsWith(n.to + '/'));
                  return (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={n.label}>
                        <Link to={n.to}>
                          <n.icon aria-hidden />
                          <span>{n.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-bold text-sidebar-accent-foreground">
                {user.name.charAt(0)}
              </span>
              <span className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="truncate text-xs opacity-60">{ROLE_LABEL[user.role]}</span>
              </span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" onClick={() => { if (mode === 'remote') void supaLogout(); else logout(); nav('/login'); }}>
              <LogOut aria-hidden />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function FloatingShell({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <SidebarInset className="bg-transparent">
      <div className="flex min-h-svh flex-col p-2 sm:p-3 md:pl-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.9)]">
          {header}
          <div className="min-w-0 flex-1 overflow-auto bg-zinc-50/60 p-3 sm:p-4 dark:bg-zinc-950">
            {children}
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

export function AppLayout() {
  const { user, lowStock } = useStore();
  const { dark, toggle } = useTheme();
  if (!user) return <Outlet />;
  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full bg-zinc-200/60 text-zinc-950 dark:bg-black dark:text-zinc-50">
        <AppSidebar />
        <FloatingShell
          header={(
            <header className="no-print sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-200/90 bg-white/85 px-3 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
            <SidebarTrigger aria-label="Toggle navigation sidebar" />
            <p className="ml-1 text-sm text-zinc-500">
              Kamayut Main Branch · <span className="font-semibold text-zinc-900 dark:text-zinc-100">MMK (Ks)</span>
            </p>
            <div className="ml-auto flex items-center gap-2">
              {lowStock.length > 0 && (
                <span className="flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  <AlertTriangle size={13} aria-hidden /> {lowStock.length} low-stock
                </span>
              )}
              <span className="hidden rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 sm:inline dark:bg-zinc-800 dark:text-zinc-300">
                {ROLE_LABEL[user.role]}
              </span>
              <button
                onClick={toggle}
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="cursor-pointer rounded-lg border border-zinc-200 p-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                {dark ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
              </button>
            </div>
          </header>
          )}
        >
          <Outlet />
        </FloatingShell>
      </div>
      <Toaster position="top-right" toastOptions={{ className: cn('!bg-zinc-950 !text-zinc-50 dark:!bg-zinc-50 dark:!text-zinc-950') }} />
    </SidebarProvider>
  );
}

export function AuthSplash() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-zinc-100 dark:bg-black">
      <span className="flex size-11 items-center justify-center rounded-xl bg-zinc-950 text-xl font-bold text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950">S</span>
      <p className="text-[13px] font-medium text-zinc-500">Restoring session…</p>
    </div>
  );
}

export function Protected({ children }: { children: React.ReactNode }) {
  const { user, authReady, authPending, mode } = useStore();
  const nav = useNavigate();
  const waiting = mode === 'remote' && (!authReady || authPending);
  useEffect(() => {
    if (waiting) return; // session/membership still resolving — don't bounce yet
    if (!user) nav('/login');
  }, [user, waiting, nav]);
  if (waiting) return <AuthSplash />;
  if (!user) return null;
  return <>{children}</>;
}
