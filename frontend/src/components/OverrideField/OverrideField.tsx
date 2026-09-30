// The override-field variants New evaluation's per-axis cards
// (CheckpointSamplingCard, CheckpointServingCard, StandardOverrideCard)
// build their fields from, composed from the TextInput/SelectField
// primitives (the original version hand-styled its own
// <input>/<select>).
//
// The default is always a placeholder, never a prefilled `value`:
// prefilling would turn a displayed default into a submitted override
// the moment the object is built (SubmitOverrides.helper.ts's own
// sparse-overrides contract -- a field must stay entirely absent from
// the request unless the caller actually typed into it), and for a
// select-based field it would silently force one option to look
// selected without the caller choosing it.
//
// "Changed" is `value !== ''` -- the draft's own "leave alone" sentinel
// -- not a comparison against the resolved default: typing the same
// number the default already shows still counts as a deliberate
// override once submitted. The cue lives entirely in the field's own
// label (a dot plus a reset link) rather than the input's border:
// TextInput/SelectField only know `invalid`, which means something
// different (a validation failure), not "you changed this".

import { SelectField } from '../SelectField/SelectField'
import { TextInput } from '../TextInput/TextInput'

interface FieldLabelProps {
  label: string
  isChanged: boolean
  onReset: () => void
}

function FieldLabel({ label, isChanged, onReset }: FieldLabelProps) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {isChanged && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Changed from the default" aria-hidden="true" />
          <span className="sr-only">Changed from the default</span>
        </>
      )}
      {label}
      {isChanged && (
        <button
          type="button"
          onClick={onReset}
          className="text-primary underline decoration-dotted hover:text-primary-hover"
        >
          reset
        </button>
      )}
    </span>
  )
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

export function NumberOverrideField({ label, step, defaultValue, value, onValueChange, note }: NumberOverrideFieldProps) {
  const isChanged = value !== ''
  return (
    <label className="block">
      <FieldLabel label={label} isChanged={isChanged} onReset={() => onValueChange('')} />
      <TextInput
        type="number"
        step={step}
        placeholder={defaultValue}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="mt-1"
      />
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
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
  // Already composed by the caller (e.g. "Default (Strip thinking)")
  // -- the caller is what knows how to turn a resolved default's raw
  // value into a human label; this component only renders it as the
  // empty option.
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
      <SelectField value={value} onChange={(event) => onValueChange(event.target.value)} className="mt-1">
        <option value="">{defaultOptionLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
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
// don't fit either. Otherwise identical to NumberOverrideField.
export function TextOverrideField({ label, defaultValue, value, onValueChange, note }: TextOverrideFieldProps) {
  const isChanged = value !== ''
  return (
    <label className="block">
      <FieldLabel label={label} isChanged={isChanged} onReset={() => onValueChange('')} />
      <TextInput
        type="text"
        placeholder={defaultValue}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="mt-1"
      />
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </label>
  )
}

interface LabelOverrideFieldProps {
  value: string
  onValueChange: (value: string) => void
}

// A card's own name for the row it's about to mint. Unlike the three
// fields above, this has no "changed" state of its own to indicate: the
// value shown here -- whatever the caller already typed, or else a
// computed suggestion -- is already what would be sent, and there's no
// other default it could visibly differ from. Clearing it to '' is
// itself a deliberate choice (explicitly unlabelled) rather than a
// return to some previous state, so there's nothing to "reset" either.
export function LabelOverrideField({ value, onValueChange }: LabelOverrideFieldProps) {
  return (
    <label className="mt-3 block">
      <span className="text-xs text-muted-foreground">Label</span>
      <TextInput type="text" value={value} onChange={(event) => onValueChange(event.target.value)} className="mt-1" />
      <p className="mt-0.5 text-xs text-muted-foreground">
        Only takes effect if this creates a new row -- clear to submit unlabelled.
      </p>
    </label>
  )
}
