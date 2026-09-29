import type { ReactNode } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../utils/cn'

interface TabItem {
  value: string
  label: ReactNode
  content: ReactNode
}

interface TabsProps {
  items: TabItem[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

// A labelled set of panels sharing one content area. `value` is
// controlled from outside so a page can keep the active tab in the
// URL (§4.5's "state lives in the URL" pattern) instead of this
// primitive owning that state itself.
export function Tabs({ items, value, onValueChange, className }: TabsProps) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>
      <TabsPrimitive.List className="flex gap-1 border-b border-border">
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground',
              'hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground',
            )}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} value={item.value} className="mt-4">
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}
