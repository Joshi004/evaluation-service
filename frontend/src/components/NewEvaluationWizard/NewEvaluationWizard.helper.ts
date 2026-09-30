// Non-DOM logic for NewEvaluationWizard.tsx: the three-step contract
// (the `step`, `models`, `benchmarks`, `from` URL params), the id ->
// row lookups its children need, the batch name's own
// suggest-and-validate rule, and the request objects sent to the
// preview and submit endpoints.
import type { CheckpointListItem, CreateRunsRequest, RunListItem, StandardSummary } from '../../api/client'
import type { RequestOverrides } from '../SubmitOverrides/SubmitOverrides.helper'

export type NewEvaluationStepKey = 'choose' | 'settings' | 'review'

export interface NewEvaluationStepDefinition {
  key: NewEvaluationStepKey
  label: string
}

export const NEW_EVALUATION_STEPS: NewEvaluationStepDefinition[] = [
  { key: 'choose', label: 'Choose' },
  { key: 'settings', label: 'Settings' },
  { key: 'review', label: 'Review' },
]

const STEP_KEYS: readonly NewEvaluationStepKey[] = ['choose', 'settings', 'review']

export function parseStepParam(value: string | null): NewEvaluationStepKey {
  return (STEP_KEYS as readonly string[]).includes(value ?? '') ? (value as NewEvaluationStepKey) : 'choose'
}

// Settings and Review both need a complete grid (a preview with an
// empty checkpoint_ids or standard_ids 422s, `app/schemas/runs.py`'s
// `Field(min_length=1)`) -- Choose alone is reachable with nothing
// picked yet.
export function isStepReachable(stepKey: NewEvaluationStepKey, gridReady: boolean): boolean {
  return stepKey === 'choose' || gridReady
}

// The batch name's own starting point before existingBatchNames below
// disambiguates it -- up to three benchmark slugs joined with a dash,
// else a plain count, so "ifeval-ifbench" names itself but a
// twenty-benchmark grid doesn't produce an unreadable name.
function batchNameRoot(selectedStandards: StandardSummary[]): string {
  if (selectedStandards.length === 0) {
    return 'evaluation'
  }
  if (selectedStandards.length <= 3) {
    return selectedStandards.map((standard) => standard.benchmark).join('-')
  }
  return `${selectedStandards.length}-benchmarks`
}

export function existingBatchNames(runs: RunListItem[]): Set<string> {
  return new Set(runs.map((run) => run.run_group_name))
}

// Unlike suggestNextLabel (SubmitOverrides.helper.ts), which always
// appends a "-01" suffix even to a completely free name -- right for a
// sampling/serving profile customisation, where the bare name is
// already claimed by the *unmodified* profile it started from -- a
// batch name has no such collision by construction, so the bare root
// is offered first and only suffixed once it's actually taken.
function suggestUniqueBatchName(root: string, existingNames: ReadonlySet<string>): string {
  if (!existingNames.has(root)) {
    return root
  }
  let suffix = 1
  let candidate = `${root}-${String(suffix).padStart(2, '0')}`
  while (existingNames.has(candidate)) {
    suffix += 1
    candidate = `${root}-${String(suffix).padStart(2, '0')}`
  }
  return candidate
}

export function suggestBatchName(selectedStandards: StandardSummary[], existingNames: ReadonlySet<string>): string {
  return suggestUniqueBatchName(batchNameRoot(selectedStandards), existingNames)
}

export function validateBatchName(name: string, existingNames: ReadonlySet<string>): string | null {
  const trimmed = name.trim()
  if (trimmed === '') {
    return 'Name this batch before running it.'
  }
  if (existingNames.has(trimmed)) {
    return 'A batch with this name already exists.'
  }
  return null
}

interface SubmitBlockOptions {
  gridReady: boolean
  batchNameError: string | null
  isPreviewLoading: boolean
  isPreviewFetching: boolean
  isPreviewError: boolean
  hasBlockingError: boolean
}

// Every reason Run evaluation can be disabled, checked in the order a
// submitter should fix them -- pick a grid, name the batch, wait for
// the check, then fix what it found. `null` once none apply; the
// caller still separately disables the button while the submit mutation
// itself is pending (a `null` reason here does not by itself mean "safe
// to submit right now").
export function computeSubmitBlockReason(options: SubmitBlockOptions): string | null {
  if (!options.gridReady) {
    return 'Choose at least one model and one benchmark.'
  }
  if (options.batchNameError) {
    return options.batchNameError
  }
  if (options.isPreviewError) {
    return 'Fix the error below before running.'
  }
  if (options.isPreviewLoading || options.isPreviewFetching) {
    return 'Checking this selection…'
  }
  if (options.hasBlockingError) {
    return 'Fix the problems below before running.'
  }
  return null
}

// The exact CreateRunsRequest shape -- kept as one pure function so
// the wizard component itself never re-assembles this object inline.
export function buildCreateRunsRequest(
  batchName: string,
  selectedCheckpointIds: number[],
  selectedStandardIds: number[],
  overrides: RequestOverrides,
  partition: string | null,
  submittedBy: string,
): CreateRunsRequest {
  const trimmedSubmittedBy = submittedBy.trim()
  return {
    name: batchName.trim(),
    checkpoint_ids: selectedCheckpointIds,
    standard_ids: selectedStandardIds,
    standard_overrides_by_standard_id: overrides.standardOverridesByStandardId,
    sampling_overrides_by_checkpoint_id: overrides.samplingOverridesByCheckpointId,
    sampling_profile_id_by_checkpoint_id: overrides.samplingProfileIdByCheckpointId,
    serving_overrides_by_checkpoint_id: overrides.servingOverridesByCheckpointId,
    serving_profile_id_by_checkpoint_id: overrides.servingProfileIdByCheckpointId,
    standard_label_by_standard_id: overrides.standardLabelByStandardId,
    sampling_label_by_checkpoint_id: overrides.samplingLabelByCheckpointId,
    serving_label_by_checkpoint_id: overrides.servingLabelByCheckpointId,
    // undefined (the key genuinely absent), not null -- an untouched
    // partition picker must resolve to the backend's own current
    // default rather than the frontend sending some particular
    // partition name of its own.
    partition: partition ?? undefined,
    submitted_by: trimmedSubmittedBy === '' ? null : trimmedSubmittedBy,
  }
}

export function filterCheckpointsBySelection(
  checkpoints: CheckpointListItem[],
  selectedCheckpointIds: number[],
): CheckpointListItem[] {
  return checkpoints.filter((checkpoint) => selectedCheckpointIds.includes(checkpoint.id))
}

export function filterStandardsBySelection(standards: StandardSummary[], selectedStandardIds: number[]): StandardSummary[] {
  return standards.filter((standard) => selectedStandardIds.includes(standard.id))
}
