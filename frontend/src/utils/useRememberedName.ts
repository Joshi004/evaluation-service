import { useLocalStorageState } from './useLocalStorageState'

// One remembered display name, shared by every form field that asks a
// person to type their own name. New evaluation's submitted_by and
// registration's registered_by both read and write this same value, so
// entering it once fills both.
//
// Storage key renamed from the New evaluation wizard's original
// 'evalsvc.submitted-by.v1': with no real users yet and the service not
// deployed anywhere, there is no saved value at that old key worth
// preserving under its old, now-too-narrow name.
export function useRememberedName(): [string, (value: string) => void] {
  return useLocalStorageState('evalsvc.user-name.v1', '')
}
