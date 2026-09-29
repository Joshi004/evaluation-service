import { useState } from 'react'

// A single string value persisted to localStorage under `key` --
// `submitted_by`, `registered_by` and a later theme choice are all
// strings, so this stays generic over one type rather than needing an
// unchecked JSON.parse cast for every consumer.
export function useLocalStorageState(
  key: string,
  defaultValue: string,
): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(() => readLocalStorage(key) ?? defaultValue)

  function setPersistedValue(next: string): void {
    setValue(next)
    writeLocalStorage(key, next)
  }

  return [value, setPersistedValue]
}

function readLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Losing the persisted value costs a re-type next session, not
    // correctness.
  }
}
