import type { ReactNode } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../utils/cn'

interface MenuItem {
  label: ReactNode
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}

interface MenuProps {
  trigger: ReactNode
  items: MenuItem[]
  align?: 'start' | 'center' | 'end'
}

// A trigger plus a flat list of actions -- row-level "..." menus,
// header actions. For anything beyond a flat action list (checkboxes,
// radios, submenus), compose DropdownMenuPrimitive directly instead of
// stretching this shape to fit.
export function Menu({ trigger, items, align = 'end' }: MenuProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-40 rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {/* No plain `outline-none` here on purpose -- Tailwind's
              outline-width/-color utilities read a shared
              --tw-outline-style custom property rather than forcing
              one of their own, so an unconditional outline-none would
              pin that property to "none" and the focus-visible
              utilities below would have nothing to override. Leaving
              outline-style unset instead means it is only ever set
              (to "solid") inside the focus-visible variant itself, and
              inset so it never clips against this popover's small
              padding, for the keyboard-arrow navigation Radix drives
              with real DOM focus on each item in turn. */}
          {items.map((item, index) => (
            <DropdownMenuPrimitive.Item
              key={index}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(
                'cursor-pointer rounded-md px-2.5 py-1.5 text-sm',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                'data-[highlighted]:bg-muted',
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                item.destructive ? 'text-danger' : 'text-foreground',
              )}
            >
              {item.label}
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
