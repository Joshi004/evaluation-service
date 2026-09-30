// A typed layer over React Router's useSearchParams for the filter,
// sort, tab and lens state a colleague should be able to restore by
// copying the address bar. Pure readers first -- they take a plain
// URLSearchParams, so a non-hook helper (e.g. a page's own
// parseFilters) can use the same parsing the hook below does.
import { useSearchParams } from 'react-router'

export function readStringParam(params: URLSearchParams, key: string): string | null {
  return params.get(key)
}

export function readEnumParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = params.get(key)
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

export function readBooleanParam(params: URLSearchParams, key: string, fallback: boolean): boolean {
  const value = params.get(key)
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return fallback
}

// Comma-separated -- matches how paths.compare() already joins run
// ids, so every multi-value URL param in the app splits the same way.
export function readListParam(params: URLSearchParams, key: string): string[] {
  const value = params.get(key)
  return value === null || value === '' ? [] : value.split(',')
}

export function readNumberListParam(params: URLSearchParams, key: string): number[] {
  return readListParam(params, key)
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isFinite(item))
}

// A single numeric id param (e.g. Runs' own `?model=3`, `?batch=6`) --
// `null` for absent or malformed rather than `NaN`, so a caller can
// `??` straight into "no filter".
export function readNumberParam(params: URLSearchParams, key: string): number | null {
  const value = params.get(key)
  if (value === null) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export type UrlParamValue = string | number | boolean | string[] | number[] | null

export interface SetUrlParamsOptions {
  // Defaults to a `replace` navigation (filter edits shouldn't each get
  // their own back-button stop -- "replace for filter edits, push for
  // navigation") -- pass `push: true` for a change that genuinely is a
  // navigation.
  push?: boolean
}

function isEmptyOrDefault(value: UrlParamValue | undefined, defaultValue: UrlParamValue): boolean {
  if (value === null || value === undefined || value === '') {
    return true
  }
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return value === defaultValue
}

function serializeUrlParamValue(value: UrlParamValue): string {
  return Array.isArray(value) ? value.join(',') : String(value)
}

// `defaults` is the value each key takes when its param is entirely
// absent -- passing that same value back to the returned setter drops
// the param instead of writing it out, so a freshly loaded page stays
// a clean URL. Callers should make one call per user event: React
// Router does not queue multiple setSearchParams calls made within
// the same tick, so batching two filter changes into one `changes`
// object is the way to apply them together, not two sequential calls.
export function useUrlState<T extends Record<string, UrlParamValue>>(
  defaults: T,
): [URLSearchParams, (changes: Partial<T>, options?: SetUrlParamsOptions) => void] {
  const [searchParams, setSearchParams] = useSearchParams()

  function setUrlParams(changes: Partial<T>, options: SetUrlParamsOptions = {}): void {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const key of Object.keys(changes)) {
          const value = changes[key]
          if (isEmptyOrDefault(value, defaults[key])) {
            next.delete(key)
          } else {
            next.set(key, serializeUrlParamValue(value as UrlParamValue))
          }
        }
        return next
      },
      { replace: options.push !== true },
    )
  }

  return [searchParams, setUrlParams]
}
