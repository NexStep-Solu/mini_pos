import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ChevronLeft, Monitor, Moon, Pause, Sun, Wallet } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { ROLE_LABEL } from '../lib/permissions';
import { cn } from '../lib/utils';
import { Toaster } from 'sonner';
import { Button, Input } from './ui';
import { openDisplayWindow } from '../lib/display-sync';
import { useTheme } from './layout';

// Full-screen POS shell — deliberately NO sidebar.
// Cashier flow is linear (scan → cart → pay); nav chrome only steals
// grid space and attention. Exit, register, held sales and theme live here.
export function POSLayout() {
  const { db, user, openRegister } = useStore();
  const { dark, toggle } = useTheme();
  const [openCash, setOpenCash] = useState('');
  const openSession = db.sessions.find((s) => s.status === 'open');
  if (!user) return <Outlet />;

  return (
    <div className="flex h-svh flex-col bg-zinc-100 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <header className="no-print flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          to="/dashboard"
          className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          <ChevronLeft size={16} aria-hidden /> Dashboard
        </Link>
        <span className="hidden h-5 w-px bg-zinc-200 sm:block dark:bg-zinc-800" aria-hidden />
        <span className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-950 text-sm font-bold text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950">S</span>
          <span className="hidden text-[13px] font-bold tracking-tight sm:block">Point of Sale</span>
        </span>
        <span className={cn(
          'ml-1 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium md:flex',
          openSession
            ? 'border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'
            : 'border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700',
        )}>
          <span className={cn('size-1.5 rounded-full', openSession ? 'bg-zinc-950 dark:bg-zinc-50' : 'bg-zinc-300 dark:bg-zinc-600')} aria-hidden />
          {openSession ? <>Register · <span className="font-mono">{openSession.id.slice(-6)}</span></> : 'Register closed'}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {!openSession && (
            <span className="flex items-center gap-1.5">
              <Input
                value={openCash}
                onChange={(e) => setOpenCash(e.target.value)}
                placeholder="Opening cash"
                inputMode="numeric"
                className="h-8 w-28"
                aria-label="Opening cash"
              />
              <Button
                onClick={() => {
                  openRegister(Number(openCash) || 0);
                  setOpenCash('');
                }}
              >
                <Wallet size={15} /> Open register
              </Button>
            </span>
          )}
          <button
            onClick={openDisplayWindow}
            title="Open customer display (second screen)"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium transition-colors hover:border-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:border-zinc-300 dark:hover:bg-zinc-800"
          >
            <Monitor size={15} aria-hidden />
            <span className="hidden lg:inline">Display</span>
          </button>
          <Link
            to="/pos/held"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium transition-colors hover:border-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:border-zinc-300 dark:hover:bg-zinc-800"
          >
            <Pause size={15} aria-hidden /> Held
            {db.held.length > 0 && (
              <span className="rounded-full bg-zinc-950 px-1.5 text-[11px] font-bold text-white dark:bg-zinc-50 dark:text-zinc-950">
                {db.held.length}
              </span>
            )}
          </Link>
          <button
            onClick={toggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="cursor-pointer rounded-lg border border-zinc-200 p-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            {dark ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
          </button>
          <span
            title={`${user.name} · ${ROLE_LABEL[user.role]}`}
            className="flex size-8 cursor-default items-center justify-center rounded-full bg-zinc-950 text-[13px] font-bold text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {user.name.charAt(0)}
          </span>
        </div>
      </header>
      <div className="min-w-0 flex-1 overflow-hidden p-2.5 sm:p-3">
        <Outlet />
      </div>
      <Toaster position="top-right" toastOptions={{ className: cn('!bg-zinc-950 !text-zinc-50 dark:!bg-zinc-50 dark:!text-zinc-950') }} />
    </div>
  );
}
