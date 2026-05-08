import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        blue: 'border-transparent bg-blue-100 text-blue-700',
        green: 'border-transparent bg-emerald-100 text-emerald-700',
        amber: 'border-transparent bg-amber-100 text-amber-800',
        red: 'border-transparent bg-red-100 text-red-700',
        gray: 'border-transparent bg-slate-100 text-slate-700',
        orange: 'border-transparent bg-orange-100 text-orange-700',
        purple: 'border-transparent bg-purple-100 text-purple-700',
        pink: 'border-transparent bg-pink-100 text-pink-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
