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

// Overrides apply uniformly to every selected recipe (CreateRunsRequest
// carries one `overrides` object for the whole grid, not one per
// recipe -- app/schemas/runs.py), so this editor has no notion of a
// "current value" to show: each selected recipe may already differ on
// any of these fields. DryRunPreview is where the actual before/after
// per recipe shows up, from the backend's own diff.
export function OverrideEditor({ draft, onChange }: OverrideEditorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-300">Evaluation shape</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField
            label="Sample limit"
            step="1"
            value={draft.sample_limit}
            onValueChange={(value) => onChange({ ...draft, sample_limit: value })}
          />
          <NumberField
            label="Few-shot"
            step="1"
            value={draft.few_shot}
            onValueChange={(value) => onChange({ ...draft, few_shot: value })}
          />
          <NumberField
            label="Repeats"
            step="1"
            value={draft.repeats}
            onValueChange={(value) => onChange({ ...draft, repeats: value })}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300">Sampling</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField
            label="Temperature"
            step="0.01"
            value={draft.temperature}
            onValueChange={(value) => onChange({ ...draft, temperature: value })}
          />
          <NumberField
            label="Top-p"
            step="0.01"
            value={draft.top_p}
            onValueChange={(value) => onChange({ ...draft, top_p: value })}
          />
          <NumberField
            label="Top-k"
            step="1"
            value={draft.top_k}
            onValueChange={(value) => onChange({ ...draft, top_k: value })}
          />
          <NumberField
            label="Min-p"
            step="0.01"
            value={draft.min_p}
            onValueChange={(value) => onChange({ ...draft, min_p: value })}
          />
          <NumberField
            label="Presence penalty"
            step="0.01"
            value={draft.presence_penalty}
            onValueChange={(value) => onChange({ ...draft, presence_penalty: value })}
          />
          <NumberField
            label="Repetition penalty"
            step="0.01"
            value={draft.repetition_penalty}
            onValueChange={(value) => onChange({ ...draft, repetition_penalty: value })}
          />
          <NumberField
            label="Max tokens"
            step="1"
            value={draft.max_tokens}
            onValueChange={(value) => onChange({ ...draft, max_tokens: value })}
          />

          <label className="block">
            <span className="text-xs text-slate-500">Enable thinking</span>
            <select
              value={draft.enable_thinking}
              onChange={(event) =>
                onChange({
                  ...draft,
                  enable_thinking: event.target.value as OverrideDraft['enable_thinking'],
                })
              }
              className={INPUT_CLASS_NAME}
            >
              <option value="">unchanged</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-slate-500">Think handling</span>
            <select
              value={draft.think_handling}
              onChange={(event) =>
                onChange({
                  ...draft,
                  think_handling: event.target.value as OverrideDraft['think_handling'],
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
    </div>
  )
}
