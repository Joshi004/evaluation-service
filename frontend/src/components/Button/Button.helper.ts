import { cn } from '../../utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-muted text-foreground border border-border hover:border-border-strong',
  ghost: 'text-foreground hover:bg-muted',
  // Outlined rather than a solid fill: `danger` is tuned to work as
  // text/border colour (see the contrast notes in index.css), not as a
  // background with light text on top.
  danger: 'border border-danger text-danger hover:bg-danger-soft',
}

// Labelled (Button) and icon-only (IconButton) sizing are kept as two
// separate maps rather than one shared size class: `px-4` (label
// padding) and `w-9` (icon square) both touch horizontal sizing, and
// with no tailwind-merge in this project, two conflicting utilities in
// one class string have no reliable way to resolve which one wins.
export const BUTTON_LABEL_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
}

export const BUTTON_ICON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
}

// Shared by Button and IconButton so both render with one visual
// language instead of two hand-tuned copies.
export function buttonClassName(
  variant: ButtonVariant,
  sizeClassName: string,
  className?: string,
): string {
  return cn(
    'relative inline-flex items-center justify-center rounded-md font-medium',
    'transition-colors disabled:pointer-events-none disabled:opacity-50',
    VARIANT_CLASSES[variant],
    sizeClassName,
    className,
  )
}
