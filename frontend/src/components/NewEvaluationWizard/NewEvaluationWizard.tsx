import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type {
  CheckpointListItem,
  RunPreviewRequest,
  SamplingProfileSummary,
  ServingProfileSummary,
  StandardSummary,
} from '../../api/client'
import { useLeaderboard } from '../../api/queries/leaderboard'
import { useCreateRuns, useRunPreview, useRuns } from '../../api/queries/runs'
import { BenchmarkPicker } from '../BenchmarkPicker/BenchmarkPicker'
import { Card } from '../Card/Card'
import { buildCreatedItems } from '../DryRunPreview/DryRunPreview.helper'
import { ModelPicker } from '../ModelPicker/ModelPicker'
import { NewEvaluationReviewStep } from '../NewEvaluationReviewStep/NewEvaluationReviewStep'
import { NewEvaluationSettingsStep } from '../NewEvaluationSettingsStep/NewEvaluationSettingsStep'
import { NewEvaluationSummaryBar } from '../NewEvaluationSummaryBar/NewEvaluationSummaryBar'
import { Stepper } from '../Stepper/Stepper'
import {
  buildRequestOverrides,
  resolveSamplingLabels,
  resolveServingLabels,
  resolveStandardLabels,
  type SubmitOverrideDrafts,
} from '../SubmitOverrides/SubmitOverrides.helper'
import { describeError } from '../../utils/describeError'
import { indexById } from '../../utils/indexById'
import { paths } from '../../utils/paths'
import { useDebouncedValue } from '../../utils/useDebouncedValue'
import { useRememberedName } from '../../utils/useRememberedName'
import {
  buildCreateRunsRequest,
  computeSubmitBlockReason,
  existingBatchNames,
  filterCheckpointsBySelection,
  filterStandardsBySelection,
  isStepReachable,
  NEW_EVALUATION_STEPS,
  parseStepParam,
  suggestBatchName,
  validateBatchName,
  type NewEvaluationStepKey,
} from './NewEvaluationWizard.helper'

interface NewEvaluationWizardProps {
  checkpoints: CheckpointListItem[]
  standards: StandardSummary[]
  samplingProfiles: SamplingProfileSummary[]
  servingProfiles: ServingProfileSummary[]
  initialCheckpointIds: number[]
  initialStandardIds: number[]
  initialDrafts: SubmitOverrideDrafts
}

const CHOOSE_BOTH_AXES_REASON = 'Choose at least one model and one benchmark.'

