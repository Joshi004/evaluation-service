import { useEffect, useState } from 'react'
import type { ChatSamplingSettings, SamplingProfileSummary, ServingProfileSummary } from '../../api/client'
import { samplingProfileDisplayName } from '../../utils/samplingProfileDisplayName'
import { SAMPLING_FIELD_LABELS } from '../../utils/samplingProfileValueRows'
import { Button } from '../Button/Button'
import { Checkbox } from '../Checkbox/Checkbox'
import { KeyValueList } from '../KeyValueList/KeyValueList'
import { SelectField } from '../SelectField/SelectField'
import { SidePanel } from '../SidePanel/SidePanel'
import { TextArea } from '../TextArea/TextArea'
import { TextInput } from '../TextInput/TextInput'
import {
  applyProfileToDraft,
  boundsHint,
  draftFromSettings,
  draftSystemPrompt,
  parseDraftSettings,
  SAMPLING_FIELD_BOUNDS,
  type ChatSettingsDraft,
} from './ChatSettingsPanel.helper'

interface ChatSettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: ChatSamplingSettings
  samplingProfileId: number | null
  systemPrompt: string | null
  defaultSamplingProfile: SamplingProfileSummary
  samplingProfiles: SamplingProfileSummary[]
  // This model's live server's own serving profile, for the context
  // window / reasoning parser summary -- null while /serving-profiles
  // hasn't loaded yet.
  servingProfile: ServingProfileSummary | null
  onUpdateSettings: (settings: ChatSamplingSettings, samplingProfileId: number | null) => void
  onUpdateSystemPrompt: (value: string | null) => void
}

interface NumberFieldProps {
  field: keyof typeof SAMPLING_FIELD_BOUNDS
  label: string
  value: string
  onValueChange: (value: string) => void
}

// One editable sampling field -- local to this panel, since nowhere
// else needs an always-has-a-real-value number input with its own
// bound hint (OverrideField.tsx's fields are for a different concept:
// a sparse, nullable override, not a value the request always sends).
function NumberField({ field, label, value, onValueChange }: NumberFieldProps) {
  const bounds = SAMPLING_FIELD_BOUNDS[field]
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <TextInput
        type="number"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="mt-1"
      />
      <span className="mt-0.5 block text-xs text-subtle-foreground">{boundsHint(bounds)}</span>
    </label>
  )
}

