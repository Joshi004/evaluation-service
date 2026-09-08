import type { ReactNode } from 'react'
import type { ProfileSource } from '../../data/types'
import { PROFILE_SOURCE_OPTIONS } from './ProfileSourceSelector.helper'

interface ProfileSourceSelectorProps {
  label: string
  value: ProfileSource
  onChange: (source: ProfileSource) => void
  resolvedPreview: string
  children?: ReactNode
}

// One Layer 2 setting's three-way source picker (EVAL_SERVICE_PLAN.md
// Section 5: benchmark default / a value the checkpoint itself specifies /
// a value the user types in) plus a live preview of what it resolves to.
// `children` is where the caller puts the actual override inputs, shown
// only once "User provided" is selected — this component doesn't know or
// care what those inputs look like for sampling vs. think handling vs.
// max tokens.
export function ProfileSourceSelector({ label, value, onChange, resolvedPreview, children }: ProfileSourceSelectorProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <p className="text-sm font-medium text-slate-200">{label}</p>
      <div className="mt-2 flex gap-1 rounded-md bg-slate-950 p-1">
        {PROFILE_SOURCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
              value === option.value ? 'bg-sky-500/20 text-sky-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {value === 'user_provided' && children && <div className="mt-2">{children}</div>}
      <p className="mt-2 text-xs text-slate-500">
        Resolves to: <span className="text-slate-300">{resolvedPreview}</span>
      </p>
    </div>
  )
}
