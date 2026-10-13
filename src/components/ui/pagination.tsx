import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './select';

// ─── page window: 1 … c-1 c c+1 … N ─────────────────────────────────────────
function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, page - 1, page, page + 1, pages - 1, pages]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

export function usePagination(total: number, initialSize = 20) {
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(initialSize);
  const pages = Math.max(1, Math.ceil(total / size));
  const safe = Math.min(Math.max(1, page), pages);
  React.useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  return {
    page: safe,
    setPage,
    reset: React.useCallback(() => setPage(1), []),
    size,
    setSize: (s: number) => { setSize(s); setPage(1); },
    pages,
    start: (safe - 1) * size,
  };
}

export function Pager({
  page, pages, total, size, onPage, onSize, sizes = [10, 20, 50],
}: {
  page: number; pages: number; total: number; size: number;
  onPage: (p: number) => void; onSize: (s: number) => void; sizes?: number[];
}) {
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <p className="text-xs text-zinc-500 tabular-nums">
        Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{from}–{to}</span> of{' '}
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{total}</span>
      </p>
      <span className="ml-auto flex items-center gap-1.5">
        <Select value={String(size)} onValueChange={(v) => onSize(Number(v))}>
          <SelectTrigger className="h-7 w-auto gap-1 text-xs" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((s) => <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page" className="h-7 w-7 !px-0">
          <ChevronLeft size={14} />
        </Button>
        <span className="hidden items-center gap-0.5 sm:flex">
          {pageWindow(page, pages).map((n, i) =>
            n === '…' ? (
              <span key={`e${i}`} className="px-1 text-zinc-400"><MoreHorizontal size={13} /></span>
            ) : (
              <button
                key={n}
                onClick={() => onPage(n)}
                aria-label={`Page ${n}`}
                aria-current={n === page ? 'page' : undefined}
                className={cn(
                  'h-7 min-w-7 cursor-pointer rounded-md px-1.5 text-xs font-medium tabular-nums transition-colors',
                  n === page
                    ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
                )}
              >
                {n}
              </button>
            ),
          )}
        </span>
        <Button variant="outline" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page" className="h-7 w-7 !px-0">
          <ChevronRight size={14} />
        </Button>
      </span>
    </div>
  );
}
