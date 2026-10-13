import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Monochrome status system — state is carried by fill + border weight,
// never by hue (a11y: color is never the only indicator).
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-3',
  {
    variants: {
      variant: {
        // affirmative / success — solid black
        default: 'border-transparent bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950',
        // informational — soft gray fill
        secondary: 'border-transparent bg-zinc-200/70 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
        // attention / warning — bordered, medium fill
        warning: 'border-zinc-400 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100',
        // critical — heavy double-weight border, bold
        critical: 'border-2 border-zinc-950 bg-white font-bold text-zinc-950 dark:border-zinc-50 dark:bg-zinc-950 dark:text-zinc-50',
        // neutral / muted
        outline: 'border-zinc-300 bg-transparent text-zinc-500 dark:border-zinc-700 dark:text-zinc-400',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
