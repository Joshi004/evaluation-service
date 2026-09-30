import { useEffect, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useLocalStorageState } from '../../utils/useLocalStorageState'
import { ThemeContext } from '../../utils/useTheme'
import { isThemePreference, resolveTheme, THEME_STORAGE_KEY } from '../../utils/theme'
import type { ThemePreference } from '../../utils/theme'

interface ThemeProviderProps {
  children: ReactNode
}

// One shared MediaQueryList, read by both subscribe and getSnapshot
// below. Must stay in sync with the inline pre-paint script in
// index.html, which checks the same query before this provider (or
// even the bundle) has loaded.
const prefersLightQuery = window.matchMedia('(prefers-color-scheme: light)')

function subscribeToOSPreference(onStoreChange: () => void): () => void {
  prefersLightQuery.addEventListener('change', onStoreChange)
  return () => prefersLightQuery.removeEventListener('change', onStoreChange)
}

function readOSPrefersLight(): boolean {
  return prefersLightQuery.matches
}

// Mounted once in main.tsx, outermost -- every route and the top bar's
// own ThemeMenu share one value instead of each reading localStorage
// separately. The OS setting is read through useSyncExternalStore
// rather than a resize-style effect-plus-listener pair: matchMedia's
// own 'change' event is exactly the kind of external store this hook
// exists for, and it re-renders in the same commit as the OS event
// instead of a tick later.
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [storedPreference, setStoredPreference] = useLocalStorageState(THEME_STORAGE_KEY, 'system')
  const preference: ThemePreference = isThemePreference(storedPreference) ? storedPreference : 'system'

  const prefersLightOS = useSyncExternalStore(subscribeToOSPreference, readOSPrefersLight)
  const resolvedTheme = resolveTheme(preference, prefersLightOS)

  // The one place data-theme is written after first paint. The inline
  // script in index.html already set it before paint, from this same
  // storage key and media query, so this effect is a no-op on load and
  // only fires again when the preference or the OS setting changes.
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  function setPreference(next: ThemePreference): void {
    setStoredPreference(next)
  }

  return <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>{children}</ThemeContext.Provider>
}
