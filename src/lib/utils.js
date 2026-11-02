import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merge Tailwind class lists, letting later props override earlier ones.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
