import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Helper canonical pour Tailwind + clsx (utilisé partout)
 *
 * Usage : <div className={cn('p-4', isActive && 'bg-blue-500')} />
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
