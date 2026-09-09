import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  apiFetch,
  type CheckpointListItem,
  type CreateRunsRequest,
  type RunPreview,
  type RunSubmission,
  type StandardRecipe,
} from '../api/client'
import { DryRunPreview } from '../components/DryRunPreview/DryRunPreview'
import { OverrideEditor } from '../components/OverrideEditor/OverrideEditor'
import {
  buildOverridesFromDraft,
  EMPTY_OVERRIDE_DRAFT,
  type OverrideDraft,
} from '../components/OverrideEditor/OverrideEditor.helper'
import { SubmitGrid } from '../components/SubmitGrid/SubmitGrid'
import { useDebouncedValue } from './SubmitPage.helper'

function recipesById(recipes: StandardRecipe[] | undefined): Map<number, StandardRecipe> {
  return new Map((recipes ?? []).map((recipe) => [recipe.id, recipe]))
}

export function SubmitPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [selectedCheckpointIds, setSelectedCheckpointIds] = useState<number[]>([])
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([])
  const [draft, setDraft] = useState<OverrideDraft>(EMPTY_OVERRIDE_DRAFT)
  const [runName, setRunName] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')

  // Debounced on the raw draft, not the derived RecipeOverrides --
  // buildOverridesFromDraft returns a new object every call, and
  // debouncing *that* would restart the timer on every unrelated
  // re-render instead of only when the user actually types.
  const debouncedDraft = useDebouncedValue(draft, 400)
  const overrides = buildOverridesFromDraft(draft)
  const debouncedOverrides = buildOverridesFromDraft(debouncedDraft)

  const checkpoints = useQuery({
    queryKey: ['checkpoints'],
    queryFn: () => apiFetch<CheckpointListItem[]>('/checkpoints'),
  })

  // The grid's recipe axis is reviewed standards, not every ad-hoc
  // recipe ever hashed -- StandardRecipe also carries the full field
  // set DryRunPreview needs to label a resolved recipe's base.
  const standards = useQuery({
    queryKey: ['standards'],
    queryFn: () => apiFetch<StandardRecipe[]>('/standards'),
  })

  const gridReady = selectedCheckpointIds.length > 0 && selectedRecipeIds.length > 0

  const preview = useQuery({
    queryKey: ['runs-preview', selectedCheckpointIds, selectedRecipeIds, debouncedOverrides],
    queryFn: () =>
      apiFetch<RunPreview>('/runs/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkpoint_ids: selectedCheckpointIds,
          recipe_ids: selectedRecipeIds,
          overrides: debouncedOverrides,
        }),
      }),
    // POST /runs/preview 422s on an empty checkpoint_ids or recipe_ids
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
      recipe_ids: selectedRecipeIds,
      overrides,
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
        Checkpoints × recipes as a grid, standard or exploratory, then a dry-run preview showing jobs
        and estimated GPU count before anything runs. See EVAL_SERVICE_PLAN.md, Section 13.
      </p>

      <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-300">Grid</h2>
        <div className="mt-3">
          {checkpoints.isLoading || standards.isLoading ? (
            <p className="text-sm text-slate-500">Loading checkpoints and recipes…</p>
          ) : checkpoints.isError || standards.isError ? (
            <p className="text-sm text-red-400">
              Could not load checkpoints or recipes: {String(checkpoints.error ?? standards.error)}
            </p>
          ) : (
            <SubmitGrid
              checkpoints={checkpoints.data ?? []}
              recipes={standards.data ?? []}
              selectedCheckpointIds={selectedCheckpointIds}
              selectedRecipeIds={selectedRecipeIds}
              onCheckpointIdsChange={setSelectedCheckpointIds}
              onRecipeIdsChange={setSelectedRecipeIds}
            />
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-300">Overrides</h2>
        <p className="mt-1 text-xs text-slate-500">
          Applies to every selected recipe. A blank field means "leave it as the recipe already has
          it" -- this mints a new, unlabelled recipe only for the fields actually changed here.
        </p>
        <div className="mt-3">
          <OverrideEditor draft={draft} onChange={setDraft} />
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
              recipesById={recipesById(standards.data)}
            />
          ) : (
            <p className="text-sm text-slate-500">Select at least one checkpoint and one recipe.</p>
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
