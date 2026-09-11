import type { OverrideDraft } from './OverrideEditor.helper'

interface OverrideEditorProps {
  draft: OverrideDraft
  onChange: (draft: OverrideDraft) => void
}

const INPUT_CLASS_NAME =
  'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200'

interface NumberFieldProps {
  label: string
  step: string
  value: string
  onValueChange: (value: string) => void
}

// One override field, blank meaning "leave this alone" -- overrides.py
// only sees a field at all once its input has something in it (see the
// helper's module docstring). Local to this component: nothing else
// renders a bare labelled number input this way.
function NumberField({ label, step, value, onValueChange }: NumberFieldProps) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        type="number"
        step={step}
        placeholder="unchanged"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={INPUT_CLASS_NAME}
      />
    </label>
  )
}

// Overrides apply uniformly to every selected standard (CreateRunsRequest
// carries one `standard_overrides` and one `sampling_overrides` object
// for the whole grid, not one per standard -- app/schemas/runs.py), so
// this editor has no notion of a "current value" to show: each selected
// standard may already differ on any of these fields. DryRunPreview is
// where the actual before/after per standard (and per resolved sampling
// profile) shows up, from the backend's own diff.
//
// The two groups below mirror docs/STANDARDS_AND_PROFILES_PHASES.md
// Phase 3's split of these same fields across the `standard` and
// `sampling_profile` tables -- "Evaluation shape" is every field that
// stayed on the standard (including think_handling, a protocol field,
// not a sampling one), "Sampling" is every field that moved to the
// sampling profile.
export function OverrideEditor({ draft, onChange }: OverrideEditorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-300">Evaluation shape</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField
            label="Sample limit"
            step="1"
            value={draft.standard.sample_limit}
            onValueChange={(value) =>
              onChange({ ...draft, standard: { ...draft.standard, sample_limit: value } })
            }
          />
          <NumberField
            label="Few-shot"
            step="1"
            value={draft.standard.few_shot}
            onValueChange={(value) =>
              onChange({ ...draft, standard: { ...draft.standard, few_shot: value } })
            }
          />
          <NumberField
            label="Repeats"
            step="1"
            value={draft.standard.repeats}
            onValueChange={(value) =>
              onChange({ ...draft, standard: { ...draft.standard, repeats: value } })
            }
          />

          <label className="block">
            <span className="text-xs text-slate-500">Think handling</span>
            <select
              value={draft.standard.think_handling}
              onChange={(event) =>
                onChange({
                  ...draft,
                  standard: {
                    ...draft.standard,
                    think_handling: event.target.value as OverrideDraft['standard']['think_handling'],
                  },
                })
              }
              className={INPUT_CLASS_NAME}
            >
              <option value="">unchanged</option>
              <option value="strip">strip</option>
              <option value="as_is">as_is</option>
            </select>
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300">Sampling</h3>
        <p className="mt-1 text-xs text-slate-500">
          Applies on top of the selected sampling profile (or each checkpoint's default) and anything the
          standard itself mandates for this benchmark.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField
            label="Temperature"
            step="0.01"
            value={draft.sampling.temperature}
            onValueChange={(value) =>
              onChange({ ...draft, sampling: { ...draft.sampling, temperature: value } })
            }
          />
          <NumberField
            label="Top-p"
            step="0.01"
            value={draft.sampling.top_p}
            onValueChange={(value) => onChange({ ...draft, sampling: { ...draft.sampling, top_p: value } })}
          />
          <NumberField
            label="Top-k"
            step="1"
            value={draft.sampling.top_k}
            onValueChange={(value) => onChange({ ...draft, sampling: { ...draft.sampling, top_k: value } })}
          />
          <NumberField
            label="Min-p"
            step="0.01"
            value={draft.sampling.min_p}
            onValueChange={(value) => onChange({ ...draft, sampling: { ...draft.sampling, min_p: value } })}
          />
          <NumberField
            label="Presence penalty"
            step="0.01"
            value={draft.sampling.presence_penalty}
            onValueChange={(value) =>
              onChange({ ...draft, sampling: { ...draft.sampling, presence_penalty: value } })
            }
          />
          <NumberField
            label="Repetition penalty"
            step="0.01"
            value={draft.sampling.repetition_penalty}
            onValueChange={(value) =>
              onChange({ ...draft, sampling: { ...draft.sampling, repetition_penalty: value } })
            }
          />
          <NumberField
            label="Max tokens"
            step="1"
            value={draft.sampling.max_tokens}
            onValueChange={(value) =>
              onChange({ ...draft, sampling: { ...draft.sampling, max_tokens: value } })
            }
          />

          <label className="block">
            <span className="text-xs text-slate-500">Enable thinking</span>
            <select
              value={draft.sampling.enable_thinking}
              onChange={(event) =>
                onChange({
                  ...draft,
                  sampling: {
                    ...draft.sampling,
                    enable_thinking: event.target.value as OverrideDraft['sampling']['enable_thinking'],
                  },
                })
              }
              className={INPUT_CLASS_NAME}
            >
              <option value="">unchanged</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  )
}
