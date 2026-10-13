import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-auto">
      <table ref={ref} className={cn('w-full text-sm', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />,
);
TableHeader.displayName = 'TableHeader';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'sticky top-0 z-10 h-9 bg-zinc-50 px-3 py-1.5 text-left align-middle text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:bg-zinc-900 dark:text-zinc-400',
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = 'TableHead';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />,
);
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-zinc-100 transition-colors hover:bg-zinc-50 data-[state=selected]:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900',
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn('px-3 py-1.5 align-middle', className)} {...props} />,
);
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableHead, TableBody, TableRow, TableCell };

// Sortable column trigger — dir: 0 = unsorted, 1 = asc, -1 = desc.
export function SortHead({ label, dir, onClick }: { label: string; dir: 0 | 1 | -1; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Sort by ${label}`}
      className="inline-flex cursor-pointer items-center gap-1 uppercase transition-colors hover:text-zinc-950 dark:hover:text-zinc-50"
    >
      {label}
      {dir === 0 && <ArrowUpDown size={11} aria-hidden className="opacity-50" />}
      {dir === 1 && <ArrowUp size={11} aria-hidden />}
      {dir === -1 && <ArrowDown size={11} aria-hidden />}
    </button>
  );
}
