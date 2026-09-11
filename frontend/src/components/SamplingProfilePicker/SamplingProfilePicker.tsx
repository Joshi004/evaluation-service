import type { CheckpointListItem, SamplingProfileSummary } from '../../api/client'
import { samplingProfileDisplayName } from '../../utils/samplingProfileDisplayName'
import { buildSamplingValueRows } from '../../utils/samplingProfileValueRows'
import {
  describeCheckpointDefaults,
  findSamplingProfile,
  namedSamplingProfiles,
  type SamplingProfileChoice,
} from './SamplingProfilePicker.helper'

interface SamplingProfilePickerProps {
  profiles: SamplingProfileSummary[]
  selectedCheckpoints: CheckpointListItem[]
  choice: SamplingProfileChoice
  onChoiceChange: (choice: SamplingProfileChoice) => void
}

const INPUT_CLASS_NAME =
  'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200'

// The third axis on Submit (S-D35): either "however each checkpoint
// normally speaks" (the default choice) or "everything under this one
// named profile" applied to the whole grid -- deliberately a single
// select rather than one picker per pair, since S-D35 found a per-cell
// control on a 6x4 grid to be 24 controls and an unreadable dry run.
// Field-level sampling deltas stay OverrideEditor's job; this is only
// which base profile those deltas apply on top of.
export function SamplingProfilePicker({
  profiles,
  selectedCheckpoints,
  choice,
  onChoiceChange,
}: SamplingProfilePickerProps) {
  const named = namedSamplingProfiles(profiles)
  const selectedProfile = findSamplingProfile(profiles, choice)

  return (
    <div>
      <label className="block">
        <span className="text-xs text-slate-500">Sampling profile</span>
        <select
          value={choice ?? ''}
          onChange={(event) =>
            onChoiceChange(event.target.value === '' ? null : Number(event.target.value))
          }
          className={INPUT_CLASS_NAME}
        >
          <option value="">Use each checkpoint&apos;s default</option>
          {named.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {samplingProfileDisplayName(profile.label, profile.hash)}
            </option>
          ))}
        </select>
      </label>

      {/* Read-only, so a submitter can see what a profile actually
          means without leaving the page (Phase 8, item 1). */}
      <div className="mt-2 rounded border border-slate-800 bg-slate-950 p-3">
        {choice === null ? (
          <p className="text-xs text-slate-400">{describeCheckpointDefaults(selectedCheckpoints)}</p>
        ) : selectedProfile ? (
          <table className="w-full border-collapse text-xs">
            <tbody>
              {buildSamplingValueRows(selectedProfile).map((row) => (
                <tr key={row.field}>
                  <td className="w-40 py-0.5 pr-2 text-slate-500">{row.label}</td>
                  <td className="py-0.5 font-mono text-slate-200">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-slate-500">Loading profile…</p>
        )}
      </div>
    </div>
  )
}
