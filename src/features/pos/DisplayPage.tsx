import { useEffect, useState } from 'react';
import { Check, Loader2, ShoppingBag, Store } from 'lucide-react';
import { fmtMoney } from '../../lib/formatters';
import { cn } from '../../lib/utils';
import { subscribeDisplay, type DisplayState } from '../../lib/display-sync';

const COMPLETE_HOLD_MS = 15_000;

function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

function YangonTime({ now }: { now: Date }) {
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon',
  }).format(now);
  const date = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Yangon',
  }).format(now);
  return (
    <p className="text-zinc-500 tabular-nums dark:text-zinc-400">
      {date} · {time}
    </p>
  );
}

export function DisplayPage() {
  const [msg, setMsg] = useState<DisplayState | null>(null);
  const now = useNow();

  useEffect(() => subscribeDisplay(setMsg), []);

  // a completed sale holds the thank-you screen, then falls back to idle
  const completeFresh =
    msg?.status === 'complete' && Date.now() - msg.sentAt < COMPLETE_HOLD_MS;
  const status = completeFresh ? 'complete' : (msg?.status === 'complete' ? 'idle' : (msg?.status ?? 'idle'));

  return (
    <div className="flex h-svh flex-col bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      {/* brand strip */}
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-950 text-lg font-bold text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950">S</span>
        <div>
          <p className="text-lg leading-tight font-bold tracking-tight">Shwe Mini Mart</p>
          <p className="text-xs tracking-wider text-zinc-500 uppercase">Pyay Road, Kamayut · Yangon</p>
        </div>
        <div className="ml-auto text-right text-sm">
          <YangonTime now={now} />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {status === 'idle' && (
          <div key="idle" className="animate-in fade-in flex flex-1 flex-col items-center justify-center gap-4 p-8 duration-500">
            <span className="flex size-20 animate-pulse items-center justify-center rounded-3xl bg-zinc-100 dark:bg-zinc-900">
              <Store size={36} aria-hidden className="text-zinc-700 dark:text-zinc-300" />
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Welcome!</h1>
            <p className="max-w-md text-center text-lg text-zinc-500">
              Your items will appear here as the cashier scans them.
            </p>
          </div>
        )}

        {(status === 'cart' || status === 'paying') && msg && (
          <div key={`sale-${msg.seq}`} className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* items */}
            <div className="min-h-0 overflow-auto p-4 sm:p-6">
              {msg.customerName && (
                <p className="mb-3 text-sm font-medium text-zinc-500">
                  Serving · <span className="font-bold text-zinc-900 dark:text-zinc-100">{msg.customerName}</span>
                </p>
              )}
              <ul className="space-y-2">
                {msg.lines.map((l, i) => (
                  <li
                    key={`${l.name}-${i}`}
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                    className="animate-in slide-in-from-left-3 fade-in flex items-baseline gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 duration-300 fill-mode-both dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-sm font-bold text-zinc-50 tabular-nums dark:bg-zinc-50 dark:text-zinc-950">
                      {l.qty}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-lg font-semibold">{l.name}</span>
                    <span className="shrink-0 text-lg font-bold tabular-nums">{fmtMoney(l.total)}</span>
                  </li>
                ))}
              </ul>
              {msg.discount > 0 && (
                <p className="mt-3 text-right text-sm text-zinc-500">
                  Discount −{fmtMoney(msg.discount)}
                </p>
              )}
            </div>
            {/* total panel */}
            <div className="flex shrink-0 flex-col justify-center gap-2 border-t border-zinc-200 bg-zinc-950 p-6 text-white sm:p-8 lg:border-t-0 lg:border-l dark:border-zinc-800 dark:bg-black dark:text-zinc-50">
              <p className="text-sm tracking-widest text-zinc-400 uppercase">
                {msg.itemCount} item{msg.itemCount === 1 ? '' : 's'}
              </p>
              <p className="text-sm tracking-widest text-zinc-400 uppercase">Total due</p>
              <p key={msg.total} className="animate-in fade-in text-6xl font-extrabold tracking-tight tabular-nums duration-300 sm:text-7xl">
                {fmtMoney(msg.total)}
              </p>
              {status === 'paying' ? (
                <p className="mt-2 flex items-center gap-2 text-lg text-zinc-300">
                  <Loader2 size={20} aria-hidden className="animate-spin" />
                  Processing payment…
                </p>
              ) : (
                <p className="mt-2 flex items-center gap-2 text-lg text-zinc-300">
                  <ShoppingBag size={20} aria-hidden />
                  Please confirm your items
                </p>
              )}
            </div>
          </div>
        )}

        {status === 'complete' && msg && (
          <div key={`done-${msg.seq}`} className="animate-in fade-in zoom-in-95 flex flex-1 flex-col items-center justify-center gap-3 p-8 duration-500">
            <span className="flex size-20 items-center justify-center rounded-full bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950">
              <Check size={40} aria-hidden strokeWidth={3} />
            </span>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">Thank you!</h1>
            {msg.invoice && <p className="font-mono text-sm text-zinc-500">{msg.invoice}</p>}
            <div className="mt-2 flex items-center gap-8 text-center">
              <div>
                <p className="text-xs tracking-widest text-zinc-500 uppercase">Paid</p>
                <p className="text-3xl font-extrabold tabular-nums">{fmtMoney(msg.total)}</p>
              </div>
              {(msg.change ?? 0) > 0 && (
                <div className={cn('rounded-2xl bg-zinc-950 px-6 py-3 text-white dark:bg-zinc-50 dark:text-zinc-950')}>
                  <p className="text-xs tracking-widest uppercase opacity-70">Change</p>
                  <p className="text-3xl font-extrabold tabular-nums">{fmtMoney(msg.change ?? 0)}</p>
                </div>
              )}
            </div>
            {msg.methods && msg.methods.length > 0 && (
              <p className="text-sm text-zinc-500">via {msg.methods.join(' + ')}</p>
            )}
          </div>
        )}
      </main>

      <footer className="flex shrink-0 items-center justify-between border-t border-zinc-200 px-6 py-3 text-xs text-zinc-400 dark:border-zinc-800">
        <span>Thank you for shopping with us</span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-zinc-400" aria-hidden />
          Live
        </span>
      </footer>
    </div>
  );
}
