// Non-DOM logic for SidePanel.tsx: one complete width/position class
// string. Mirrors Dialog.helper.ts's own reasoning (no tailwind-merge
// in this project -- see D2) -- a caller can never layer a second
// width or position utility on top of this component's own without
// one silently losing to the other.
import { cn } from '../../utils/cn'

export function sidePanelContentClassName(className?: string): string {
  return cn(
    'fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col',
    'border-l border-border bg-card shadow-md',
    className,
  )
}
