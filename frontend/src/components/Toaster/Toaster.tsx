import type { CSSProperties } from 'react'
import { Toaster as SonnerToaster } from 'sonner'
import { useTheme } from '../../utils/useTheme'

// Mounted once in main.tsx. sonner reads its colours from CSS custom
// properties on its own container (--normal-bg, --success-bg, ...);
// setting them here, via inline style so they win over sonner's own
// theme-selector rules, is sonner's documented theming mechanism --
// simpler and more reliable than re-styling every internal part (icon,
// buttons, close button) by hand. `theme` is a separate mechanism: it
// picks which of sonner's own built-in dark/light rules apply, which
// matters for the handful of pieces those rules hardcode rather than
// read from a CSS variable (the close button's hover background, the
// cancel button's overlay tint) -- without it, sonner defaults to
// 'light' regardless of what this file's own variables say.
const TOAST_COLOR_VARS = {
  '--normal-bg': 'var(--popover)',
  '--normal-border': 'var(--border)',
  '--normal-text': 'var(--foreground)',
  '--success-bg': 'var(--success-soft)',
  '--success-border': 'var(--success)',
  '--success-text': 'var(--success)',
  '--error-bg': 'var(--danger-soft)',
  '--error-border': 'var(--danger)',
  '--error-text': 'var(--danger)',
  '--warning-bg': 'var(--warning-soft)',
  '--warning-border': 'var(--warning)',
  '--warning-text': 'var(--warning)',
  '--info-bg': 'var(--info-soft)',
  '--info-border': 'var(--info)',
  '--info-text': 'var(--info)',
} as CSSProperties

export function Toaster() {
  const { resolvedTheme } = useTheme()
  return <SonnerToaster theme={resolvedTheme} style={TOAST_COLOR_VARS} closeButton />
}
