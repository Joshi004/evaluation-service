import type { ReactNode } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../utils/cn'
import { MENU_CONTENT_CLASS_NAME, MENU_ITEM_CLASS_NAME } from './Menu.helper'

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
        <DropdownMenuPrimitive.Content align={align} sideOffset={6} className={cn(MENU_CONTENT_CLASS_NAME, 'min-w-40')}>
          {items.map((item, index) => (
            <DropdownMenuPrimitive.Item
              key={index}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(
                MENU_ITEM_CLASS_NAME,
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