// The whole New evaluation flow (Phase 10, docs/UI_REDESIGN_PLAN.md
// §8.10): owns the grid selection, every override draft, the batch's
// own name and submitter, and the partition, then renders whichever
// step's content the URL's own `?step=` names. Mounted fresh (a new
// React `key`) per distinct prefill -- NewEvaluationPage's own job, not
// this component's -- so `initialCheckpointIds` etc. are only ever read
// once, on mount, the same way `useState(initial)` always works.
export function NewEvaluationWizard({
  checkpoints,
  standards,
  samplingProfiles,
  servingProfiles,
  initialCheckpointIds,
  initialStandardIds,
  initialDrafts,
}: NewEvaluationWizardProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedCheckpointIds, setSelectedCheckpointIds] = useState<number[]>(initialCheckpointIds)
  const [selectedStandardIds, setSelectedStandardIds] = useState<number[]>(initialStandardIds)
  const [overrideDrafts, setOverrideDrafts] = useState<SubmitOverrideDrafts>(initialDrafts)
  // null = "follow the auto-suggestion" -- mirrors every override
  // card's own labelDraft (SubmitOverrides.helper.ts): a name the user
  // never touched keeps tracking the current selection; typing into it
  // once takes ownership of the field.
  const [batchNameOverride, setBatchNameOverride] = useState<string | null>(null)
  const [submittedBy, setSubmittedBy] = useRememberedName()
  const [partition, setPartition] = useState<string | null>(null)

  // Debounced on the raw drafts, not the derived overrides -- see
  // SubmitOverrides.helper.ts's own reasoning: buildRequestOverrides
  // returns a new object every call, and debouncing *that* would
  // restart the timer on every unrelated re-render instead of only
  // when the user actually types.
  const debouncedOverrideDrafts = useDebouncedValue(overrideDrafts, 400)

  const gridReady = selectedCheckpointIds.length > 0 && selectedStandardIds.length > 0
  const requestedStep = parseStepParam(searchParams.get('step'))
  const currentStep = isStepReachable(requestedStep, gridReady) ? requestedStep : 'choose'

  function goToStep(stepKey: NewEvaluationStepKey): void {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('step', stepKey)
        return next
      },
      // Pushed, not replaced (§8.10's own URL contract): each step is
      // its own history entry, so the browser's own Back button moves
      // between them the same way the in-page Back button does.
      { replace: false },
    )
  }

  const selectedCheckpoints = filterCheckpointsBySelection(checkpoints, selectedCheckpointIds)
  const selectedStandards = filterStandardsBySelection(standards, selectedStandardIds)

  const standardsMap = indexById(standards)
  const samplingProfilesMap = indexById(samplingProfiles)
  const servingProfilesMap = indexById(servingProfiles)

  // Recomputed for both the live and the debounced drafts, mirroring
  // SubmitOverrides.tsx's own recomputation of the same three label
  // maps for its currently open card -- all are the same pure
  // computation over a small selection, so recomputing is cheaper than
  // plumbing the result through as extra props.
  const requestOverrides = buildRequestOverrides(
    overrideDrafts,
    selectedCheckpointIds,
    selectedStandardIds,
    resolveStandardLabels(selectedStandards, standardsMap, overrideDrafts),
    resolveSamplingLabels(selectedCheckpoints, samplingProfilesMap, overrideDrafts),
    resolveServingLabels(selectedCheckpoints, servingProfilesMap, overrideDrafts),
  )
  const debouncedRequestOverrides = buildRequestOverrides(
    debouncedOverrideDrafts,
    selectedCheckpointIds,
    selectedStandardIds,
    resolveStandardLabels(selectedStandards, standardsMap, debouncedOverrideDrafts),
    resolveSamplingLabels(selectedCheckpoints, samplingProfilesMap, debouncedOverrideDrafts),
    resolveServingLabels(selectedCheckpoints, servingProfilesMap, debouncedOverrideDrafts),
  )

  // Built once and reused for both the preview request body and its
  // query key (queryKeys.runPreview) -- the two can never drift apart
  // this way.
  const previewRequest: RunPreviewRequest = {
    checkpoint_ids: selectedCheckpointIds,
    standard_ids: selectedStandardIds,
    standard_overrides_by_standard_id: debouncedRequestOverrides.standardOverridesByStandardId,
    sampling_overrides_by_checkpoint_id: debouncedRequestOverrides.samplingOverridesByCheckpointId,
    sampling_profile_id_by_checkpoint_id: debouncedRequestOverrides.samplingProfileIdByCheckpointId,
    serving_overrides_by_checkpoint_id: debouncedRequestOverrides.servingOverridesByCheckpointId,
    serving_profile_id_by_checkpoint_id: debouncedRequestOverrides.servingProfileIdByCheckpointId,
  }

  const preview = useRunPreview(previewRequest, gridReady)
  const leaderboardQuery = useLeaderboard()
  // The same unfiltered `runs` cache entry AppShell's own sidebar badge
  // and the Runs page read (queryKeys.runs({})) -- only `run_group_name`
  // is used here, for the batch name's own uniqueness check.
  const runsQuery = useRuns()
  const createRuns = useCreateRuns()

  const existingNames = existingBatchNames(runsQuery.data ?? [])
  const batchName = batchNameOverride ?? suggestBatchName(selectedStandards, existingNames)
  const batchNameError = validateBatchName(batchName, existingNames)

  const hasBlockingError = preview.data?.pairs.some((pair) => pair.errors.length > 0) ?? false
  const createdItems = preview.data
    ? buildCreatedItems(
        preview.data,
        debouncedRequestOverrides.standardLabelByStandardId,
        debouncedRequestOverrides.samplingLabelByCheckpointId,
        debouncedRequestOverrides.servingLabelByCheckpointId,
      )
    : []

  function handleSubmit(): void {
    const request = buildCreateRunsRequest(
      batchName,
      selectedCheckpointIds,
      selectedStandardIds,
      requestOverrides,
      partition,
      submittedBy,
    )
    createRuns.mutate(request, {
      onSuccess: (submission) => {
        toast.success(`Started ${submission.run_ids.length} run${submission.run_ids.length === 1 ? '' : 's'}`)
        navigate(paths.runs({ batch: submission.run_group_id }))
      },
      onError: (error) => {
        toast.error(`Could not run evaluation: ${describeError(error)}`)
      },
    })
  }

  const submitBlockReason = computeSubmitBlockReason({
    gridReady,
    batchNameError,
    isPreviewLoading: preview.isLoading,
    isPreviewFetching: preview.isFetching,
    isPreviewError: preview.isError,
    hasBlockingError,
  })

  const primaryAction =
    currentStep === 'review'
      ? {
          label: createRuns.isPending ? 'Running evaluation…' : 'Run evaluation',
          onClick: handleSubmit,
          disabled: submitBlockReason !== null || createRuns.isPending,
          loading: createRuns.isPending,
          blockReason: submitBlockReason,
        }
      : {
          label: 'Continue',
          onClick: () => goToStep(currentStep === 'choose' ? 'settings' : 'review'),
          disabled: !gridReady,
          loading: false,
          blockReason: gridReady ? null : CHOOSE_BOTH_AXES_REASON,
        }

  const runCount = preview.data?.run_count ?? selectedCheckpointIds.length * selectedStandardIds.length
  const gpuCount = preview.data?.gpu_count ?? 0

  return (
    <div className="space-y-6 pb-4">
      <Stepper
        steps={NEW_EVALUATION_STEPS}
        currentStepKey={currentStep}
        isStepReachable={(stepKey) => isStepReachable(stepKey as NewEvaluationStepKey, gridReady)}
        onStepClick={(stepKey) => goToStep(stepKey as NewEvaluationStepKey)}
      />

      {currentStep === 'choose' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-medium text-foreground">Models</h2>
            <div className="mt-3">
              <ModelPicker
                checkpoints={checkpoints}
                selectedCheckpointIds={selectedCheckpointIds}
                onSelectedCheckpointIdsChange={setSelectedCheckpointIds}
              />
            </div>
          </Card>
          <Card>
            <h2 className="text-sm font-medium text-foreground">Benchmarks</h2>
            <div className="mt-3">
              <BenchmarkPicker
                standards={standards}
                selectedStandardIds={selectedStandardIds}
                onSelectedStandardIdsChange={setSelectedStandardIds}
              />
            </div>
          </Card>
        </div>
      )}

      {currentStep === 'settings' && (
        <NewEvaluationSettingsStep
          selectedCheckpoints={selectedCheckpoints}
          selectedStandards={selectedStandards}
          standardsById={standardsMap}
          samplingProfiles={samplingProfiles}
          samplingProfilesById={samplingProfilesMap}
          servingProfiles={servingProfiles}
          servingProfilesById={servingProfilesMap}
          drafts={overrideDrafts}
          onDraftsChange={setOverrideDrafts}
          preview={preview.data}
          isPreviewFetching={preview.isFetching}
          leaderboardQuery={leaderboardQuery}
        />
      )}

      {currentStep === 'review' && (
        <NewEvaluationReviewStep
          preview={preview.data}
          isPreviewLoading={preview.isLoading}
          isPreviewError={preview.isError}
          previewError={preview.error}
          onRetryPreview={() => preview.refetch()}
          createdItems={createdItems}
          batchName={batchName}
          onBatchNameChange={setBatchNameOverride}
          batchNameError={batchNameError}
          submittedBy={submittedBy}
          onSubmittedByChange={setSubmittedBy}
          partition={partition}
          onPartitionChange={setPartition}
        />
      )}

      <NewEvaluationSummaryBar
        modelCount={selectedCheckpointIds.length}
        benchmarkCount={selectedStandardIds.length}
        runCount={runCount}
        gpuCount={gpuCount}
        showBack={currentStep !== 'choose'}
        onBack={() => goToStep(currentStep === 'review' ? 'settings' : 'choose')}
        primaryLabel={primaryAction.label}
        onPrimaryAction={primaryAction.onClick}
        primaryDisabled={primaryAction.disabled}
        primaryLoading={primaryAction.loading}
        blockReason={primaryAction.blockReason}
      />
    </div>
  )
}
