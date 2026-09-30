// The theme context and hook, kept out of ThemeProvider.tsx: oxlint's
// react/only-export-components rule (frontend/.oxlintrc.json) wants a
// component file to export only components, and this file exports
// neither -- just the context object and the hook that reads it.
import { createContext, useContext } from 'react'
import type { ThemePreference } from './theme'

export interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: 'light' | 'dark'
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

// Throws rather than returning a nullable value, so every consumer
// (ThemeMenu, the styleguide) can use the result directly --
// ThemeProvider is mounted once in main.tsx, above every route, so a
// missing provider means a wiring mistake, not a state worth handling
// gracefully.
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
