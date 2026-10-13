// Compat layer — stable API used by all feature pages,
// now powered by genuine shadcn/ui primitives (cva + Radix).
// Strict monochrome: zinc scale only, light + dark.
import React from 'react';
import { Button as ShadButton } from './ui/button';
import { Card as ShadCard } from './ui/card';
import { Input as ShadInput, Textarea as ShadTextarea } from './ui/input';
import {
  Select as ShadSelect, SelectTrigger as ShadSelectTrigger, SelectValue as ShadSelectValue,
  SelectContent as ShadSelectContent, SelectItem as ShadSelectItem,
} from './ui/select';
import { Tabs as ShadTabs, TabsList as ShadTabsList, TabsTrigger as ShadTabsTrigger } from './ui/tabs';
import { Badge as ShadBadge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from './ui/dialog';
import { Table as ShadTable, TableHeader as ShadTableHeader, TableHead as ShadTableHead, TableBody as ShadTableBody, TableRow as ShadTableRow, TableCell as ShadTableCell, SortHead as ShadSortHead } from './ui/table';
import { Pager as ShadPager, usePagination as useShadPagination } from './ui/pagination';
import { cn } from '../lib/utils';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
const btnMap: Record<BtnVariant, 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline'> = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'destructive',
  outline: 'outline',
};

export function Button({
  className, variant = 'primary', type, onClick, disabled, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return <ShadButton variant={btnMap[variant]} className={className} type={type} onClick={onClick} disabled={disabled} {...rest}>{children}</ShadButton>;
}

export const Input = ShadInput;
export const Textarea = ShadTextarea;
export const Select = ShadSelect;
export const SelectTrigger = ShadSelectTrigger;
export const SelectValue = ShadSelectValue;
export const SelectContent = ShadSelectContent;
export const SelectItem = ShadSelectItem;
export const Tabs = ShadTabs;
export const TabsList = ShadTabsList;
export const TabsTrigger = ShadTabsTrigger;

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <ShadCard className={className}>{children}</ShadCard>;
}

export function Stat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <ShadCard className="min-w-0 overflow-hidden p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{label}</p>
        <span className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 p-1 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 [&_svg]:size-3.5">{icon}</span>
      </div>
      <p className="mt-1 truncate text-xl font-bold tracking-tight text-zinc-950 tabular-nums dark:text-zinc-50">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </ShadCard>
  );
}

type Tone = 'slate' | 'green' | 'red' | 'amber' | 'blue';
const toneMap: Record<Tone, 'secondary' | 'default' | 'critical' | 'warning'> = {
  slate: 'secondary',
  green: 'default',
  red: 'critical',
  amber: 'warning',
  blue: 'secondary',
};

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return <ShadBadge variant={toneMap[tone]}>{children}</ShadBadge>;
}

export function PageHeader({ title, sub, actions, icon }: { title: string; sub?: string; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
      {icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 [&_svg]:size-[18px]">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h1>
        {sub && <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{sub}</p>}
      </div>
      <div className="ml-auto flex items-center gap-1.5">{actions}</div>
    </div>
  );
}

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
      <p className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200">{title}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent wide={wide} className={cn(!open && 'hidden')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export const Pager = ShadPager;
export const usePagination = useShadPagination;
export const Table = ShadTable;
export const TableHeader = ShadTableHeader;
export const TableHead = ShadTableHead;
export const TableBody = ShadTableBody;
export const TableRow = ShadTableRow;
export const TableCell = ShadTableCell;
export const SortHead = ShadSortHead;
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

// Initials avatar — monochrome identity chip for people/places.
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-xs font-bold text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950',
        className,
      )}
    >
      {initials || '?'}
    </span>
  );
}

// Micro meter — tiny labeled bar for stock levels, usage, progress.
export function Meter({ value, max, tone }: { value: number; max: number; tone?: 'solid' | 'faint' }) {
  const pct = Math.max(4, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
      <span
        className={cn('block h-full rounded-full', tone === 'solid' ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-600')}
        style={{ width: pct + '%' }}
      />
    </span>
  );
}
