import type { ProfileSource } from '../../data/types'

export const PROFILE_SOURCE_OPTIONS: { value: ProfileSource; label: string }[] = [
  { value: 'benchmark_default', label: 'Benchmark default' },
  { value: 'from_checkpoint', label: 'From checkpoint' },
  { value: 'user_provided', label: 'User provided' },
]
