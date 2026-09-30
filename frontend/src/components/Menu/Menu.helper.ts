import { cn } from '../../utils/cn'

// Shared by every Radix dropdown-menu-backed popover (Menu,
// MultiSelectMenu, ThemeMenu, and SelectField's own listbox) so they
// all read as one popover style. Size (min-width, max-height) stays
// out of this base string and lives at each call site instead --
// it's the one thing that genuinely varies between them, and with no
// tailwind-merge in this project, two conflicting sizing utilities in
// one class string would have no reliable way to resolve which one
// wins.
export const MENU_CONTENT_CLASS_NAME = 'z-50 rounded-lg border border-border bg-popover p-1 shadow-md'

// No plain `outline-none` here on purpose -- Tailwind's
// outline-width/-color utilities read a shared --tw-outline-style
// custom property rather than forcing one of their own, so an
// unconditional outline-none would pin that property to "none" and
// the focus-visible utilities below would have nothing to override.
// Leaving outline-style unset instead means it is only ever set (to
// "solid") inside the focus-visible variant itself, and inset so it
// never clips against the popover's own small padding, for the
// keyboard-arrow navigation Radix drives with real DOM focus on each
// item in turn. Text colour is left out too -- Menu's own destructive
// items need `text-danger` instead of the `text-foreground` every
// other item uses, and baking one colour in here would conflict with
// that override the same way a baked-in size would.
export const MENU_ITEM_CLASS_NAME = cn(
  'cursor-pointer rounded-md px-2.5 py-1.5 text-sm',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
  'data-[highlighted]:bg-muted',
)

export const MENU_GROUP_LABEL_CLASS_NAME = 'px-2.5 py-1.5 text-xs font-semibold text-subtle-foreground uppercase'

export const MENU_SEPARATOR_CLASS_NAME = 'my-1 h-px bg-border'
