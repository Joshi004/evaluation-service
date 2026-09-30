// The three choices in the theme menu -- "system" tracks the OS
// setting instead of picking light or dark outright.
export type ThemePreference = 'system' | 'light' | 'dark'

// Same evalsvc.*.v1 versioning as the other localStorage keys
// (useRememberedName.ts's evalsvc.user-name.v1, cluster.ts's
// evalsvc.cluster-partitions-cache.v1) -- bump the suffix, not the
// key name, if the stored shape ever changes.
export const THEME_STORAGE_KEY = 'evalsvc.theme.v1'

export function isThemePreference(value: string): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

// Turns a preference plus the OS's own setting into the one value
// index.css actually branches on (data-theme is only ever 'light' or
// 'dark', never 'system'). Kept in sync by hand with the inline
// pre-paint script in index.html, which can't import this module --
// it runs before any bundle loads.
export function resolveTheme(preference: ThemePreference, prefersLightOS: boolean): 'light' | 'dark' {
  if (preference === 'system') {
    return prefersLightOS ? 'light' : 'dark'
  }
  return preference
}
