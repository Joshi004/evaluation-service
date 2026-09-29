// Non-DOM logic for Dialog.tsx: one complete width class per size --
// there is no tailwind-merge in this project (D2), so a caller can
// never layer a second width utility on top of this component's own
// without one silently losing to the other.
import { cn } from '../../utils/cn'

export type DialogSize = 'md' | 'lg' | 'xl'

// 'md' matches the width every dialog used before `size` existed
// (ConfirmDialog and every plain form dialog keep this default).
// 'lg' is Compare's own Add run picker; 'xl' is its side-by-side
// sample view, wide enough for 2-4 answer columns side by side
// (docs/UI_REDESIGN_PLAN.md §8.8).
const SIZE_MAX_WIDTH_CLASSES: Record<DialogSize, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function dialogContentClassName(size: DialogSize, className?: string): string {
  return cn(
    'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
    'max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-md',
    SIZE_MAX_WIDTH_CLASSES[size],
    className,
  )
}
