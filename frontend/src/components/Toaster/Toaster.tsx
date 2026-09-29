import type { CSSProperties } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

// Mounted once in main.tsx. sonner reads its colours from CSS custom
// properties on its own container (--normal-bg, --success-bg, ...);
// setting them here, via inline style so they win over sonner's own
// theme-selector rules, is sonner's documented theming mechanism --
// simpler and more reliable than re-styling every internal part (icon,
// buttons, close button) by hand.
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
  return <SonnerToaster style={TOAST_COLOR_VARS} closeButton />
}
