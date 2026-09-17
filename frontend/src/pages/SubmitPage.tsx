import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  apiFetch,
  type CheckpointListItem,
  type CreateRunsRequest,
  type RunPreview,
  type RunSubmission,
  type SamplingProfileSummary,
  type ServingProfileSummary,
  type StandardSummary,
} from '../api/client'
import { DryRunPreview } from '../components/DryRunPreview/DryRunPreview'
import { SubmitGrid } from '../components/SubmitGrid/SubmitGrid'
import {
  buildRequestOverrides,
  EMPTY_SUBMIT_OVERRIDE_DRAFTS,
  resolveSamplingLabels,
  resolveServingLabels,
  resolveStandardLabels,
  type SubmitOverrideDrafts,
} from '../components/SubmitOverrides/SubmitOverrides.helper'
import { SubmitOverrides } from '../components/SubmitOverrides/SubmitOverrides'
import { useDebouncedValue } from '../utils/useDebouncedValue'
import { checkpointsById, samplingProfilesById, servingProfilesById, standardsById } from './SubmitPage.helper'

export function SubmitPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [selectedCheckpointIds, setSelectedCheckpointIds] = useState<number[]>([])
  const [selectedStandardIds, setSelectedStandardIds] = useState<number[]>([])
  const [overrideDrafts, setOverrideDrafts] = useState<SubmitOverrideDrafts>(EMPTY_SUBMIT_OVERRIDE_DRAFTS)
  const [runName, setRunName] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')

  // Debounced on the raw drafts, not the derived overrides --
  // buildRequestOverrides returns a new object every call, and
  // debouncing *that* would restart the timer on every unrelated
  // re-render instead of only when the user actually types.
  const debouncedOverrideDrafts = useDebouncedValue(overrideDrafts, 400)

  const checkpoints = useQuery({
    queryKey: ['checkpoints'],
    queryFn: () => apiFetch<CheckpointListItem[]>('/checkpoints'),
  })

  // The grid's standard axis is reviewed standards, not every ad-hoc
  // standard ever hashed -- StandardSummary also carries the full field
  // set DryRunPreview needs to label a resolved standard's base.
  const standards = useQuery({
    queryKey: ['standards'],
    queryFn: () => apiFetch<StandardSummary[]>('/standards'),
  })

  // Same query key as SamplingProfilesPage's own list query, so the two
  // pages share one cache entry instead of fetching the catalog twice.
  const samplingProfiles = useQuery({
    queryKey: ['sampling-profiles'],
    queryFn: () => apiFetch<SamplingProfileSummary[]>('/sampling-profiles'),
  })

  // Same query key as ServingProfilesPage's and RegisterCheckpointPage's
  // own list queries, so all three share one cache entry.
  const servingProfiles = useQuery({
    queryKey: ['serving-profiles'],
    queryFn: () => apiFetch<ServingProfileSummary[]>('/serving-profiles'),
  })

  const gridReady = selectedCheckpointIds.length > 0 && selectedStandardIds.length > 0
  const selectedCheckpoints = (checkpoints.data ?? []).filter((checkpoint) =>
    selectedCheckpointIds.includes(checkpoint.id),
  )
  const selectedStandards = (standards.data ?? []).filter((standard) =>
    selectedStandardIds.includes(standard.id),
  )

  // Computed once per render, not inline at each call site -- unlike
  // checkpointsById below (used only once, for DryRunPreview), each of
  // these three feeds both a resolveXLabels call below and a component
  // prop further down, so hoisting avoids rebuilding the same Map twice.
  const standardsMap = standardsById(standards.data)
  const samplingProfilesMap = samplingProfilesById(samplingProfiles.data)
  const servingProfilesMap = servingProfilesById(servingProfiles.data)

  // Overrides are per-axis (Phase 8): a standard's shape belongs to
  // that standard, a checkpoint's sampling and serving each belong to
  // that checkpoint. Filtered to the *current* selection here -- see
  // buildRequestOverrides' own docstring on why a draft for an item
  // just unchecked must never reach the request body.
  //
  // The label resolved for a new row is computed twice more, here --
  // once for each of the live and debounced drafts, mirroring
  // requestOverrides/debouncedRequestOverrides themselves -- besides
  // the once SubmitOverrides.tsx already does on the live drafts to
  // render each card's own label box. All three calls are the same
  // pure computation over a small selection; recomputing it is cheaper
  // than plumbing its result through as three more props.
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

  const preview = useQuery({
    // Lists the exact fields the request body below sends, not the
    // whole debouncedRequestOverrides object -- that object also
    // carries the three label maps (create-only, RunPreviewRequest has
    // no such fields), and keying on it wholesale would refetch an
    // identical preview every time a label box's contents changed.
    queryKey: [
      'runs-preview',
      selectedCheckpointIds,
      selectedStandardIds,
      debouncedRequestOverrides.standardOverridesByStandardId,
      debouncedRequestOverrides.samplingOverridesByCheckpointId,
      debouncedRequestOverrides.samplingProfileIdByCheckpointId,
      debouncedRequestOverrides.servingOverridesByCheckpointId,
      debouncedRequestOverrides.servingProfileIdByCheckpointId,
    ],
    queryFn: () =>
      apiFetch<RunPreview>('/runs/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkpoint_ids: selectedCheckpointIds,
          standard_ids: selectedStandardIds,
          standard_overrides_by_standard_id: debouncedRequestOverrides.standardOverridesByStandardId,
          sampling_overrides_by_checkpoint_id: debouncedRequestOverrides.samplingOverridesByCheckpointId,
          sampling_profile_id_by_checkpoint_id: debouncedRequestOverrides.samplingProfileIdByCheckpointId,
          serving_overrides_by_checkpoint_id: debouncedRequestOverrides.servingOverridesByCheckpointId,
          serving_profile_id_by_checkpoint_id: debouncedRequestOverrides.servingProfileIdByCheckpointId,
        }),
      }),
    // POST /runs/preview 422s on an empty checkpoint_ids or standard_ids
    // (Field(min_length=1), app/schemas/runs.py) -- never fire it until
    // the grid actually has both axes selected.
    enabled: gridReady,
    // Keeps the last preview on screen while a new one loads, instead
    // of blanking out to "Checking..." on every checkbox click or
    // settled keystroke -- the plan's own "live" framing for these
    // warnings implies updating in place, not flickering.
    placeholderData: keepPreviousData,
  })

  const submitMutation = useMutation({
    mutationFn: (request: CreateRunsRequest) =>
      apiFetch<RunSubmission>('/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      navigate('/runs')
    },
  })

  function handleSubmit() {
    const trimmedSubmittedBy = submittedBy.trim()
    submitMutation.mutate({
      name: runName.trim(),
      checkpoint_ids: selectedCheckpointIds,
      standard_ids: selectedStandardIds,
      standard_overrides_by_standard_id: requestOverrides.standardOverridesByStandardId,
      sampling_overrides_by_checkpoint_id: requestOverrides.samplingOverridesByCheckpointId,
      sampling_profile_id_by_checkpoint_id: requestOverrides.samplingProfileIdByCheckpointId,
      serving_overrides_by_checkpoint_id: requestOverrides.servingOverridesByCheckpointId,
      serving_profile_id_by_checkpoint_id: requestOverrides.servingProfileIdByCheckpointId,
      standard_label_by_standard_id: requestOverrides.standardLabelByStandardId,
      sampling_label_by_checkpoint_id: requestOverrides.samplingLabelByCheckpointId,
      serving_label_by_checkpoint_id: requestOverrides.servingLabelByCheckpointId,
      submitted_by: trimmedSubmittedBy === '' ? null : trimmedSubmittedBy,
    })
  }

  const hasCompatibilityError = preview.data?.pairs.some((pair) => pair.errors.length > 0) ?? false
  const canSubmit =
    gridReady &&
    runName.trim() !== '' &&
    preview.data !== undefined &&
    // Not just "we have preview data" -- placeholderData (above) keeps
    // the previous selection's data on screen while a new one loads,
    // so without this check a just-changed grid would briefly submit
    // against a preview that describes the selection before the change.
    !preview.isFetching &&
    !hasCompatibilityError &&
    !submitMutation.isPending

  return (
    <div>
      <h1 className="text-2xl font-semibold">Submit</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Checkpoints × standards as a grid, standard or exploratory, then a dry-run preview showing jobs
        and estimated GPU count before anything runs. See EVAL_SERVICE_PLAN.md, Section 13.
      </p>

      <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-300">Grid</h2>
        <div className="mt-3">
          {checkpoints.isLoading || standards.isLoading ? (
            <p className="text-sm text-slate-500">Loading checkpoints and standards…</p>
          ) : checkpoints.isError || standards.isError ? (
            <p className="text-sm text-red-400">
              Could not load checkpoints or standards: {String(checkpoints.error ?? standards.error)}
            </p>
          ) : (
            <SubmitGrid
              checkpoints={checkpoints.data ?? []}
              standards={standards.data ?? []}
              selectedCheckpointIds={selectedCheckpointIds}
              selectedStandardIds={selectedStandardIds}
              onCheckpointIdsChange={setSelectedCheckpointIds}
              onStandardIdsChange={setSelectedStandardIds}
            />
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-300">Overrides</h2>
        <p className="mt-1 text-xs text-slate-500">
          One card per selected checkpoint and per selected standard, below -- each field&apos;s
          placeholder is its own resolved default. A blank field means "leave it at that default"; a
          typed value (marked with a dot, and resettable) mints a new standard, sampling profile
          and/or serving profile only for the fields actually changed on that card. Change at least one
          field on a card to name the row it would create, or leave it unlabelled.
        </p>
        <div className="mt-3">
          {checkpoints.isLoading ||
          standards.isLoading ||
          samplingProfiles.isLoading ||
          servingProfiles.isLoading ? (
            <p className="text-sm text-slate-500">
              Loading checkpoints, standards, sampling profiles, and serving profiles…
            </p>
          ) : checkpoints.isError || standards.isError || samplingProfiles.isError || servingProfiles.isError ? (
            <p className="text-sm text-red-400">
              Could not load checkpoints, standards, sampling profiles, or serving profiles:{' '}
              {String(checkpoints.error ?? standards.error ?? samplingProfiles.error ?? servingProfiles.error)}
            </p>
          ) : (
            <SubmitOverrides
              selectedCheckpoints={selectedCheckpoints}
              selectedStandards={selectedStandards}
              standardsById={standardsMap}
              samplingProfiles={samplingProfiles.data ?? []}
              samplingProfilesById={samplingProfilesMap}
              servingProfiles={servingProfiles.data ?? []}
              servingProfilesById={servingProfilesMap}
              drafts={overrideDrafts}
              onDraftsChange={setOverrideDrafts}
            />
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-300">Submission</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-slate-500">Name</span>
            <input
              type="text"
              value={runName}
              onChange={(event) => setRunName(event.target.value)}
              placeholder="e.g. ifeval-smoke-test"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Submitted by (optional)</span>
            <input
              type="text"
              value={submittedBy}
              onChange={(event) => setSubmittedBy(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          </label>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-300">Dry-run preview</h2>
        <div className="mt-3">
          {gridReady ? (
            <DryRunPreview
              preview={preview.data}
              isLoading={preview.isLoading}
              isError={preview.isError}
              error={preview.error}
              standardsById={standardsMap}
              checkpointsById={checkpointsById(checkpoints.data)}
              samplingProfilesById={samplingProfilesMap}
              servingProfilesById={servingProfilesMap}
              // Debounced, not the immediate `requestOverrides` -- this
              // must describe the same request that produced
              // `preview.data`, and the preview query itself fires on
              // the debounced value.
              userSamplingOverridesByCheckpointId={debouncedRequestOverrides.samplingOverridesByCheckpointId}
            />
          ) : (
            <p className="text-sm text-slate-500">Select at least one checkpoint and one standard.</p>
          )}
        </div>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitMutation.isPending ? 'Submitting…' : 'Submit'}
        </button>
        {submitMutation.isError && (
          <p className="text-sm text-red-400">{String(submitMutation.error)}</p>
        )}
      </div>
    </div>
  )
}
