import clsx, { type ClassValue } from 'clsx'

// Every primitive composes conditional class names through this one
// function so they all import a single name instead of each reaching
// for clsx directly.
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