// This conversation's sampling settings, system prompt, and a glance at
// the live server's own context window and reasoning parser. Everything
// here is a local scratch draft (ChatSettingsPanel.helper.ts's own
// ChatSettingsDraft): edits reach the real conversation -- and its own
// localStorage write -- only once the panel closes, the same "Done
// commits, there is no separate Cancel" model ModelSettingsRow's own
// Customize panel already uses.
export function ChatSettingsPanel({
  open,
  onOpenChange,
  settings,
  samplingProfileId,
  systemPrompt,
  defaultSamplingProfile,
  samplingProfiles,
  servingProfile,
  onUpdateSettings,
  onUpdateSystemPrompt,
}: ChatSettingsPanelProps) {
  const [draft, setDraft] = useState<ChatSettingsDraft>(() =>
    draftFromSettings(settings, samplingProfileId, systemPrompt),
  )

  // Re-seeds the draft from the real conversation every time the panel
  // opens. settings/samplingProfileId/systemPrompt are deliberately
  // left out of the dependency list: re-running this while already
  // open (e.g. a parent re-render from the endpoints poll) would wipe
  // out whatever the user is mid-typing.
  useEffect(() => {
    if (open) {
      setDraft(draftFromSettings(settings, samplingProfileId, systemPrompt))
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen) {
      onUpdateSettings(parseDraftSettings(draft), draft.samplingProfileId)
      onUpdateSystemPrompt(draftSystemPrompt(draft))
    }
    onOpenChange(nextOpen)
  }

  function updateDraft(patch: Partial<ChatSettingsDraft>): void {
    setDraft((previous) => ({ ...previous, ...patch }))
  }

  // Any hand edit to a sampling field clears samplingProfileId -- the
  // draft no longer matches the profile it started from, the same
  // "touched once, custom from then on" rule OverrideField's own
  // isChanged indicator uses.
  function updateSamplingField(patch: Partial<ChatSettingsDraft>): void {
    updateDraft({ ...patch, samplingProfileId: null })
  }

  function handleProfileChange(value: string): void {
    const profile = samplingProfiles.find((candidate) => candidate.id === Number(value))
    if (profile) {
      setDraft((previous) => applyProfileToDraft(previous, profile))
    }
  }

  function resetToProfile(): void {
    const profile =
      samplingProfiles.find((candidate) => candidate.id === draft.samplingProfileId) ?? defaultSamplingProfile
    setDraft((previous) => applyProfileToDraft(previous, profile))
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={handleOpenChange}
      title="Chat settings"
      footer={
        <div className="flex justify-end">
          <Button size="sm" onClick={() => handleOpenChange(false)}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {servingProfile && (
          <KeyValueList
            rows={[
              {
                label: 'Context window',
                value:
                  servingProfile.max_model_len === null
                    ? 'Model default (not set)'
                    : `${servingProfile.max_model_len.toLocaleString()} tokens`,
              },
              { label: 'Reasoning parser', value: servingProfile.reasoning_parser ?? 'None' },
            ]}
          />
        )}

        <div className="flex items-end justify-between gap-2">
          <label className="block flex-1">
            <span className="text-xs text-muted-foreground">Sampling profile</span>
            <SelectField
              value={draft.samplingProfileId === null ? '' : String(draft.samplingProfileId)}
              onValueChange={handleProfileChange}
              placeholder="Custom (edited by hand)"
              groups={[
                {
                  options: samplingProfiles.map((profile) => ({
                    value: String(profile.id),
                    label:
                      profile.id === defaultSamplingProfile.id
                        ? `${samplingProfileDisplayName(profile.label, profile.hash)} (this model's default)`
                        : samplingProfileDisplayName(profile.label, profile.hash),
                  })),
                },
              ]}
              className="mt-1 w-full"
            />
          </label>
          <Button variant="secondary" size="sm" onClick={resetToProfile}>
            Reset to profile
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            field="temperature"
            label={SAMPLING_FIELD_LABELS.temperature}
            value={draft.temperature}
            onValueChange={(value) => updateSamplingField({ temperature: value })}
          />
          <NumberField
            field="topP"
            label={SAMPLING_FIELD_LABELS.top_p}
            value={draft.topP}
            onValueChange={(value) => updateSamplingField({ topP: value })}
          />
          <NumberField
            field="topK"
            label={SAMPLING_FIELD_LABELS.top_k}
            value={draft.topK}
            onValueChange={(value) => updateSamplingField({ topK: value })}
          />
          <NumberField
            field="presencePenalty"
            label={SAMPLING_FIELD_LABELS.presence_penalty}
            value={draft.presencePenalty}
            onValueChange={(value) => updateSamplingField({ presencePenalty: value })}
          />
          <NumberField
            field="repetitionPenalty"
            label={SAMPLING_FIELD_LABELS.repetition_penalty}
            value={draft.repetitionPenalty}
            onValueChange={(value) => updateSamplingField({ repetitionPenalty: value })}
          />
          <NumberField
            field="maxTokens"
            label={SAMPLING_FIELD_LABELS.max_tokens}
            value={draft.maxTokens}
            onValueChange={(value) => updateSamplingField({ maxTokens: value })}
          />
          <NumberField
            field="seed"
            label={`${SAMPLING_FIELD_LABELS.seed} (blank = random)`}
            value={draft.seed}
            onValueChange={(value) => updateSamplingField({ seed: value })}
          />
          <label className="flex items-center gap-2 pt-5">
            <Checkbox
              checked={draft.enableThinking}
              onChange={(event) => updateSamplingField({ enableThinking: event.target.checked })}
            />
            <span className="text-sm text-foreground">{SAMPLING_FIELD_LABELS.enable_thinking}</span>
          </label>
        </div>

        <label className="block">
          <span className="text-xs text-muted-foreground">System prompt</span>
          <TextArea
            value={draft.systemPrompt}
            onChange={(event) => updateDraft({ systemPrompt: event.target.value })}
            rows={4}
            placeholder="Optional -- sent once, before the conversation."
            className="mt-1"
          />
        </label>
      </div>
    </SidePanel>
  )
}
