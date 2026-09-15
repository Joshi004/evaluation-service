// The override-field variants Submit's per-axis cards
// (CheckpointSamplingCard, CheckpointServingCard, StandardOverrideCard)
// build their fields from. Replaces OverrideEditor.tsx's bare
// "unchanged" placeholder -- every field here shows its actual resolved
// default as the input's placeholder, so a submitter sees the value
// that would apply before typing anything, not just the fact that
// something would.
//
// The default is always a placeholder, never a prefilled `value`:
// prefilling would turn a displayed default into a submitted override
// the moment the object is built (OverrideEditor.helper.ts's own
// sparse-overrides contract -- a field must stay entirely absent from
// the request unless the caller actually typed into it), and for a
// select-based field it would silently force one option to look
// selected without the caller choosing it.
//
// "Changed" is `value !== ''` -- the draft's own "leave alone" sentinel
// (see OverrideEditor.helper.ts), not a comparison against the
// resolved default: typing the same number the default already shows
// still counts as a deliberate override once submitted.

interface FieldLabelProps {
  label: string
  isChanged: boolean
  onReset: () => void
}

// Amber is already DryRunPreview.tsx's colour for "new standard, no
// label" -- reused here so "you changed this" reads as the same signal
// everywhere on Submit, not a second colour language.
function FieldLabel({ label, isChanged, onReset }: FieldLabelProps) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      {isChanged && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Changed from the default" />}
      {label}
      {isChanged && (
        <button
          type="button"
          onClick={onReset}
          className="text-amber-400 underline decoration-dotted hover:text-amber-300"
        >
          reset
        </button>
      )}
    </span>
  )
}

function fieldBorderClassName(isChanged: boolean): string {
  return isChanged ? 'border-amber-500/50' : 'border-slate-700'
}

interface NumberOverrideFieldProps {
  label: string
  step: string
  // Already formatted (e.g. "0.1", or "Full dataset" for a null
  // sample_limit) -- the caller is what knows how to turn its own
  // resolved default into a human string.
  defaultValue: string
  value: string
  onValueChange: (value: string) => void
  // A standard's own sampling_overrides mandate on this field, if any
  // (e.g. "gsm8k/v1 mandates 0") -- shown under the input since the
  // mandate wins over this card's default unless the caller overrides
  // it too. Empty for every standard in the catalog today.
  note?: string
}

export function NumberOverrideField({
  label,
  step,
  defaultValue,
  value,
  onValueChange,
  note,
}: NumberOverrideFieldProps) {
  const isChanged = value !== ''
  return (
    <label className="block">
      <FieldLabel label={label} isChanged={isChanged} onReset={() => onValueChange('')} />
      <input
        type="number"
        step={step}
        placeholder={defaultValue}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={`mt-1 w-full rounded border bg-slate-950 px-2 py-1 text-sm text-slate-200 ${fieldBorderClassName(isChanged)}`}
      />
      {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
    </label>
  )
}

export interface SelectOverrideOption {
  value: string
  label: string
}

interface SelectOverrideFieldProps {
  label: string
  options: SelectOverrideOption[]
  // Already composed by the caller (e.g. "Default (strip)") -- the
  // caller is what knows how to turn a resolved default's raw value
  // into a human label; this component only renders it as the empty
  // option.
  defaultOptionLabel: string
  value: string
  onValueChange: (value: string) => void
  note?: string
}

export function SelectOverrideField({
  label,
  options,
  defaultOptionLabel,
  value,
  onValueChange,
  note,
}: SelectOverrideFieldProps) {
  const isChanged = value !== ''
  return (
    <label className="block">
      <FieldLabel label={label} isChanged={isChanged} onReset={() => onValueChange('')} />
      <select
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={`mt-1 w-full rounded border bg-slate-950 px-2 py-1 text-sm text-slate-200 ${fieldBorderClassName(isChanged)}`}
      >
        <option value="">{defaultOptionLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
    </label>
  )
}

interface TextOverrideFieldProps {
  label: string
  // Already formatted, exactly like NumberOverrideField's own
  // defaultValue -- "none" for a null reasoning_parser/quantization
  // (ServingProfilePicker.tsx's own placeholder wording for the same
  // two fields), never a raw `null`.
  defaultValue: string
  value: string
  onValueChange: (value: string) => void
  note?: string
}

// A free-text override field -- reasoning_parser, dtype and
// quantization (CheckpointServingCard.tsx) are strings with no fixed
// option set, so NumberOverrideField and SelectOverrideField above
// don't fit either. Otherwise identical to NumberOverrideField: same
// changed-dot-plus-reset FieldLabel, same placeholder-is-the-default
// rule.
export function TextOverrideField({
  label,
  defaultValue,
  value,
  onValueChange,
  note,
}: TextOverrideFieldProps) {
  const isChanged = value !== ''
  return (
    <label className="block">
      <FieldLabel label={label} isChanged={isChanged} onReset={() => onValueChange('')} />
      <input
        type="text"
        placeholder={defaultValue}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={`mt-1 w-full rounded border bg-slate-950 px-2 py-1 text-sm text-slate-200 ${fieldBorderClassName(isChanged)}`}
      />
      {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
    </label>
  )
}

interface LabelOverrideFieldProps {
  value: string
  onValueChange: (value: string) => void
}

// A card's own name for the row it's about to mint (labels_and_serving_
// overrides plan). Unlike the three fields above, this has no
// "changed" state of its own to indicate: the value shown here --
// whatever the caller already typed, or else a computed suggestion --
// is already what would be sent, and there's no other default it could
// visibly differ from. Clearing it to '' is itself a deliberate choice
// (explicitly unlabelled, today's behaviour) rather than a return to
// some previous state, so there's nothing to "reset" either.
export function LabelOverrideField({ value, onValueChange }: LabelOverrideFieldProps) {
  return (
    <label className="mt-3 block">
      <span className="text-xs text-slate-500">Label</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
      />
      <p className="mt-0.5 text-[11px] text-slate-500">
        Only takes effect if this creates a new row -- clear to submit unlabelled.
      </p>
    </label>
  )
}
