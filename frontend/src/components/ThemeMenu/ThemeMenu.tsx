import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { IconButton } from '../IconButton/IconButton'
import { useTheme } from '../../utils/useTheme'
import { isThemePreference } from '../../utils/theme'
import type { ThemePreference } from '../../utils/theme'
import { cn } from '../../utils/cn'
import { MENU_CONTENT_CLASS_NAME, MENU_ITEM_CLASS_NAME } from '../Menu/Menu.helper'

const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark']

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

// One icon per preference, not per resolved theme -- "System" keeps
// showing Monitor even while the OS itself currently resolves to
// light or dark, since the icon's job is to show which of the three
// menu choices is active, not to duplicate the resolved light/dark
// state.
const THEME_ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
}

// The top bar's theme switcher, after SystemStatus. A RadioGroup, not
// Menu's own flat action list -- exactly one of the three choices is
// ever selected, and Menu.tsx's own comment says to compose
// DropdownMenuPrimitive directly instead of stretching that shape to
// fit checkboxes or radios.
export function ThemeMenu() {
  const { preference, setPreference } = useTheme()
  const Icon = THEME_ICONS[preference]

  function handlePreferenceChange(value: string): void {
    if (isThemePreference(value)) {
      setPreference(value)
    }
  }

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <IconButton aria-label={`Theme: ${THEME_LABELS[preference]}`}>
          <Icon className="h-4 w-4" />
        </IconButton>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={6}
          className={cn(MENU_CONTENT_CLASS_NAME, 'min-w-36')}
        >
          <DropdownMenuPrimitive.RadioGroup value={preference} onValueChange={handlePreferenceChange}>
            {THEME_PREFERENCES.map((value) => (
              <DropdownMenuPrimitive.RadioItem
                key={value}
                value={value}
                className={cn(MENU_ITEM_CLASS_NAME, 'flex items-center justify-between gap-4 text-foreground')}
              >
                {THEME_LABELS[value]}
                <DropdownMenuPrimitive.ItemIndicator>
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                </DropdownMenuPrimitive.ItemIndicator>
              </DropdownMenuPrimitive.RadioItem>
            ))}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
